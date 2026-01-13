import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MatterInfo {
  id: string;
  matter_name: string;
  matter_display_name?: string;
  matter_number: string;
  client_name: string;
  client_display_name?: string;
  cm_number?: string;
  currency: string;
}

interface ParsedMatterWip {
  matter_id: string;
  matter_name: string;
  client_name: string;
  wip_amount: number;
  wip_write_off: number;
  billed_amount: number;
  paid_amount: number;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
  matched_text?: string;
}

interface UnmatchedItem {
  description: string;
  wip_amount: number;
  billed_amount?: number;
  paid_amount?: number;
  reason: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, matters } = await req.json();

    if (!content || !matters || !Array.isArray(matters)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing content or matters list" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the matters reference for the AI
    const mattersReference = matters.map((m: MatterInfo) => ({
      id: m.id,
      identifiers: [
        m.matter_name,
        m.matter_display_name,
        m.matter_number,
        m.client_name,
        m.client_display_name,
        m.cm_number,
      ].filter(Boolean),
      currency: m.currency,
    }));

    const systemPrompt = `You are a financial document parser specializing in legal matter WIP (Work in Progress), AR (Accounts Receivable), and billing data.

Your task is to:
1. Extract ALL monetary values from the provided document that relate to legal matters
2. Match each extracted value to the correct matter from the provided list
3. Identify WIP, Write-offs, Billed/AR, and Paid amounts for each matter

MATCHING RULES:
- Match by matter name, client name, matter number, or C/M number
- Be flexible with partial matches and abbreviations
- Assign confidence levels: "high" for exact matches, "medium" for partial matches, "low" for uncertain matches

OUTPUT FORMAT:
Return a JSON object with:
{
  "matches": [
    {
      "matter_id": "uuid from the matters list",
      "matter_name": "name of the matched matter",
      "client_name": "client name",
      "wip_amount": number (raw WIP before write-offs),
      "wip_write_off": number (write-off amount, 0 if not specified),
      "billed_amount": number (billed/AR amount, 0 if not specified),
      "paid_amount": number (paid amount, 0 if not specified),
      "currency": "currency code",
      "confidence": "high" | "medium" | "low",
      "matched_text": "the text from the document that was matched"
    }
  ],
  "unmatched_items": [
    {
      "description": "description of the unmatched item",
      "wip_amount": number,
      "billed_amount": number,
      "paid_amount": number,
      "reason": "why it couldn't be matched"
    }
  ],
  "summary": "Brief summary of what was extracted"
}

IMPORTANT:
- Extract ALL financial data, even if you're not sure of the match
- If a value looks like it could be WIP, AR, or Paid, extract it
- Use 0 for any amounts not explicitly mentioned
- Be aggressive in extracting - false positives are better than missing data`;

    const userPrompt = `Here are the matters to match against:
${JSON.stringify(mattersReference, null, 2)}

Here is the document content:
${content}

Extract all WIP, AR, and Paid data and match to the matters above.`;

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
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content_text = aiResponse.choices?.[0]?.message?.content;
    
    if (!content_text) {
      throw new Error("No response from AI");
    }

    let parsed;
    try {
      parsed = JSON.parse(content_text);
    } catch (e) {
      console.error("Failed to parse AI response:", content_text);
      throw new Error("Failed to parse AI response as JSON");
    }

    // Validate and clean the response
    const matches: ParsedMatterWip[] = (parsed.matches || []).map((m: any) => ({
      matter_id: m.matter_id,
      matter_name: m.matter_name || '',
      client_name: m.client_name || '',
      wip_amount: Number(m.wip_amount) || 0,
      wip_write_off: Number(m.wip_write_off) || 0,
      billed_amount: Number(m.billed_amount) || 0,
      paid_amount: Number(m.paid_amount) || 0,
      currency: m.currency || 'GBP',
      confidence: m.confidence || 'low',
      matched_text: m.matched_text,
    }));

    const unmatched_items: UnmatchedItem[] = (parsed.unmatched_items || []).map((u: any) => ({
      description: u.description || '',
      wip_amount: Number(u.wip_amount) || 0,
      billed_amount: Number(u.billed_amount) || 0,
      paid_amount: Number(u.paid_amount) || 0,
      reason: u.reason || 'Unknown',
    }));

    return new Response(
      JSON.stringify({
        success: true,
        matches,
        unmatched_items,
        summary: parsed.summary || `Found ${matches.length} matches and ${unmatched_items.length} unmatched items`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parse-master-wip:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
