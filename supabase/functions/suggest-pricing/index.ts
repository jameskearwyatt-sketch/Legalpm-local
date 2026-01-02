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
    const { items, currency } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const currencySymbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';

    const systemPrompt = `You are a legal fee proposal expert for a major international law firm. Your job is to suggest reasonable fee amounts for legal work items.

Consider:
- The complexity of the work
- Standard market rates for similar work
- The provider (Baker McKenzie typically has higher rates than local counsel)
- The category of work

Provide realistic fee estimates in ${currency} (${currencySymbol}). Be conservative - it's better to slightly overestimate than underestimate.

Typical fee ranges:
- Simple due diligence items: ${currencySymbol}5,000 - ${currencySymbol}20,000
- Complex due diligence: ${currencySymbol}20,000 - ${currencySymbol}75,000
- Standard documentation: ${currencySymbol}10,000 - ${currencySymbol}50,000
- Complex negotiations: ${currencySymbol}25,000 - ${currencySymbol}100,000
- Regulatory work: ${currencySymbol}15,000 - ${currencySymbol}60,000
- Closing mechanics: ${currencySymbol}10,000 - ${currencySymbol}40,000
- Legal opinions: ${currencySymbol}5,000 - ${currencySymbol}25,000`;

    const userPrompt = `Please suggest fee amounts for the following work items:

${items.map((item: any, i: number) => `${i + 1}. ${item.work_item} (${item.provider}, ${item.category || 'Uncategorized'})`).join('\n')}

Provide a fee amount in ${currency} and a brief rationale for each.`;

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
            name: 'suggest_pricing',
            description: 'Return suggested pricing for each work item',
            parameters: {
              type: 'object',
              properties: {
                prices: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      work_item: { type: 'string', description: 'The work item description (must match input exactly)' },
                      fee_amount: { type: 'number', description: 'Suggested fee amount in the specified currency' },
                      rationale: { type: 'string', description: 'Brief explanation of the pricing' },
                    },
                    required: ['work_item', 'fee_amount', 'rationale'],
                  },
                },
              },
              required: ['prices'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'suggest_pricing' } },
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
    if (!toolCall || toolCall.function.name !== 'suggest_pricing') {
      throw new Error('Invalid response from AI');
    }

    const pricing = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(pricing), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in suggest-pricing:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
