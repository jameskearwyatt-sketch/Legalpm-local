import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Predefined categories for legal work items
const CATEGORIES = [
  'Due Diligence',
  'Documentation', 
  'Negotiations',
  'Meetings',
  'Regulatory',
  'Closing',
  'Tax',
  'Legal Opinions',
  'Other'
] as const;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items } = await req.json();
    
    if (!items || !Array.isArray(items)) {
      throw new Error('Items array is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build work items text for AI classification
    const workItemsText = items.map((item: { work_item: string; index: number }) => 
      `${item.index}. ${item.work_item}`
    ).join('\n');

    const systemPrompt = `You are a legal work categorization assistant. Your task is to categorize legal work items into the following categories:

1. Due Diligence - Research, document review, investigation, verification, title searches, data room review
2. Documentation - Drafting, reviewing, negotiating contracts, agreements, legal documents, transaction documents
3. Negotiations - Negotiation calls, discussions, deal terms, commercial negotiations
4. Meetings - Client meetings, calls, attendance, conferences, internal meetings
5. Regulatory - Filings, compliance, government approvals, regulatory submissions, permits
6. Closing - Closing mechanics, completion, signing, execution, post-completion matters
7. Tax - Tax advice, tax review, tax structuring, tax documents, tax due diligence, stamp duty, transfer taxes, withholding taxes
8. Legal Opinions - Legal opinions, opinion letters, capacity opinions, enforceability opinions, third party opinions
9. Other - Anything that doesn't fit the above categories

For each work item provided, return its index and the most appropriate category.`;

    const userPrompt = `Categorize each of these legal work items:

${workItemsText}

Return the categorization in the exact format requested.`;

    console.log('Calling AI gateway to categorize', items.length, 'items');

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
        tools: [{
          type: 'function',
          function: {
            name: 'categorize_items',
            description: 'Categorize each work item into a legal work category',
            parameters: {
              type: 'object',
              properties: {
                categorizations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      index: { type: 'number', description: 'The index of the work item' },
                      category: { 
                        type: 'string', 
                        enum: ['Due Diligence', 'Documentation', 'Negotiations', 'Meetings', 'Regulatory', 'Closing', 'Tax', 'Legal Opinions', 'Other'],
                        description: 'The category for this work item'
                      }
                    },
                    required: ['index', 'category'],
                    additionalProperties: false
                  }
                }
              },
              required: ['categorizations'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'categorize_items' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract categorizations from tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'categorize_items') {
      throw new Error('Invalid AI response format');
    }

    const args = JSON.parse(toolCall.function.arguments);
    const categorizations = args.categorizations || [];

    console.log('Categorized', categorizations.length, 'items');

    return new Response(JSON.stringify({ categorizations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in categorize-budget-items:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
