import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { existing_items, proposal_name, client_name } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a legal fee proposal expert for a major law firm. Your job is to suggest additional work items that might be needed for a legal matter but may not have been explicitly requested.

Think about:
- Standard legal work that is often overlooked
- Regulatory requirements
- Due diligence items
- Documentation and closing mechanics
- Post-completion matters
- Project management and coordination

For each suggestion, provide:
- A clear work item description
- The provider (Baker McKenzie or Local Counsel)
- A suggested category from: Due Diligence, Documentation, Negotiations, Meetings, Regulatory, Closing, Tax, Legal Opinions, Other
- A brief rationale for why this might be needed`;

    const userPrompt = `Based on the following existing work items for "${proposal_name}" (client: ${client_name}):

${existing_items || 'No items yet'}

Please suggest 3-5 additional work items that might be needed but haven't been included. Focus on items that lawyers often forget to include but end up doing anyway.`;

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
            name: 'suggest_work_items',
            description: 'Return suggested additional work items for the legal matter',
            parameters: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      work_item: { type: 'string', description: 'Description of the work item' },
                      provider: { type: 'string', enum: ['Baker McKenzie', 'Local Counsel'] },
                      category: { type: 'string', enum: ['Due Diligence', 'Documentation', 'Negotiations', 'Meetings', 'Regulatory', 'Closing', 'Tax', 'Legal Opinions', 'Other'] },
                      rationale: { type: 'string', description: 'Brief explanation of why this item is suggested' },
                    },
                    required: ['work_item', 'provider', 'category', 'rationale'],
                  },
                },
              },
              required: ['suggestions'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'suggest_work_items' } },
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
        return new Response(JSON.stringify({ error: 'Payment required, please add credits' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'suggest_work_items') {
      throw new Error('Invalid response from AI');
    }

    const suggestions = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in suggest-work-items:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
