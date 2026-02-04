import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Pilot categories for extraction
const PILOT_CATEGORIES = [
  {
    id: 'pricing_structure',
    label: 'Pricing Structure',
    bibleReference: 'Section 2.1 - Pricing Mechanisms',
    extractionHints: 'Look for: fixed price, floating price, floor/cap, indexation, price per MWh, contract price',
  },
  {
    id: 'seller_credit_support',
    label: 'Credit Support (Seller)',
    bibleReference: 'Section 5.2 - Seller Credit Support',
    extractionHints: 'Look for: parent company guarantee, PCG, letter of credit, performance bond, security deposit from seller',
  },
  {
    id: 'buyer_credit_support',
    label: 'Credit Support (Buyer)',
    bibleReference: 'Section 5.3 - Buyer Credit Support',
    extractionHints: 'Look for: buyer security, credit rating requirements, payment security, collateral, LC from buyer',
  },
  {
    id: 'delay_liquidated_damages',
    label: 'Delay Liquidated Damages',
    bibleReference: 'Section 3.1 - Delay LDs',
    extractionHints: 'Look for: delay LD, daily rate for delays, pre-COD compensation, delay cap, longstop',
  },
  {
    id: 'availability_guarantee',
    label: 'Availability Guarantee',
    bibleReference: 'Section 4.1 - Availability',
    extractionHints: 'Look for: minimum availability, availability guarantee percentage, underperformance, availability calculation',
  },
  {
    id: 'contract_term',
    label: 'Contract Term',
    bibleReference: 'Section 1.1 - Term',
    extractionHints: 'Look for: term, duration, years, COD, commercial operation date, start date, end date, extension',
  },
  {
    id: 'payment_terms',
    label: 'Payment Terms',
    bibleReference: 'Section 5.1 - Payment',
    extractionHints: 'Look for: payment, invoice, payment period, days to pay, interest on late payment, billing cycle',
  },
  {
    id: 'force_majeure',
    label: 'Force Majeure',
    bibleReference: 'Section 6.1 - Force Majeure',
    extractionHints: 'Look for: force majeure, FM, relief event, excused performance, suspension of obligations',
  },
  {
    id: 'change_in_law',
    label: 'Change in Law',
    bibleReference: 'Section 6.2 - Change in Law',
    extractionHints: 'Look for: change in law, legislative change, regulatory change, reopener, cost allocation',
  },
  {
    id: 'curtailment',
    label: 'Curtailment',
    bibleReference: 'Section 4.2 - Curtailment',
    extractionHints: 'Look for: curtailment, grid curtailment, dispatch down, constrained off, curtailment compensation',
  },
  {
    id: 'termination_rights',
    label: 'Termination Rights',
    bibleReference: 'Section 8.1 - Termination',
    extractionHints: 'Look for: termination, event of default, cure period, termination payment, early termination',
  },
  {
    id: 'green_certificates',
    label: 'Green Certificates / REGOs',
    bibleReference: 'Section 7.1 - Environmental Attributes',
    extractionHints: 'Look for: REGO, green certificate, renewable certificate, environmental attribute, GOs, guarantees of origin',
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ppaText, comparisonText, analysisType, perspective, jurisdiction, projectName } = await req.json();

    if (!ppaText) {
      return new Response(
        JSON.stringify({ error: 'PPA text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the extraction prompt
    const categoryList = PILOT_CATEGORIES.map(c => 
      `- ${c.label} (id: ${c.id}): ${c.extractionHints}`
    ).join('\n');

    const systemPrompt = `You are an expert PPA (Power Purchase Agreement) analyst specializing in European renewable energy contracts. 
Your task is to extract key positions from the provided PPA document for each category.

PERSPECTIVE: You are analyzing from the ${perspective === 'buyer' ? 'Buyer (Offtaker)' : 'Seller (Generator)'} perspective.
${jurisdiction ? `JURISDICTION: ${jurisdiction}` : ''}
${analysisType === 'ppa_vs_termsheet' && comparisonText ? 'You should also compare against the provided term sheet.' : ''}

For each category, you must:
1. Find the relevant clause(s) in the PPA
2. Summarize the position in 1-3 sentences
3. Quote a brief source excerpt (max 100 chars)
4. Assess confidence: "high" (clear clause found), "medium" (inferred from related language), "review_required" (not found or ambiguous)

CATEGORIES TO EXTRACT:
${categoryList}

IMPORTANT RULES:
- Extract positions exactly as stated in the document - do not infer or assume
- If a category is not addressed in the document, set confidence to "review_required" and note it wasn't found
- Keep position summaries concise but include key numbers, percentages, and terms
- For the Bible reference, use the provided reference for each category`;

    const userPrompt = `Please analyze the following PPA and extract positions for each category.

PROJECT: ${projectName}

PPA DOCUMENT TEXT:
${ppaText.substring(0, 80000)}

${comparisonText ? `
TERM SHEET / COMPARISON DOCUMENT:
${comparisonText.substring(0, 30000)}
` : ''}

Return a JSON object with this structure:
{
  "positions": [
    {
      "category": "category_label",
      "position_summary": "summary of the position",
      "source_text": "brief quote from document",
      "confidence": "high|medium|review_required",
      "bible_reference": "Section X.X - Reference",
      "comparison_position": "if comparing, what the term sheet says",
      "variance_notes": "if comparing, key differences"
    }
  ]
}`;

    console.log('Calling AI gateway for PPA analysis...');

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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response received, parsing...');

    // Parse the JSON from the response
    let positions = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*"positions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        positions = parsed.positions || [];
      } else {
        console.error('No JSON found in response:', content.substring(0, 500));
        throw new Error('Could not parse AI response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Return empty positions if parsing fails
      positions = PILOT_CATEGORIES.map(c => ({
        category: c.label,
        position_summary: 'Failed to extract - please review document manually',
        source_text: null,
        confidence: 'review_required',
        bible_reference: c.bibleReference,
        comparison_position: null,
        variance_notes: null,
      }));
    }

    // Ensure all categories have entries
    const existingCategories = new Set(positions.map((p: any) => p.category));
    for (const cat of PILOT_CATEGORIES) {
      if (!existingCategories.has(cat.label)) {
        positions.push({
          category: cat.label,
          position_summary: 'Not found in document',
          source_text: null,
          confidence: 'review_required',
          bible_reference: cat.bibleReference,
          comparison_position: null,
          variance_notes: null,
        });
      }
    }

    return new Response(
      JSON.stringify({ positions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-ppa:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
