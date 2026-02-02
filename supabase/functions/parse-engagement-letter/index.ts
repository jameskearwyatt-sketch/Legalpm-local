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

    const systemPrompt = `You are an expert legal billing analyst. Your task is to parse engagement letter or fee arrangement text and extract budget line items.

CRITICAL CONSISTENCY RULES - YOU MUST FOLLOW THESE EXACTLY:

GRANULARITY RULES (follow precisely):
1. Extract work items at the TASK level, not the phase level or sub-task level
2. A "task" is a discrete billable activity (e.g., "Due diligence review", "Draft SPA", "Negotiate ancillary documents")
3. DO NOT split into sub-tasks (e.g., don't split "Due diligence" into "Review contracts", "Review IP", "Review employment" unless the document explicitly prices them separately)
4. DO NOT merge tasks into phases (e.g., don't combine "Draft SPA" and "Negotiate SPA" into just "SPA work")
5. Only create separate line items when the source document explicitly lists them as separate priced items

EXTRACTION RULES:
1. Create a SHORT one-line description (max 50 characters) for work_item - just a subject heading, not a full sentence
2. PRESERVE THE FULL DETAIL in the detail field - copy the complete original text/description of the work item exactly as it appears in the source document, including all specifics, sub-items, and clarifications
3. Determine if the work is done by "Baker McKenzie" or "Local Counsel" based on context clues
4. Extract the UPPER END fee amount as a number (no currency symbols)

FEE RANGE RULE:
- If fees are given as a range (e.g., "$50,000 - $75,000"), extract ONLY the UPPER END
- Examples: "$10,000 - $20,000" → use 20000, "between 5k and 15k" → use 15000

OTHER RULES:
- Keep work_item descriptions extremely brief (e.g., "Due diligence review", "Contract drafting", "Regulatory filings")
- The detail field should contain the full verbatim text from the source document describing what this work item includes
- If fees are percentages or hourly, estimate a reasonable fixed amount or use 0
- If you can't determine the provider, default to "Baker McKenzie"
- If you can't determine the fee, use 0
- Look for terms like "local counsel", "local law firm", "in-country", "domestic counsel" to identify Local Counsel items
- ONLY extract items that are explicitly mentioned in the text - do not infer or add items that might be needed`;

    const userPrompt = `Parse the following engagement letter/fee arrangement and extract budget line items. Currency context: ${currency || 'GBP'}

Text to parse:
---
${text}
---

Return the extracted items.`;

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
              description: "Extract budget line items from engagement letter text. You MUST extract ALL billable work items mentioned in the document.",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    description: "Array of ALL work items found in the document. Extract every billable task mentioned.",
                    items: {
                      type: "object",
                      properties: {
                        work_item: { 
                          type: "string", 
                          description: "Short one-line description of the work (max 50 chars)" 
                        },
                        detail: {
                          type: "string",
                          description: "Full verbatim text from the source document describing what this work item includes. Preserve all specifics, sub-items, and clarifications exactly as written."
                        },
                        provider: { 
                          type: "string", 
                          enum: ["Baker McKenzie", "Local Counsel"],
                          description: "Who performs this work" 
                        },
                        fee_amount: { 
                          type: "number", 
                          description: "Upper end fee amount as a number. For ranges, use ONLY the upper value (0 if unknown)" 
                        }
                      },
                      required: ["work_item", "detail", "provider", "fee_amount"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["items"],
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
    console.log("Extracted items:", result.items?.length || 0);

    return new Response(JSON.stringify({ items: result.items || [] }), {
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
