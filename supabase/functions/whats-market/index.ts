// Version: v1.0.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { category, precedents, jurisdiction, context } = await req.json();
    const isCarbon = context === 'carbon';

    if (!category || !precedents || !Array.isArray(precedents) || precedents.length === 0) {
      return new Response(
        JSON.stringify({ error: "Category and at least one precedent are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`[whats-market] Analyzing "${category}" with ${precedents.length} precedents`);

    // Format precedents for the prompt
    const precedentSummaries = precedents.map((p: any, i: number) => {
      const parts = [`${i + 1}. Project: ${p.project_name || 'Unknown'}`];
      if (p.jurisdiction) parts.push(`   Jurisdiction: ${p.jurisdiction}`);
      if (p.perspective) parts.push(`   Perspective: ${p.perspective}`);
      if (p.ppa_type && !isCarbon) parts.push(`   PPA Type: ${p.ppa_type}`);
      if (p.carbon_type && isCarbon) parts.push(`   Carbon Type: ${p.carbon_type}`);

      if (p.market_position) parts.push(`   Market Position: ${p.market_position}`);
      if (p.party_favorability) parts.push(`   Party Favorability: ${p.party_favorability}`);
      if (p.buyer_name) parts.push(`   Buyer: ${p.buyer_name}`);
      if (p.seller_name) parts.push(`   Seller: ${p.seller_name}`);
      parts.push(`   Position: ${p.position_summary}`);
      return parts.join('\n');
    }).join('\n\n');

    const jurisdictionContext = jurisdiction 
      ? `The user is particularly interested in the ${jurisdiction} market, but synthesize across all available data.`
      : 'Synthesize across all available jurisdictions.';

    const domainDescription = isCarbon
      ? `You are an expert carbon markets lawyer and carbon credit offtake analyst with deep knowledge of voluntary carbon markets, compliance markets, Article 6, Frontier, and OSCAR frameworks. Your role is to synthesize banked deal precedents into authoritative "What's Market?" guidance for carbon credit offtake agreements.

You will be given a set of agreed carbon credit offtake positions for a specific commercial category. Your task is to produce THREE distinct market position summaries:`
      : `You are an expert energy lawyer and PPA (Power Purchase Agreement) market analyst with deep knowledge of European renewable energy markets. Your role is to synthesize banked deal precedents into authoritative "What's Market?" guidance.

You will be given a set of agreed PPA positions for a specific commercial category. Your task is to produce THREE distinct market position summaries:`;

    const systemPrompt = `${domainDescription}

1. **BALANCED** - The true market standard: what a reasonable, well-advised party on either side would expect. This is the default, fair position.
2. **BUYER-FRIENDLY** - A position that legitimately favors the buyer/offtaker while still being within the range of market-acceptable terms (NOT off-market or aggressive).
3. **SELLER-FRIENDLY** - A position that legitimately favors the seller/generator while still being within the range of market-acceptable terms (NOT off-market or aggressive).

CRITICAL RULES:
- Write at commercial term sheet level of detail - specific, concrete, actionable
- Include specific numbers, percentages, timeframes where the data supports it (e.g., "10-15 business days", "80-90% availability guarantee", "2-3% of annual revenue")
- Where the data shows a clear market range, state it explicitly
- Where positions vary significantly, note the range and what drives the difference
- Do NOT invent positions - only synthesize from the provided precedent data
- If there are too few precedents to draw reliable conclusions on a sub-point, say so
- Each section should be 3-8 bullet points of substantive detail
- Use professional legal/commercial language but be clear and direct
- Focus on the KEY commercial terms within this category, not every minor detail
${isCarbon ? '- NEVER refer to these agreements as PPAs or Power Purchase Agreements. They are carbon credit offtake agreements.' : ''}

${jurisdictionContext}`;

    const userPrompt = `Analyze the following ${precedents.length} banked precedent positions for the category "${category}" and provide a comprehensive "What's Market?" analysis.

BANKED PRECEDENTS:
${precedentSummaries}

Please respond in the following JSON format (no markdown, just raw JSON):
{
  "category": "${category}",
  "dealCount": ${precedents.length},
  "balanced": {
    "title": "Balanced Market Standard",
    "summary": "One-sentence overview of the balanced position",
    "points": ["Bullet point 1", "Bullet point 2", ...]
  },
  "buyerFriendly": {
    "title": "Buyer-Friendly Position",
    "summary": "One-sentence overview of what tips this toward the buyer",
    "points": ["Bullet point 1", "Bullet point 2", ...]
  },
  "sellerFriendly": {
    "title": "Seller-Friendly Position", 
    "summary": "One-sentence overview of what tips this toward the seller",
    "points": ["Bullet point 1", "Bullet point 2", ...]
  },
  "keyInsights": ["Any notable observations about market trends, jurisdiction-specific patterns, or data gaps"],
  "confidenceNote": "A brief note on the reliability of this analysis given the sample size and data quality"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("[whats-market] AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response - handle markdown code blocks
    let parsed;
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[whats-market] Failed to parse AI response:", content);
      throw new Error("Failed to parse AI analysis response");
    }

    console.log(`[whats-market] Successfully analyzed "${category}"`);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[whats-market] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
