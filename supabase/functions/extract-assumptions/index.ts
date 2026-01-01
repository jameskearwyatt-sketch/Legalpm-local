import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Refined assumption categories with clear, non-overlapping definitions
const ASSUMPTION_LABELS = [
  "Document Drafting",
  "Document Negotiation", 
  "Transaction Structure",
  "Transaction Timeline",
  "Due Diligence Scope",
  "Counterparty Conduct",
  "Third Party Approvals",
  "Regulatory & Compliance",
  "Jurisdiction & Governing Law",
  "Financing Arrangements",
  "Disputes & Litigation",
  "Staffing & Resourcing",
  "Client Responsibilities",
  "Excluded Work",
  "Other"
];

// Detailed category definitions for AI guidance
const CATEGORY_DEFINITIONS = {
  "Document Drafting": {
    description: "Assumptions about document creation, revision rounds, and drafting complexity",
    examples: [
      "Maximum number of document drafts or revisions",
      "Use of standard/template documents vs bespoke drafting",
      "Single language documentation",
      "Reasonable length/complexity of agreements"
    ],
    keywords: ["draft", "revision", "mark-up", "turn", "iteration", "template", "standard form", "bespoke"]
  },
  "Document Negotiation": {
    description: "Assumptions about the negotiation process and style between parties",
    examples: [
      "Negotiations conducted in cooperative manner",
      "Commercial points already agreed",
      "No fundamental renegotiation of terms",
      "Single counterparty (not multiple)"
    ],
    keywords: ["negotiate", "cooperative", "commercial terms", "agreed", "conventional", "adversarial"]
  },
  "Transaction Structure": {
    description: "Assumptions about the nature, scope and structure of the deal itself",
    examples: [
      "Single jurisdiction transaction",
      "Standard deal structure with no unusual features",
      "No post-completion price adjustment mechanisms",
      "No earn-out or deferred consideration"
    ],
    keywords: ["structure", "scope", "transaction", "deal", "arrangement", "mechanism", "straightforward"]
  },
  "Transaction Timeline": {
    description: "Assumptions about timing, deadlines, and duration of the matter",
    examples: [
      "Completion within X months",
      "No requirement for urgent/expedited work",
      "Normal business hours working",
      "No extended pauses or delays"
    ],
    keywords: ["timeline", "completion", "deadline", "duration", "expedited", "urgent", "months", "weeks"]
  },
  "Due Diligence Scope": {
    description: "Assumptions about investigation, review and verification work",
    examples: [
      "Limited/proportionate due diligence",
      "No title investigation required",
      "Reliance on vendor due diligence",
      "Data room review only (no site visits)"
    ],
    keywords: ["due diligence", "review", "investigation", "verification", "data room", "disclosure"]
  },
  "Counterparty Conduct": {
    description: "Assumptions about how the other party/parties will behave and respond",
    examples: [
      "Counterparty responds promptly to queries",
      "Experienced counterparty counsel",
      "No unreasonable delays from other side",
      "Counterparty has authority to proceed"
    ],
    keywords: ["counterparty", "other side", "seller", "buyer", "respond", "cooperat", "delay"]
  },
  "Third Party Approvals": {
    description: "Assumptions about consents, approvals and involvement of third parties (non-regulatory)",
    examples: [
      "No landlord consents required",
      "No third party financing conditions",
      "Lender cooperation assumed",
      "No minority shareholder issues"
    ],
    keywords: ["third party", "consent", "approval", "lender", "bank", "landlord", "shareholder"]
  },
  "Regulatory & Compliance": {
    description: "Assumptions about regulatory approvals, filings, and compliance matters",
    examples: [
      "No competition/antitrust filings required",
      "No FDI/national security review",
      "Standard regulatory approval timeline",
      "No sanctions or export control issues"
    ],
    keywords: ["regulatory", "compliance", "filing", "approval", "competition", "antitrust", "FDI", "sanction"]
  },
  "Jurisdiction & Governing Law": {
    description: "Assumptions about applicable law, jurisdiction, and geographic scope",
    examples: [
      "English law governed documents",
      "Single jurisdiction matters only",
      "No cross-border elements requiring local advice",
      "No novel legal issues"
    ],
    keywords: ["jurisdiction", "governing law", "English law", "cross-border", "local counsel", "foreign"]
  },
  "Financing Arrangements": {
    description: "Assumptions about financing, funding, and payment structures",
    examples: [
      "Transaction funded from existing facilities",
      "No complex financing structures",
      "No intercreditor issues",
      "No equity fundraising required"
    ],
    keywords: ["financing", "funding", "loan", "facility", "equity", "debt", "intercreditor"]
  },
  "Disputes & Litigation": {
    description: "Assumptions about absence of disputes, claims, or contentious matters",
    examples: [
      "No disputes arise during the transaction",
      "No threatened or actual litigation",
      "No warranty claims anticipated",
      "No employment disputes"
    ],
    keywords: ["dispute", "litigation", "claim", "contentious", "warranty", "indemnity"]
  },
  "Staffing & Resourcing": {
    description: "Assumptions about team composition, availability, and working patterns",
    examples: [
      "Appropriate fee-earner mix available",
      "No requirement for partner attendance at all meetings",
      "Normal working hours (no weekend work)",
      "Existing team familiarity with client"
    ],
    keywords: ["staff", "team", "partner", "associate", "resource", "availability", "hours"]
  },
  "Client Responsibilities": {
    description: "Assumptions about what the client will provide, do, or be responsible for",
    examples: [
      "Client provides complete and accurate information",
      "Client responds promptly to requests",
      "Client coordinates other advisors",
      "Client has appropriate internal authority"
    ],
    keywords: ["client", "you", "provide", "instruction", "internal", "board", "management"]
  },
  "Excluded Work": {
    description: "Work explicitly not covered by the fee estimate",
    examples: [
      "Tax advice excluded",
      "IP due diligence not included",
      "Environmental surveys not covered",
      "Post-completion matters separate"
    ],
    keywords: ["exclude", "not include", "not cover", "separate", "additional", "outside scope"]
  },
  "Other": {
    description: "Assumptions that don't fit neatly into other categories",
    examples: [
      "Market conditions remain stable",
      "No material adverse changes",
      "Force majeure events do not occur"
    ],
    keywords: []
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'No text provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Extracting assumptions from engagement letter, text length:", text.length);

    // Build detailed category guidance for the AI
    const categoryGuidance = Object.entries(CATEGORY_DEFINITIONS)
      .map(([label, def]) => {
        const examples = def.examples.map(e => `  - "${e}"`).join('\n');
        return `**${label}**: ${def.description}\nExamples:\n${examples}`;
      })
      .join('\n\n');

    const systemPrompt = `You are an expert legal analyst specializing in law firm engagement letters and fee arrangements. Your task is to extract ASSUMPTIONS that underpin fee estimates with PRECISE categorization.

## WHAT ARE ASSUMPTIONS?
Assumptions are the conditions, expectations, and limitations that define the basis of a fee estimate. They explain what the fee covers and what circumstances would cause the fee to change. Good assumptions are:
- SPECIFIC: "Maximum 3 rounds of mark-ups" not "reasonable revisions"
- ACTIONABLE: Clear enough to reference if the assumption breaks down
- COMPLETE: Captures the full scope limitation

## CATEGORIZATION RULES
You MUST categorize each assumption into EXACTLY ONE category. Choose the category that best matches the PRIMARY nature of the assumption:

${categoryGuidance}

## CRITICAL INSTRUCTIONS
1. READ CAREFULLY: Many assumptions are embedded in fee paragraphs, scope sections, or caveats
2. BE PRECISE: Extract the actual language or paraphrase clearly
3. AVOID OVERLAP: Each assumption belongs to ONE category - pick the most specific match
4. AVOID DUPLICATES: Don't extract the same assumption twice with different wording
5. NORMALIZE TEXT: Clean up the assumption text to be clear, standalone statements
6. IDENTIFY PATTERNS: Common assumptions often appear as "we assume...", "this assumes...", "on the basis that...", "subject to...", "excludes...", "does not cover..."
7. CHECK EXCLUSIONS: Work described as "excluded" or "not covered" goes in "Excluded Work"
8. FLAG REUSABILITY: Mark assumptions that are STANDARD (commonly used across similar deals) vs BESPOKE (specific to this transaction)`;

    const userPrompt = `Extract ALL fee-related assumptions from this engagement letter. Be thorough - look in fee sections, scope sections, caveats, and general terms.

For each assumption:
1. Categorize it precisely using the category definitions provided
2. Extract or clearly paraphrase the assumption text
3. Indicate if it's a STANDARD assumption (commonly reusable) or BESPOKE (specific to this deal)

Engagement Letter:
---
${text}
---`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "extract_assumptions",
              description: "Extract and categorize assumptions from engagement letter with reusability flag",
              parameters: {
                type: "object",
                properties: {
                  assumptions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { 
                          type: "string", 
                          enum: ASSUMPTION_LABELS,
                          description: "The single best-fit category for this assumption" 
                        },
                        assumption_text: { 
                          type: "string", 
                          description: "Clear, standalone statement of the assumption (normalized text, not raw quotes with ellipses)" 
                        },
                        is_standard: {
                          type: "boolean",
                          description: "True if this is a commonly reusable standard assumption, false if bespoke to this specific deal"
                        }
                      },
                      required: ["label", "assumption_text", "is_standard"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["assumptions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_assumptions" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_assumptions") {
      console.error("Unexpected response format:", JSON.stringify(data));
      throw new Error("Failed to extract assumptions");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("Extracted assumptions:", result.assumptions?.length || 0);

    // Deduplicate assumptions by normalized text
    const seen = new Set<string>();
    const dedupedAssumptions = (result.assumptions || []).filter((a: { assumption_text: string }) => {
      const normalized = a.assumption_text.toLowerCase().trim();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

    console.log("After deduplication:", dedupedAssumptions.length);

    return new Response(JSON.stringify({ 
      assumptions: dedupedAssumptions,
      labels: ASSUMPTION_LABELS,
      category_definitions: CATEGORY_DEFINITIONS
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-assumptions:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});