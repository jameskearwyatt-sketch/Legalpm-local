import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { text, currency } = await req.json();
    
    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'No text provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Parsing engagement letter text, length:", text.length);

    const systemPrompt = `You are an expert legal billing analyst. Your task is to parse engagement letter or fee arrangement text and extract budget line items WITH FULL DETAIL.

CRITICAL - DETAIL PRESERVATION (HIGHEST PRIORITY):
The "detail" field MUST contain the COMPLETE, VERBATIM, WORD-FOR-WORD text describing each work item from the source document.
- DO NOT summarize, shorten, or paraphrase the detail - COPY IT EXACTLY AS WRITTEN
- If the source says "Review and analysis of all material contracts including customer agreements, supplier contracts, distribution agreements, licensing arrangements, and any contracts with change of control provisions" - that ENTIRE text goes in detail VERBATIM
- The detail field should contain the FULL original text, not a condensed version
- If the source provides bullet points or sub-items, include ALL of them in detail
- The work_item field is a SHORT summary (max 50 chars), the detail field is the FULL ORIGINAL TEXT
- NEVER leave detail empty if there is descriptive text about the work item

PHASE DETECTION (VERY IMPORTANT):
- Look for EXPLICIT phase indicators in the text: "Phase 1", "Phase 2", "PILOT PHASE", "MAIN PROGRAM PHASE", "Main Transaction", "Initial Phase", "Completion Phase", etc.
- Phases are often marked with headings in CAPS, bold formatting indicators, or numbered sections
- If you see text like "PILOT PHASE" followed by work items, then "MAIN PROGRAM PHASE" followed by more work items, those are TWO DISTINCT PHASES
- Create a phase entry for EACH distinct phase mentioned and assign work items to the correct phase
- Only leave phases empty if the document truly has NO phase structure (just one continuous list of work)

CATEGORY ASSIGNMENT (STRICT - USE ONLY THESE):
You MUST use ONLY these exact category values - no variations, no synonyms, no invented categories:
- "Due Diligence" (for review, analysis, investigation work)
- "Documentation" (for drafting, reviewing transaction documents, agreements)
- "Negotiations" (for negotiation support, term sheet work)
- "Meetings" (for calls, meetings, coordination)
- "Regulatory" (for regulatory filings, approvals, compliance)
- "Closing" (for closing mechanics, completion activities)
- "Tax" (for tax advice, structuring, opinions)
- "Legal Opinions" (for formal legal opinions)
- "Other" (ONLY if none of the above fit)

DO NOT invent categories like "Transaction Documents", "Project Management", "Employment", "IP", etc. - map these to the closest valid category or use "Other".

WORK_ITEM vs DETAIL:
- work_item: SHORT heading only (max 50 chars) - e.g., "Due diligence on contracts"
- detail: The FULL, VERBATIM, UNEDITED text from source describing this work item

PROVIDER DETECTION:
- "Baker McKenzie" for main firm work
- "Local Counsel" for local law firm, in-country counsel, domestic counsel references

FEE EXTRACTION:
- For ranges like "$50,000 - $75,000", use the UPPER END (75000)
- If fees are percentages or hourly, estimate or use 0`;

    const userPrompt = `Parse the following engagement letter/fee arrangement and extract budget line items.

CRITICAL INSTRUCTIONS - READ CAREFULLY:

1. DETAIL FIELD: For EACH work item, COPY THE EXACT ORIGINAL TEXT into the "detail" field. Do NOT summarize or shorten. The detail must be the VERBATIM text from the source document. If the source says "Comprehensive review of all target company material contracts, including but not limited to customer agreements, vendor contracts, and licensing arrangements, with particular focus on change of control provisions and assignability", that ENTIRE sentence goes in detail WORD FOR WORD.

2. PHASES: Look for phase headings like "PILOT PHASE", "MAIN PROGRAM PHASE", "Phase 1", "Phase 2", etc. If you see these, create separate phase entries and assign each work item to its correct phase. The text structure shows which items belong to which phase.

3. CATEGORIES: Use ONLY these exact values: "Due Diligence", "Documentation", "Negotiations", "Meetings", "Regulatory", "Closing", "Tax", "Legal Opinions", "Other". Do NOT use any other category names.

Currency context: ${currency || 'GBP'}

Text to parse:
---
${text}
---

Remember: The detail field must contain the COMPLETE original text, not a summary. Copy it exactly.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_budget_items",
              description: "Extract budget line items from engagement letter text. You MUST extract ALL billable work items with COMPLETE detail preserved. The detail field must contain the full verbatim text, not a summary.",
              parameters: {
                type: "object",
                properties: {
                  phases: {
                    type: "array",
                    description: "Array of phases detected in the document. Only include if the document explicitly mentions phases (Phase 1, Pilot, Main Transaction, etc.). Leave empty array if no phases.",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Unique ID for the phase (e.g., 'phase_1', 'pilot')" },
                        name: { type: "string", description: "Phase name as it appears in the document" }
                      },
                      required: ["id", "name"],
                      additionalProperties: false
                    }
                  },
                  items: {
                    type: "array",
                    description: "Array of ALL work items. Each MUST have complete detail preserved.",
                    items: {
                      type: "object",
                      properties: {
                        work_item: { 
                          type: "string", 
                          description: "SHORT heading only (max 50 chars). Example: 'Due diligence review'" 
                        },
                        detail: {
                          type: "string",
                          description: "CRITICAL: COPY THE EXACT, WORD-FOR-WORD text from the source document. This must be the FULL ORIGINAL TEXT, not a summary. If the source has a paragraph describing the work, copy that entire paragraph verbatim."
                        },
                        category: {
                          type: "string",
                          enum: ["Due Diligence", "Documentation", "Negotiations", "Meetings", "Regulatory", "Closing", "Tax", "Legal Opinions", "Other"],
                          description: "Category for this item. MUST be one of the enum values. Map 'Transaction Documents' to 'Documentation', 'Project Management' to 'Other', etc."
                        },
                        phase_id: {
                          type: "string",
                          description: "ID of the phase this item belongs to (matches phases[].id). Null if no phases or item is not phase-specific."
                        },
                        provider: { 
                          type: "string", 
                          enum: ["Baker McKenzie", "Local Counsel"],
                          description: "Who performs this work" 
                        },
                        fee_amount: { 
                          type: "number", 
                          description: "Upper end fee amount (0 if unknown)" 
                        }
                      },
                      required: ["work_item", "detail", "category", "provider", "fee_amount"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["phases", "items"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_budget_items" } }
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

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_budget_items") {
      console.error("Unexpected response format:", JSON.stringify(data));
      throw new Error("Failed to parse engagement letter");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("Extracted phases:", result.phases?.length || 0);
    console.log("Extracted items:", result.items?.length || 0);

    return new Response(JSON.stringify({ 
      phases: result.phases || [], 
      items: result.items || [] 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in parse-engagement-letter:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your request. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
