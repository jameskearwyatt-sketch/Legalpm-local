import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactInput {
  id: string;
  full_name: string;
  company?: string | null;
  location?: string | null;
}

interface JapaneseDetectionResult {
  id: string;
  full_name: string;
  is_japanese: boolean;
  confidence: "high" | "medium" | "low";
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contacts } = await req.json() as { contacts: ContactInput[] };

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ results: [], has_japanese_contacts: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build prompt for AI analysis
    const contactList = contacts.map((c, i) => 
      `${i + 1}. Name: "${c.full_name}"${c.company ? `, Company: "${c.company}"` : ""}${c.location ? `, Location: "${c.location}"` : ""}`
    ).join("\n");

    const prompt = `Analyze the following contacts and determine which ones are likely Japanese (either Japanese nationals, people of Japanese heritage, or people working in Japan who should be addressed with Japanese formality).

Consider:
- Japanese names (family names like Tanaka, Yamamoto, Sato, Suzuki, etc.)
- Company names suggesting Japanese affiliation (Japanese company names, "Japan" in company name)
- Location in Japan (Tokyo, Osaka, Kyoto, Japan, etc.)

For each contact, determine if they should be addressed using Japanese formal style (e.g., "Tanaka-san" instead of "Dear Tanaka").

Contacts:
${contactList}

Respond with a JSON array of objects with this structure:
{
  "results": [
    {
      "index": 1,
      "is_japanese": true/false,
      "confidence": "high"/"medium"/"low",
      "reason": "brief explanation"
    }
  ]
}

Only mark as Japanese if there's reasonable evidence. Be conservative - when in doubt, mark as false.`;

    console.log("Analyzing contacts for Japanese detection:", contacts.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "You are an expert at identifying Japanese names and cultural contexts. Respond only with valid JSON." 
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", content);

    // Parse AI response
    let aiResults: { index: number; is_japanese: boolean; confidence: string; reason?: string }[] = [];
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiResults = parsed.results || [];
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return empty results on parse error
      return new Response(
        JSON.stringify({ results: [], has_japanese_contacts: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map AI results back to contacts
    const results: JapaneseDetectionResult[] = contacts.map((contact, index) => {
      const aiResult = aiResults.find(r => r.index === index + 1);
      return {
        id: contact.id,
        full_name: contact.full_name,
        is_japanese: aiResult?.is_japanese || false,
        confidence: (aiResult?.confidence as "high" | "medium" | "low") || "low",
        reason: aiResult?.reason,
      };
    });

    const hasJapaneseContacts = results.some(r => r.is_japanese);

    console.log("Detection complete. Japanese contacts found:", hasJapaneseContacts);

    return new Response(
      JSON.stringify({ 
        results, 
        has_japanese_contacts: hasJapaneseContacts,
        japanese_count: results.filter(r => r.is_japanese).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in detect-japanese-contacts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});