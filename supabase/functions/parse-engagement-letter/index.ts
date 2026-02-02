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

CRITICAL - DETAIL PRESERVATION (MOST IMPORTANT):
The "detail" field MUST contain the COMPLETE, VERBATIM text describing each work item from the source document. 
- DO NOT summarize or shorten the detail
- DO NOT paraphrase - copy the exact text
- Include ALL bullet points, sub-items, clarifications, and specifics
- If the source says "Due diligence on target company including review of all material contracts, employment agreements, IP portfolio, real estate leases, and pending litigation" - that ENTIRE sentence goes in detail
- The detail field should be LONGER than the work_item field, not shorter or empty

PHASE DETECTION:
- Look for explicit phase indicators: "Phase 1", "Phase 2", "Pilot Phase", "Main Transaction", "Initial Phase", "Completion Phase", etc.
- If the document organizes work into distinct phases, extract the phase name for each item
- If NO phases are mentioned, leave phase_name as null (assume single transaction)
- Common phase patterns: numbered phases, named stages, pre/post signing, pilot vs main

CATEGORY ASSIGNMENT:
- Assign each item to a category based on document structure or work type
- Common categories: "Due Diligence", "Transaction Documents", "Tax", "Regulatory", "Employment", "IP", "Real Estate", "Competition/Antitrust", "Financing", "Corporate", "Post-Completion", "Project Management"
- If the document groups items under headings, use those headings as categories
- If unclear, infer from the work description (e.g., "review contracts" → "Due Diligence", "draft SPA" → "Transaction Documents")

WORK_ITEM vs DETAIL:
- work_item: SHORT summary (max 50 chars) - just a heading like "Due diligence review" or "Draft SPA"
- detail: FULL verbatim text from source - everything the document says about this item

PROVIDER DETECTION:
- "Baker McKenzie" for main firm work
- "Local Counsel" for local law firm, in-country counsel, domestic counsel references

FEE EXTRACTION:
- For ranges like "$50,000 - $75,000", use the UPPER END (75000)
- If fees are percentages or hourly, estimate or use 0`;

    const userPrompt = `Parse the following engagement letter/fee arrangement and extract budget line items. 

CRITICAL INSTRUCTIONS:
1. For EACH work item, the "detail" field MUST contain the FULL original text - do NOT leave it empty or summarize
2. If the document mentions phases (Phase 1, Phase 2, Pilot, Main Transaction, etc.), assign items to those phases
3. Assign a category to each item based on document structure or work type

Currency context: ${currency || 'GBP'}

Text to parse:
---
${text}
---

Return ALL extracted items with complete detail preserved.`;

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
                          description: "CRITICAL: The COMPLETE, VERBATIM text from the source document. DO NOT summarize. Include all bullet points, sub-items, specifics. This should be LONGER than work_item, not empty."
                        },
                        category: {
                          type: "string",
                          description: "Category for this item. Use document headings if available, or infer: Due Diligence, Transaction Documents, Tax, Regulatory, Employment, IP, Real Estate, Competition/Antitrust, Financing, Corporate, Post-Completion, Project Management, Other"
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
