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

    const systemPrompt = `You are an expert legal billing analyst. Your task is to parse ANY text describing legal work and extract ALL identifiable work items as budget line items.

CRITICAL EXTRACTION RULE (HIGHEST PRIORITY):
- You MUST extract work items even from minimal, sparse, or informal text
- A numbered list like "1. Non-binding term sheet  2. Tolling agreement  3. Miscellaneous" contains THREE work items - extract ALL of them
- Even a SINGLE LINE describing a deliverable or task is a work item
- If the text mentions ANY legal document, agreement, review, analysis, negotiation, or deliverable, it IS a work item
- When in doubt, EXTRACT IT. It is FAR better to extract too many items than too few
- NEVER return an empty items array if the text contains ANY reference to legal work or deliverables

DETAIL PRESERVATION:
The "detail" field MUST contain the COMPLETE, VERBATIM, WORD-FOR-WORD text describing each work item from the source document.
- DO NOT summarize, shorten, or paraphrase the detail - COPY IT EXACTLY AS WRITTEN
- If the source says "Review and analysis of all material contracts including customer agreements, supplier contracts, distribution agreements, licensing arrangements, and any contracts with change of control provisions" - that ENTIRE text goes in detail VERBATIM
- The detail field should contain the FULL original text, not a condensed version
- If the source provides bullet points or sub-items, include ALL of them in detail
- The work_item field is a SHORT summary (max 50 chars), the detail field is the FULL ORIGINAL TEXT
- If the source text is very short (e.g., just "Non-binding term sheet"), use that as both work_item AND detail

PHASE DETECTION:
- Look for EXPLICIT phase indicators in the text: "Phase 1", "Phase 2", "PILOT PHASE", "MAIN PROGRAM PHASE", etc.
- Only create phases if the document explicitly mentions them
- Only leave phases empty if the document truly has NO phase structure

CATEGORY ASSIGNMENT (STRICT - USE ONLY THESE):
You MUST use ONLY these exact category values:
- "Due Diligence" (for review, analysis, investigation work)
- "Documentation" (for drafting, reviewing transaction documents, agreements, term sheets)
- "Negotiations" (for negotiation support, term sheet work)
- "Meetings" (for calls, meetings, coordination)
- "Regulatory" (for regulatory filings, approvals, compliance)
- "Closing" (for closing mechanics, completion activities)
- "Tax" (for tax advice, structuring, opinions)
- "Legal Opinions" (for formal legal opinions)
- "Other" (ONLY if none of the above fit)

PROVIDER DETECTION:
- Default to "Baker McKenzie" unless text explicitly mentions local counsel
- "Local Counsel" for local law firm, in-country counsel, domestic counsel references

FEE EXTRACTION:
- For ranges like "$50,000 - $75,000", use the UPPER END (75000)
- If fees are percentages or hourly, estimate or use 0
- If NO fee information is provided, use 0`;

    const userPrompt = `Parse the following text and extract ALL work items. Even if the text is short or sparse, extract every identifiable deliverable, document, agreement, or task as a separate work item. A simple numbered list of items should result in one work item per numbered entry.

CRITICAL: Do NOT return an empty items array. If you see text like "1. Term sheet  2. Agreement  3. Review" - those are THREE work items.

INSTRUCTIONS:
1. DETAIL FIELD: Copy the EXACT ORIGINAL TEXT into the "detail" field for each item.
2. PHASES: Only create phases if the text explicitly mentions them.
3. CATEGORIES: Use ONLY: "Due Diligence", "Documentation", "Negotiations", "Meetings", "Regulatory", "Closing", "Tax", "Legal Opinions", "Other"

Currency context: ${currency || 'GBP'}

Text to parse:
---
${text}
---

Remember: Extract EVERY work item. Even minimal text like "Non-binding term sheet" is a valid work item.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro", // Use Pro model for better instruction following
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
    
    // Log sample items to verify detail field is populated
    if (result.items?.length > 0) {
      const sampleItem = result.items[0];
      console.log("Sample item - work_item:", sampleItem.work_item?.substring(0, 50));
      console.log("Sample item - detail length:", sampleItem.detail?.length || 0);
      console.log("Sample item - phase_id:", sampleItem.phase_id);
      console.log("Sample item - category:", sampleItem.category);
    }

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
