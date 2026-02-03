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
    const { items, currency, proposalId, pricedItemsInProposal } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching historical pricing data for user ${userId}...`);

    // Fetch historical data in parallel
    const [budgetLineItemsResult, proposalItemsResult] = await Promise.all([
      // 1. Get budget line items from all finalized budgets
      supabase
        .from('budget_line_items')
        .select('work_item, category, provider, fee_amount')
        .eq('user_id', userId)
        .gt('fee_amount', 0)
        .order('created_at', { ascending: false })
        .limit(500),
      
      // 2. Get pricing proposal items from all proposals (excluding current if provided)
      supabase
        .from('pricing_proposal_items')
        .select('work_item, category, provider, fee_amount, fee_lower, fee_upper')
        .eq('user_id', userId)
        .gt('fee_amount', 0)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    // Process budget line items
    const budgetItems = (budgetLineItemsResult.data || []).map((item: any) => ({
      work_item: item.work_item,
      category: item.category || 'Uncategorized',
      provider: item.provider,
      fee: item.fee_amount,
      source: 'finalized_budget'
    }));

    // Process proposal items (exclude current proposal if specified)
    const proposalItems = (proposalItemsResult.data || [])
      .filter((item: any) => !proposalId || item.proposal_id !== proposalId)
      .map((item: any) => ({
        work_item: item.work_item,
        category: item.category || 'Uncategorized',
        provider: item.provider,
        fee: item.fee_amount,
        fee_lower: item.fee_lower,
        fee_upper: item.fee_upper,
        source: 'pricing_proposal'
      }));

    // Already-priced items from current proposal (passed from frontend)
    const currentProposalPriced = (pricedItemsInProposal || []).map((item: any) => ({
      work_item: item.work_item,
      category: item.category || 'Uncategorized',
      provider: item.provider,
      fee: item.fee_amount,
      source: 'current_proposal'
    }));

    // Combine all historical data
    const allHistoricalData = [...budgetItems, ...proposalItems, ...currentProposalPriced];
    
    console.log(`Found ${budgetItems.length} budget items, ${proposalItems.length} proposal items, ${currentProposalPriced.length} current proposal priced items`);

    // Group by category for summary statistics
    const categoryStats: Record<string, { items: any[], avgFee: number, minFee: number, maxFee: number }> = {};
    for (const item of allHistoricalData) {
      const cat = item.category;
      if (!categoryStats[cat]) {
        categoryStats[cat] = { items: [], avgFee: 0, minFee: Infinity, maxFee: 0 };
      }
      categoryStats[cat].items.push(item);
      categoryStats[cat].minFee = Math.min(categoryStats[cat].minFee, item.fee);
      categoryStats[cat].maxFee = Math.max(categoryStats[cat].maxFee, item.fee);
    }
    
    // Calculate averages
    for (const cat of Object.keys(categoryStats)) {
      const fees = categoryStats[cat].items.map(i => i.fee);
      categoryStats[cat].avgFee = Math.round(fees.reduce((a, b) => a + b, 0) / fees.length);
    }

    // Build historical context for AI
    const currencySymbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
    
    let historicalContext = '';
    if (allHistoricalData.length > 0) {
      historicalContext = `\n\n## HISTORICAL PRICING DATA FROM THIS FIRM
The following is real pricing data from past budgets and proposals. Use this as your PRIMARY reference for pricing:

### Category Statistics:
${Object.entries(categoryStats).map(([cat, stats]) => 
  `- ${cat}: ${stats.items.length} items, avg ${currencySymbol}${stats.avgFee.toLocaleString()}, range ${currencySymbol}${stats.minFee.toLocaleString()} - ${currencySymbol}${stats.maxFee.toLocaleString()}`
).join('\n')}

### Sample Historical Work Items (most recent):
${allHistoricalData.slice(0, 50).map(item => 
  `- "${item.work_item}" (${item.category}, ${item.provider}): ${currencySymbol}${item.fee.toLocaleString()}`
).join('\n')}

IMPORTANT: Base your estimates on this historical data. Match similar work items to their historical prices. Only use generic market rates if no similar historical data exists.`;
    }

    // Items already priced in current proposal - use as strong reference
    let currentProposalContext = '';
    if (currentProposalPriced.length > 0) {
      currentProposalContext = `\n\n## ALREADY PRICED IN THIS PROPOSAL
These items have already been manually priced in the current proposal. Use them as direct reference for consistency:
${currentProposalPriced.map((item: any) => 
  `- "${item.work_item}" (${item.category}, ${item.provider}): ${currencySymbol}${item.fee.toLocaleString()}`
).join('\n')}

IMPORTANT: Price similar items consistently with these already-priced items.`;
    }

    const systemPrompt = `You are a legal fee proposal expert for Baker McKenzie, a major international law firm. Your job is to suggest reasonable fee amounts for legal work items.

PRICING METHODOLOGY:
1. FIRST look at historical pricing data from this firm (provided below) - find similar work items and use their prices as baseline
2. SECOND check items already priced in this proposal for consistency
3. ONLY IF no historical match exists, use general market knowledge

Consider:
- The complexity implied by the work item description
- The category of work (Due Diligence, Documentation, Negotiations, etc.)
- The provider (Baker McKenzie has higher rates than local counsel)
- Consistency with similar items already priced

Provide fee estimates in ${currency} (${currencySymbol}).${historicalContext}${currentProposalContext}`;

    const userPrompt = `Please suggest fee amounts for the following work items that need pricing:

${items.map((item: any, i: number) => `${i + 1}. "${item.work_item}" (${item.provider}, ${item.category || 'Uncategorized'})`).join('\n')}

For each item:
1. Look for similar items in the historical data
2. If found, base your price on historical averages for similar work
3. If not found, use category statistics or general knowledge
4. Provide a fee amount in ${currency} and explain your reasoning (mention if based on historical data)`;

    console.log(`Sending ${items.length} items to AI with ${allHistoricalData.length} historical references...`);

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
                      rationale: { type: 'string', description: 'Brief explanation including whether based on historical data' },
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
    console.log('AI response received');

    // Handle multiple tool calls - AI may split responses across multiple calls
    const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
    if (toolCalls.length === 0) {
      throw new Error('No tool calls in AI response');
    }

    // Merge prices from all tool calls
    const allPrices: any[] = [];
    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === 'suggest_pricing') {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          if (parsed.prices && Array.isArray(parsed.prices)) {
            allPrices.push(...parsed.prices);
          }
        } catch (parseErr) {
          console.error('Failed to parse tool call arguments:', parseErr);
        }
      }
    }

    console.log(`Merged ${allPrices.length} prices from ${toolCalls.length} tool calls`);

    return new Response(JSON.stringify({ 
      prices: allPrices,
      historicalDataUsed: allHistoricalData.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in suggest-pricing:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your request. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
