import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const userId = claimsData.user.id;
    const { items, targetAmount, currency, phaseName } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No items provided for allocation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetAmount || targetAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Target amount must be greater than 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Allocating ${targetAmount} ${currency} across ${items.length} items for user ${userId}`);

    // Fetch historical data for context
    const [budgetLineItemsResult, proposalItemsResult] = await Promise.all([
      supabase
        .from('budget_line_items')
        .select('work_item, category, provider, fee_amount')
        .eq('user_id', userId)
        .gt('fee_amount', 0)
        .order('created_at', { ascending: false })
        .limit(300),
      
      supabase
        .from('pricing_proposal_items')
        .select('work_item, category, provider, fee_amount, fee_lower, fee_upper')
        .eq('user_id', userId)
        .gt('fee_amount', 0)
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

    // Process historical data
    const budgetItems = (budgetLineItemsResult.data || []).map((item: any) => ({
      work_item: item.work_item,
      category: item.category || 'Uncategorized',
      provider: item.provider,
      fee: item.fee_amount,
      source: 'finalized_budget'
    }));

    const proposalItems = (proposalItemsResult.data || []).map((item: any) => ({
      work_item: item.work_item,
      category: item.category || 'Uncategorized',
      provider: item.provider,
      fee: item.fee_amount,
      source: 'pricing_proposal'
    }));

    const allHistoricalData = [...budgetItems, ...proposalItems];

    // Group by category for statistics
    const categoryStats: Record<string, { items: any[], avgFee: number, totalFee: number }> = {};
    for (const item of allHistoricalData) {
      const cat = item.category;
      if (!categoryStats[cat]) {
        categoryStats[cat] = { items: [], avgFee: 0, totalFee: 0 };
      }
      categoryStats[cat].items.push(item);
      categoryStats[cat].totalFee += item.fee;
    }
    
    for (const cat of Object.keys(categoryStats)) {
      const fees = categoryStats[cat].items.map(i => i.fee);
      categoryStats[cat].avgFee = Math.round(fees.reduce((a, b) => a + b, 0) / fees.length);
    }

    const currencySymbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';

    let historicalContext = '';
    if (allHistoricalData.length > 0) {
      historicalContext = `\n\n## HISTORICAL PRICING DATA
Use this data to understand relative complexity and value of different work item types:

### Category Statistics:
${Object.entries(categoryStats).map(([cat, stats]) => 
  `- ${cat}: ${stats.items.length} items, avg ${currencySymbol}${stats.avgFee.toLocaleString()}`
).join('\n')}

### Sample Historical Work Items:
${allHistoricalData.slice(0, 30).map(item => 
  `- "${item.work_item}" (${item.category}, ${item.provider}): ${currencySymbol}${item.fee.toLocaleString()}`
).join('\n')}
`;
    }

    const systemPrompt = `You are a legal fee proposal expert for Baker McKenzie. Your task is to ALLOCATE a specific target budget across work items intelligently.

CRITICAL: The total of all allocations MUST equal exactly ${currencySymbol}${targetAmount.toLocaleString()}.

ALLOCATION METHODOLOGY:
1. Consider the relative complexity of each work item
2. Use historical data to understand typical pricing relationships between different types of work
3. Baker McKenzie items typically command higher fees than Local Counsel items
4. Due Diligence and Documentation work often has higher value than administrative tasks
5. Consider the category of each item when determining relative allocation

Round each amount to a sensible figure (nearest 100 for smaller amounts, nearest 1000 for larger).

${historicalContext}`;

    const userPrompt = `Please allocate exactly ${currencySymbol}${targetAmount.toLocaleString()} across the following ${items.length} work items${phaseName ? ` for "${phaseName}"` : ''}:

${items.map((item: any, i: number) => `${i + 1}. "${item.work_item}" (${item.provider}${item.category ? `, ${item.category}` : ''})`).join('\n')}

REQUIREMENTS:
1. The sum of all fee_amount values MUST equal exactly ${targetAmount}
2. Allocate proportionally based on relative complexity and historical pricing patterns
3. Each item must receive a positive amount
4. Return sensible rounded figures

Return allocations for ALL ${items.length} items.`;

    console.log(`Sending ${items.length} items to AI for target allocation of ${targetAmount}...`);

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
            name: 'allocate_pricing',
            description: 'Return allocated pricing for each work item that sums to the target',
            parameters: {
              type: 'object',
              properties: {
                allocations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      work_item: { type: 'string', description: 'The work item description (must match input exactly)' },
                      fee_amount: { type: 'number', description: 'Allocated fee amount' },
                      rationale: { type: 'string', description: 'Brief explanation for this allocation' },
                    },
                    required: ['work_item', 'fee_amount', 'rationale'],
                  },
                },
                total_allocated: { type: 'number', description: 'Sum of all allocations (must equal target)' },
              },
              required: ['allocations', 'total_allocated'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'allocate_pricing' } },
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
    console.log('AI response received');

    // Handle tool calls
    const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
    if (toolCalls.length === 0) {
      throw new Error('No tool calls in AI response');
    }

    // Get allocations from tool call
    let allocations: any[] = [];
    let totalAllocated = 0;
    
    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === 'allocate_pricing') {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          if (parsed.allocations && Array.isArray(parsed.allocations)) {
            allocations = parsed.allocations;
            totalAllocated = parsed.total_allocated || allocations.reduce((sum: number, a: any) => sum + (a.fee_amount || 0), 0);
          }
        } catch (parseErr) {
          console.error('Failed to parse tool call arguments:', parseErr);
        }
      }
    }

    // Validate and adjust if needed
    const calculatedTotal = allocations.reduce((sum: number, a: any) => sum + (a.fee_amount || 0), 0);
    const difference = targetAmount - calculatedTotal;
    
    if (Math.abs(difference) > 1 && allocations.length > 0) {
      // Adjust the largest item to make the total exact
      console.log(`Adjusting allocations: calculated ${calculatedTotal}, target ${targetAmount}, difference ${difference}`);
      const largestIndex = allocations.reduce((maxIdx: number, curr: any, idx: number, arr: any[]) => 
        curr.fee_amount > arr[maxIdx].fee_amount ? idx : maxIdx, 0);
      allocations[largestIndex].fee_amount += difference;
      allocations[largestIndex].rationale += ' (adjusted to match target total)';
    }

    console.log(`Returning ${allocations.length} allocations totaling ${targetAmount}`);

    return new Response(JSON.stringify({ 
      allocations,
      targetAmount,
      historicalDataUsed: allHistoricalData.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in allocate-target-pricing:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your request. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
