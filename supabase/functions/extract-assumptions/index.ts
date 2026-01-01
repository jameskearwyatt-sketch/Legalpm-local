import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Standard assumption labels for consistent categorization across all matters
const ASSUMPTION_LABELS = [
  "Document Revisions",
  "Transaction Scope", 
  "Negotiation Style",
  "Timeline",
  "Counterparty Cooperation",
  "Jurisdiction",
  "Due Diligence",
  "Third Party Involvement",
  "Regulatory Approvals",
  "Complexity Level",
  "Language",
  "Disputes",
  "Financing Conditions",
  "Staffing",
  "Other"
];

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

    const systemPrompt = `You are an expert legal analyst specializing in law firm engagement letters and fee arrangements. Your task is to identify and extract the ASSUMPTIONS that underpin the fee estimate or fee cap in an engagement letter.

WHAT ARE ASSUMPTIONS?
Assumptions are the shared understandings that explain what a fee estimate is based on. They describe the expected shape, pace, and complexity of the work at the point the estimate is given. For example:
- Document revision limits (e.g., "assumes 3 rounds of mark-ups")
- Transaction proceeding as commercially agreed
- Negotiations conducted in a conventional, cooperative manner
- Deal completing within a reasonable timeframe
- Limited due diligence scope
- No unexpected regulatory issues

IMPORTANT INSTRUCTIONS:
1. Carefully read the engagement letter and identify ALL stated or implied assumptions
2. For each assumption, assign ONE label from this exact list: ${ASSUMPTION_LABELS.join(", ")}
3. Extract the actual text or paraphrase the assumption clearly
4. Be thorough - capture every assumption that could affect the fee estimate
5. If an assumption doesn't fit other categories, use "Other"

LABEL DEFINITIONS:
- Document Revisions: Limits on drafting rounds, mark-up iterations
- Transaction Scope: What's included/excluded from the work
- Negotiation Style: Expected behavior of parties (cooperative, conventional)
- Timeline: Expected duration, milestones, closing dates
- Counterparty Cooperation: Assumptions about other parties' responsiveness
- Jurisdiction: Geographic or legal jurisdiction scope
- Due Diligence: Scope and depth of review/investigation work
- Third Party Involvement: Assumptions about advisors, banks, regulators
- Regulatory Approvals: Expected regulatory processes
- Complexity Level: Assumed transaction complexity
- Language: Document language assumptions
- Disputes: Assumptions about no disputes arising
- Financing Conditions: Assumptions about financing arrangements
- Staffing: Team composition or availability assumptions
- Other: Anything that doesn't fit above categories`;

    const userPrompt = `Extract all fee-related assumptions from the following engagement letter text. Be thorough and capture every assumption that could affect the fee estimate.

Engagement Letter Text:
---
${text}
---

Extract and categorize all assumptions.`;

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
              description: "Extract and categorize assumptions from engagement letter",
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
                          description: "Category label for the assumption" 
                        },
                        assumption_text: { 
                          type: "string", 
                          description: "The actual assumption text or clear paraphrase" 
                        }
                      },
                      required: ["label", "assumption_text"],
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

    return new Response(JSON.stringify({ 
      assumptions: result.assumptions || [],
      labels: ASSUMPTION_LABELS 
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
