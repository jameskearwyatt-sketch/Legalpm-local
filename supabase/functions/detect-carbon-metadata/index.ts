import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Take first ~8000 chars for quick detection
    const sampleText = documentText.slice(0, 8000);

    const systemPrompt = `You are an expert carbon credit offtake agreement analyst. Your task is to quickly scan a carbon credit offtake document excerpt and detect key metadata.

Based on the document text provided, identify:

1. **Project Name**: The name of the carbon removal or credit project.

2. **Carbon Removal / Credit Type**: Identify the technology or methodology. You MUST use one of these exact IDs:
   - "dac" (Direct Air Capture)
   - "beccs" (Bioenergy with CCS)
   - "biochar" (Biochar)
   - "enhanced_weathering" (Enhanced Rock Weathering)
   - "mineralisation" (Carbon Mineralization / Geological Storage)
   - "ocean_based" (Ocean-Based Removal, Engineered)
   - "soil_carbon" (Soil Carbon Sequestration)
   - "afforestation" (Afforestation / Reforestation)
   - "redd_plus" (Avoided Deforestation / REDD+)
   - "blue_carbon" (Blue Carbon - Mangroves, Seagrass, Kelp)
   - "peatland" (Peatland Restoration)
   - "avoidance" (Avoidance / Reduction Credits)
   - "other" (Other / Unknown)

3. **Project Stage** (use exact ID):
   - "pre_development" (Pre-Development / Feasibility)
   - "development" (In Development / Permitting / Under Construction)
   - "operational" (Operational / Generating Credits)

4. **Jurisdiction**: The country or region where the project is located or the governing law applies.

5. **Buyer (Offtaker) Name**: The entity purchasing the carbon credits. Look for:
   - Party definitions ("Buyer means...", "Offtaker means...", "Purchaser means...")
   - Signature blocks
   - References to corporate buyers (e.g., Microsoft, Stripe, Swiss Re)

6. **Seller (Project Developer) Name**: The entity selling/generating the credits. Look for:
   - Party definitions ("Seller means...", "Supplier means...", "Developer means...")
   - Project company names (e.g., Climeworks, CarbonCure, Running Tide)

7. **Normalized Party Names**: For BOTH buyer and seller, provide a NORMALIZED/CANONICAL company name that strips away:
   - Legal entity suffixes (Ltd, Limited, GmbH, Inc, LLC, S.A., B.V., etc.)
   - Country/regional qualifiers
   - SPV names — identify the PARENT COMPANY brand
   Examples: "Frontier Offtake Intermediary LLC" → "Frontier", "CarbonCure Technologies Inc." → "CarbonCure"

8. **Counterparty Type**: Type of buyer entity:
   - "Corporate Buyer", "Compliance Entity", "Trading House", "Tech Company", "Financial Institution", "Aggregator/Intermediary", "Government", "Other"

9. **Framework / Standard**: Whether the agreement follows a known framework:
   - "Frontier" (Frontier advance market commitment template)
   - "OSCAR" (Open-Source Carbon Accounting and Removal)
   - "Custom" or null if unknown

Return your analysis as JSON with this exact structure:
{
  "project_name": "string or null",
  "project_name_confidence": "high|medium|low",
  "carbon_type": "string matching one of the types above, or null",
  "carbon_type_confidence": "high|medium|low",
  "project_stage": "string matching one of the stages above, or null",
  "project_stage_confidence": "high|medium|low",
  "jurisdiction": "string or null",
  "jurisdiction_confidence": "high|medium|low",
  "buyer_name": "Full legal entity name",
  "buyer_normalized": "Parent company/brand name",
  "buyer_name_confidence": "high|medium|low",
  "seller_name": "Full legal entity name",
  "seller_normalized": "Parent company/brand name",
  "seller_name_confidence": "high|medium|low",
  "counterparty_type": "string or null",
  "counterparty_type_confidence": "high|medium|low",
  "framework": "Frontier|OSCAR|Custom|null",
  "detection_notes": "Brief explanation of key indicators found"
}

IMPORTANT:
- Only return JSON, no other text
- If you cannot determine something with reasonable confidence, return null for that field
- Focus on explicit indicators in the text, not assumptions
- For jurisdiction, return the COUNTRY name (e.g., "United States", "Switzerland")
- For party names, extract the actual company/entity name, not generic terms`;

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
          { role: "user", content: `Analyze this carbon credit offtake agreement excerpt and detect the metadata:\n\n${sampleText}` },
        ],
      }),
    });

    console.log("AI gateway response status:", response.status);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    let metadata;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      metadata = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      metadata = {
        project_name: null, carbon_type: null, project_stage: null,
        jurisdiction: null, buyer_name: null, seller_name: null,
        counterparty_type: null, framework: null,
        detection_notes: "Unable to parse document metadata",
      };
    }

    console.log("Detected carbon metadata:", metadata);

    return new Response(
      JSON.stringify(metadata),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error detecting carbon metadata:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
