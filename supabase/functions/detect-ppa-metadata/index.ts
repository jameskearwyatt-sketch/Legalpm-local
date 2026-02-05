import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Version: v1.2.0 - Switched to stable AI model (gemini-2.5-flash)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentText } = await req.json();

    if (!documentText || typeof documentText !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Document text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Take first ~8000 chars for quick detection (covers title pages, definitions, key terms)
    const sampleText = documentText.slice(0, 8000);

    const systemPrompt = `You are an expert PPA (Power Purchase Agreement) document analyst. Your task is to quickly scan a PPA document excerpt and detect key metadata.

Based on the document text provided, identify:

1. **Jurisdiction**: The country or region where the PPA applies. Look for:
   - Governing law clauses (e.g., "governed by the laws of England")
   - Location references for the project/facility
   - Grid connection points
   - Currency references (EUR suggests continental Europe, GBP suggests UK)
   - Regulatory body references (Ofgem = UK, BNetzA = Germany, etc.)

2. **PPA Structure Type**: Identify which type of PPA this is:
   - "vppa" (Virtual/Synthetic PPA): No physical delivery, financial settlement against market price, typically involves CFDs
   - "physical" (Physical PPA): Actual delivery of electricity, sleeving arrangements with utilities
   - "sleeved" (Sleeved PPA): Third-party utility/aggregator intermediates, route-to-market arrangements
   - "private_wire" (Private Wire/On-site): Direct connection between generator and consumer, behind-the-meter

3. **Counterparty Type**: The type of buyer/offtaker entity:
   - Look for company names and identify their sector
   - Common types: "Utility", "Corporate", "Oil Major", "Tech Company", "Industrial", "Developer", "Financial Institution", "Aggregator", "Data Center"

4. **Buyer Name**: The name of the purchasing party (offtaker/buyer). Look for:
   - Party definitions at the start (e.g., "Buyer means...", "Offtaker means...")
   - Signature blocks
   - References to the corporate buyer/offtaker

5. **Seller Name**: The name of the selling party (generator/seller). Look for:
   - Party definitions at the start (e.g., "Seller means...", "Generator means...")
   - Project company names
   - References to the developer/generator

6. **Normalized Party Names**: For BOTH buyer and seller, also provide a NORMALIZED/CANONICAL company name that strips away:
   - Specific entity suffixes (Ltd, Limited, GmbH, AS, plc, Inc, LLC, S.A., B.V., etc.)
   - Country/regional qualifiers (UK, Markets, Europe, Deutschland, etc.)
   - Project-specific SPV names
   
   The goal is to identify the PARENT COMPANY brand. Examples:
   - "Statkraft Markets GmbH" → "Statkraft"
   - "Statkraft UK Limited" → "Statkraft"  
   - "Shell Energy Europe Limited" → "Shell"
   - "Amazon EU S.à r.l." → "Amazon"
   - "Microsoft Ireland Operations Limited" → "Microsoft"
   - "Ørsted Wind Power A/S" → "Ørsted"
   - "RWE Renewables UK Swindon Limited" → "RWE"
   - "Greencoat Solar 1 Limited" → "Greencoat"
   - "Project Sunrise SPV Ltd" → Keep the project name if no clear parent

Return your analysis as JSON with this exact structure:
{
  "jurisdiction": "string or null if uncertain",
  "jurisdiction_confidence": "high|medium|low",
  "ppa_type": "vppa|physical|sleeved|private_wire",
  "ppa_type_confidence": "high|medium|low", 
  "counterparty_type": "string or null if uncertain",
  "counterparty_type_confidence": "high|medium|low",
  "buyer_name": "Full legal entity name as stated in document",
  "buyer_normalized": "Parent company/brand name for searching (e.g., 'Statkraft')",
  "buyer_name_confidence": "high|medium|low",
  "seller_name": "Full legal entity name as stated in document",
  "seller_normalized": "Parent company/brand name for searching (e.g., 'Orsted')",
  "seller_name_confidence": "high|medium|low",
  "detection_notes": "Brief explanation of key indicators found"
}

IMPORTANT:
- Only return JSON, no other text
- If you cannot determine something with reasonable confidence, return null for that field
- Focus on explicit indicators in the text, not assumptions
- For jurisdiction, return the COUNTRY name (e.g., "United Kingdom", "Germany", "Spain")
- For party names, extract the actual company/entity name, not generic terms like "Buyer" or "Seller"
- The normalized name should be the recognizable BRAND/PARENT, stripping legal entity suffixes and regional qualifiers`;

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
          { role: "user", content: `Analyze this PPA document excerpt and detect the metadata:\n\n${sampleText}` },
        ],
      }),
    });
    
    console.log("AI gateway response status:", response.status);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    let metadata;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      metadata = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return empty detection if parsing fails
      metadata = {
        jurisdiction: null,
        jurisdiction_confidence: "low",
        ppa_type: null,
        ppa_type_confidence: "low",
        counterparty_type: null,
        counterparty_type_confidence: "low",
        detection_notes: "Unable to parse document metadata",
      };
    }

    console.log("Detected PPA metadata:", metadata);

    return new Response(
      JSON.stringify(metadata),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error detecting PPA metadata:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
