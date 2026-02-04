import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Enhanced categories with deeper extraction requirements
const PILOT_CATEGORIES = [
  {
    id: 'pricing_structure',
    label: 'Pricing Structure',
    bibleReference: 'Section 2.1 - Pricing Mechanisms',
    extractionRequirements: `MUST EXTRACT:
• Price mechanism (fixed/floating/hybrid)
• Price per MWh (exact figure)
• Indexation mechanism (if any) - what index, frequency, formula
• Price floor and/or cap (if any)
• Escalation provisions
• Any price reopener triggers`,
  },
  {
    id: 'seller_credit_support',
    label: 'Credit Support (Seller)',
    bibleReference: 'Section 5.2 - Seller Credit Support',
    extractionRequirements: `MUST EXTRACT for EACH time period:
• Pre-COD credit support: type, amount, form (PCG/LC/bond)
• Post-COD credit support: type, amount, form
• If NO credit support for any period, FLAG THIS CLEARLY
• Credit rating thresholds that trigger additional security
• Acceptable forms of security (LC issuer requirements)
• Release/step-down provisions`,
  },
  {
    id: 'buyer_credit_support',
    label: 'Credit Support (Buyer)',
    bibleReference: 'Section 5.3 - Buyer Credit Support',
    extractionRequirements: `MUST EXTRACT for EACH time period:
• Pre-COD credit support: type, amount, form
• Post-COD credit support: type, amount, form
• If NO credit support for any period, FLAG THIS CLEARLY
• Credit rating thresholds
• Parent company guarantee requirements
• Payment security arrangements`,
  },
  {
    id: 'delay_liquidated_damages',
    label: 'Delay Liquidated Damages',
    bibleReference: 'Section 3.1 - Delay LDs',
    extractionRequirements: `MUST EXTRACT:
• Daily/weekly LD rate (exact figures)
• LD cap (as % or absolute amount)
• Grace period before LDs accrue
• Longstop date and consequences
• Deemed COD provisions (if any)
• Exclusions from delay (FM, buyer delays)`,
  },
  {
    id: 'availability_guarantee',
    label: 'Availability Guarantee',
    bibleReference: 'Section 4.1 - Availability',
    extractionRequirements: `MUST EXTRACT:
• Guaranteed availability % (annual/lifetime)
• Availability calculation methodology
• Consequences of underperformance (LDs, termination)
• Availability LD rate (£/MWh shortfall)
• Exclusions from calculation
• Bonus provisions for over-performance (if any)`,
  },
  {
    id: 'contract_term',
    label: 'Contract Term',
    bibleReference: 'Section 1.1 - Term',
    extractionRequirements: `MUST EXTRACT:
• Total term length (years)
• Term commencement trigger (signing/COD)
• Target COD date
• Extension rights (who holds, conditions, length)
• Early termination for convenience (if any)`,
  },
  {
    id: 'payment_terms',
    label: 'Payment Terms',
    bibleReference: 'Section 5.1 - Payment',
    extractionRequirements: `MUST EXTRACT:
• Billing frequency (monthly/quarterly)
• Payment period (X days from invoice)
• Interest rate on late payment
• Disputed invoice procedure
• Netting/set-off rights`,
  },
  {
    id: 'force_majeure',
    label: 'Force Majeure',
    bibleReference: 'Section 6.1 - Force Majeure',
    extractionRequirements: `MUST EXTRACT:
• Definition scope (what is/isn't FM)
• Notification requirements
• Duration before termination right arises
• Financial consequences during FM period
• Specific exclusions (grid events, price changes)`,
  },
  {
    id: 'change_in_law',
    label: 'Change in Law',
    bibleReference: 'Section 6.2 - Change in Law',
    extractionRequirements: `MUST EXTRACT:
• Definition of qualifying change (discriminatory/general/tax)
• Mechanism: How do parties address it? (negotiation, adjustment formula, termination)
• Cost allocation: Who bears what costs?
• Timeframe for reaching agreement
• Fallback if agreement not reached (arbitration, termination, specific formula)
• Material adverse threshold (if any)`,
  },
  {
    id: 'curtailment',
    label: 'Curtailment',
    bibleReference: 'Section 4.2 - Curtailment',
    extractionRequirements: `MUST EXTRACT:
• Voluntary curtailment: buyer's right to curtail, compensation payable
• Involuntary curtailment (grid/dispatch down): 
  - Is buyer compensated? At what rate?
  - Does it count toward volume commitments?
  - Cap on curtailment hours/MWh
• REGO treatment during curtailment:
  - Does buyer still receive/pay for REGOs on curtailed volumes?
  - Deemed generation for REGO purposes
• Compensation formula (lost revenue, deemed price)`,
  },
  {
    id: 'termination_rights',
    label: 'Termination Rights',
    bibleReference: 'Section 8.1 - Termination',
    extractionRequirements: `MUST EXTRACT:
• Events of default (list key triggers)
• Cure periods for each default type
• Termination payment calculation methodology
• Who pays whom on termination (defaulting vs non-defaulting)
• Specific termination triggers (prolonged FM, insolvency, material breach)`,
  },
  {
    id: 'green_certificates',
    label: 'Green Certificates / REGOs',
    bibleReference: 'Section 7.1 - Environmental Attributes',
    extractionRequirements: `MUST EXTRACT:
• What attributes transfer (REGOs, GOs, carbon credits)
• Price bundled or separate
• Shortfall remedies (damages, buy-out, replacement)
• REGO shortfall price/penalty
• Timing of transfer (when must REGOs be delivered)
• Additionality provisions (if relevant)`,
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

    // Build enhanced extraction prompt
    const categoryList = PILOT_CATEGORIES.map(c => 
      `### ${c.label} (id: ${c.id})
${c.extractionRequirements}`
    ).join('\n\n');

    const systemPrompt = `You are an expert PPA (Power Purchase Agreement) analyst specializing in European renewable energy contracts.
Your task is to extract ACTIONABLE, SPECIFIC positions from the provided PPA document.

PERSPECTIVE: ${perspective === 'buyer' ? 'Buyer (Offtaker)' : 'Seller (Generator)'}
${jurisdiction ? `JURISDICTION: ${jurisdiction}` : ''}

## OUTPUT REQUIREMENTS

For each category you MUST:

1. **Clause References**: List the specific clause numbers where provisions are found (e.g., "Clause 8.2, Schedule 3 para 2.1")
2. **Position Summary**: Use SHORT BULLET POINTS, not narrative paragraphs:
   • Each bullet = one specific provision or term
   • Include exact figures, percentages, amounts
   • Be CONCLUSIVE - tell the user WHAT the contract says, not just THAT it has provisions
   • Flag gaps or unusual terms
3. **Confidence**: "high" (clear clauses), "medium" (inferred), "review_required" (not found/ambiguous)

## CRITICAL INSTRUCTIONS

- DO NOT write narrative summaries like "The document outlines mechanisms for..."
- DO write specific conclusions like "• Seller must provide £500k LC pre-COD; NO post-COD security required ⚠️"
- If something is MISSING that would normally be expected, FLAG IT with ⚠️
- For Credit Support: ALWAYS distinguish pre-COD vs post-COD periods
- For Curtailment: ALWAYS address involuntary curtailment compensation and REGO treatment
- For Change in Law: ALWAYS explain the actual mechanism, not just that one exists

## CATEGORIES TO EXTRACT

${categoryList}`;

    const userPrompt = `Analyze this PPA and extract positions for each category following the requirements above.

PROJECT: ${projectName}

PPA DOCUMENT TEXT:
${ppaText.substring(0, 80000)}

${comparisonText ? `
TERM SHEET / COMPARISON DOCUMENT:
${comparisonText.substring(0, 30000)}
` : ''}

Return a JSON object:
{
  "positions": [
    {
      "category": "Category Label",
      "clause_references": "Clause X.X, Schedule Y para Z",
      "position_summary": "• Bullet point 1\\n• Bullet point 2\\n• Bullet point 3",
      "confidence": "high|medium|review_required",
      "bible_reference": "Section X.X - Reference",
      "flags": "⚠️ Any concerns or gaps to flag (optional)"
    }
  ]
}

REMEMBER: Be SPECIFIC and CONCLUSIVE. Extract the actual terms, not just that terms exist.`;

    console.log('Calling AI gateway for enhanced PPA analysis...');

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
        temperature: 0.2, // Lower temperature for more precise extraction
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
      const jsonMatch = content.match(/\{[\s\S]*"positions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        positions = parsed.positions || [];
        
        // Transform to match expected format, keeping clause_references instead of source_text
        positions = positions.map((p: any) => ({
          category: p.category,
          position_summary: p.position_summary,
          source_text: p.clause_references || null, // Store clause refs in source_text field
          confidence: p.confidence || 'review_required',
          bible_reference: p.bible_reference || PILOT_CATEGORIES.find(c => c.label === p.category)?.bibleReference,
          comparison_position: p.comparison_position || null,
          variance_notes: p.flags || p.variance_notes || null,
        }));
      } else {
        console.error('No JSON found in response:', content.substring(0, 500));
        throw new Error('Could not parse AI response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      positions = PILOT_CATEGORIES.map(c => ({
        category: c.label,
        position_summary: '• Failed to extract - please review document manually',
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
          position_summary: '• Not found in document',
          source_text: null,
          confidence: 'review_required',
          bible_reference: cat.bibleReference,
          comparison_position: null,
          variance_notes: '⚠️ Category not addressed in PPA',
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
