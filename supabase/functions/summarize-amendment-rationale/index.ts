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

    const { text, budgetChange, currentLineItems } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (text.length > 20000) {
      return new Response(
        JSON.stringify({ error: 'Text is too long. Please provide a shorter excerpt.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context about current line items if provided
    let currentBudgetContext = '';
    if (currentLineItems && Array.isArray(currentLineItems) && currentLineItems.length > 0) {
      currentBudgetContext = '\n\nCURRENT BUDGET LINE ITEMS (use these indices for matching):\n' + 
        currentLineItems.map((item: any, i: number) => 
          `[Index ${i}] "${item.work_item}" by ${item.provider}: ${item.fee_amount}`
        ).join('\n');
    }

    const systemPrompt = `You are a legal budget amendment assistant. Analyze correspondence about budget changes and extract:
1. A brief summary explaining why the budget is being amended (2-3 sentences)
2. Specific budget line item changes - CRITICALLY distinguishing between UPDATES to existing items vs genuinely NEW items

CRITICAL MATCHING RULES:
- You will be given the CURRENT BUDGET LINE ITEMS with their indices
- For ANY change that relates to an existing work item (even if worded slightly differently), set is_new=false and provide the matched_index
- "Due diligence" updates should match existing "Due Diligence" items
- "DD" is shorthand for "Due Diligence" 
- "Structuring" updates match "Structuring" items
- Amount increases/decreases to existing items are UPDATES (is_new=false), NOT new items
- Only set is_new=true for genuinely new work streams not already in the budget
- When matching, prefer the item with the same provider if multiple similar items exist

Guidelines for summary:
- Be very concise (2-3 sentences maximum)
- Focus on the key reason for the budget change
- Use professional legal/business language
- Write in third person (e.g., "Budget increased due to...")

Guidelines for budget changes:
- Extract any monetary amounts mentioned with their associated work items
- Amounts should be numbers only (no currency symbols)
- Provider should be either "Baker McKenzie" or "Local Counsel"
- ALWAYS check if a mentioned item matches an existing budget item before marking as new`;

    const userPrompt = `Analyze the following correspondence and extract the budget amendment details.
${currentBudgetContext}

IMPORTANT: For each budget change mentioned, check if it matches any existing item above. If it does, use matched_index and is_new=false.

${budgetChange ? `Budget change context: ${budgetChange}\n\n` : ''}Correspondence/Notes:
${text}`;

    console.log('Calling Lovable AI to analyze amendment...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_budget_amendment',
              description: 'Extract budget amendment summary and line item changes from correspondence',
              parameters: {
                type: 'object',
                properties: {
                  summary: {
                    type: 'string',
                    description: 'A brief 2-3 sentence summary of why the budget is being amended'
                  },
                  line_item_updates: {
                    type: 'array',
                    description: 'List of budget line item changes (updates to existing items or new items)',
                    items: {
                      type: 'object',
                      properties: {
                        work_item: {
                          type: 'string',
                          description: 'Name/description of the work item. Use the EXACT name from existing items when updating.'
                        },
                        provider: {
                          type: 'string',
                          enum: ['Baker McKenzie', 'Local Counsel'],
                          description: 'Who is providing this service'
                        },
                        fee_amount: {
                          type: 'number',
                          description: 'The fee amount as a number (no currency symbols)'
                        },
                        is_new: {
                          type: 'boolean',
                          description: 'FALSE if this updates an existing budget item (even with different wording). TRUE only for genuinely new work not in current budget.'
                        },
                        matched_index: {
                          type: 'number',
                          description: 'When is_new=false, provide the index number of the matching existing budget item from the list provided.'
                        }
                      },
                      required: ['work_item', 'provider', 'fee_amount', 'is_new']
                    }
                  }
                },
                required: ['summary']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_budget_amendment' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate summary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== 'extract_budget_amendment') {
      // Fallback: try to get regular content
      const fallbackSummary = data.choices?.[0]?.message?.content?.trim();
      if (fallbackSummary) {
        return new Response(
          JSON.stringify({ summary: fallbackSummary, line_item_updates: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('No tool call in AI response:', data);
      return new Response(
        JSON.stringify({ error: 'Failed to extract budget information' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let extractedData;
    try {
      extractedData = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error('Failed to parse tool arguments:', toolCall.function.arguments);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully extracted amendment data:', extractedData);

    return new Response(
      JSON.stringify({ 
        summary: extractedData.summary || '',
        line_item_updates: extractedData.line_item_updates || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in summarize-amendment-rationale:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
