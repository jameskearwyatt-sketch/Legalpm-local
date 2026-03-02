import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Version: v3.0.0 — Currency-aware precedent matching + negative-fee guards

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(a|an|the|of|and|or|in|to|for|with|on)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantWords(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter(w => w.length > 2));
}

function textSimilarity(a: string, b: string): number {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function smartRound(amount: number): number {
  if (amount <= 0) return 0;
  if (amount < 10000) return Math.round(amount / 100) * 100;
  return Math.round(amount / 1000) * 1000;
}

interface HistoricalItem {
  work_item: string;
  detail: string | null;
  category: string;
  provider: string;
  fee: number;           // in original currency
  feeConverted: number;  // in target currency
  source: string;
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetCurrency = currency || 'GBP';
    console.log(`suggest-pricing v3: ${items.length} items, currency=${targetCurrency}, user=${userId}`);

    // ── Phase 1: Fetch historical data WITH currency ────────────────────────

    const [budgetResult, proposalResult, mattersResult, ratesResult] = await Promise.all([
      // Budget line items
      supabase
        .from('budget_line_items')
        .select('work_item, category, provider, fee_amount, matter_id')
        .eq('user_id', userId)
        .gt('fee_amount', 0)
        .order('created_at', { ascending: false })
        .limit(500),

      // Proposal items joined to proposals for currency + detail
      supabase
        .from('pricing_proposal_items')
        .select('work_item, detail, category, provider, fee_amount, fee_lower, fee_upper, proposal_id, pricing_proposals(currency)')
        .eq('user_id', userId)
        .gt('fee_amount', 0)
        .order('created_at', { ascending: false })
        .limit(500),

      // Matters for currency lookup
      supabase
        .from('matters')
        .select('id, currency')
        .eq('user_id', userId),

      // Exchange rates (table may not exist — handled gracefully)
      supabase
        .from('exchange_rates')
        .select('currency_code, rate_to_usd')
        .order('fetched_at', { ascending: false })
        .limit(20),
    ]);

    // Build matter currency lookup
    const matterCurrency: Record<string, string> = {};
    for (const m of (mattersResult.data || [])) {
      matterCurrency[m.id] = m.currency || 'GBP';
    }

    // Build FX lookup (currency → rate relative to USD)
    const fxRates: Record<string, number> = { USD: 1 };
    for (const r of (ratesResult.data || [])) {
      if (r.currency_code && r.rate_to_usd) {
        fxRates[r.currency_code] = r.rate_to_usd;
      }
    }
    // Fallbacks
    if (!fxRates['GBP']) fxRates['GBP'] = 0.79;
    if (!fxRates['EUR']) fxRates['EUR'] = 0.92;

    const convertToTarget = (amount: number, sourceCurrency: string): number => {
      if (sourceCurrency === targetCurrency) return amount;
      const srcRate = fxRates[sourceCurrency] || 1;
      const tgtRate = fxRates[targetCurrency] || 1;
      // Convert: amount in source → USD → target
      // If 1 USD = srcRate source, then amount source = amount/srcRate USD
      // Then amount/srcRate USD × tgtRate = amount in target
      return amount * (tgtRate / srcRate);
    };

    // Process budget items
    const budgetItems: HistoricalItem[] = (budgetResult.data || []).map((item: any) => {
      const srcCurrency = matterCurrency[item.matter_id] || 'GBP';
      return {
        work_item: item.work_item,
        detail: null,
        category: item.category || 'Uncategorized',
        provider: item.provider,
        fee: item.fee_amount,
        feeConverted: convertToTarget(item.fee_amount, srcCurrency),
        source: 'finalized_budget',
      };
    });

    // Process proposal items (exclude current proposal)
    const proposalItems: HistoricalItem[] = (proposalResult.data || [])
      .filter((item: any) => !proposalId || item.proposal_id !== proposalId)
      .map((item: any) => {
        const srcCurrency = item.pricing_proposals?.currency || 'GBP';
        return {
          work_item: item.work_item,
          detail: item.detail || null,
          category: item.category || 'Uncategorized',
          provider: item.provider,
          fee: item.fee_amount,
          feeConverted: convertToTarget(item.fee_amount, srcCurrency),
          source: 'pricing_proposal',
        };
      });

    // Already-priced items from current proposal
    const currentProposalPriced: HistoricalItem[] = (pricedItemsInProposal || []).map((item: any) => ({
      work_item: item.work_item,
      detail: item.detail || null,
      category: item.category || 'Uncategorized',
      provider: item.provider,
      fee: item.fee_amount,
      feeConverted: item.fee_amount, // already in target currency
      source: 'current_proposal',
    }));

    const allHistorical = [...budgetItems, ...proposalItems, ...currentProposalPriced];
    console.log(`Historical: ${budgetItems.length} budget, ${proposalItems.length} proposal, ${currentProposalPriced.length} current`);

    // ── Phase 2: Server-side precedent matching ─────────────────────────────

    interface PriceResult {
      work_item: string;
      fee_amount: number;
      rationale: string;
      matched: boolean;
    }

    const matchedResults: PriceResult[] = [];
    const unmatchedItems: any[] = [];

    for (const item of items) {
      // Find best match: same category + similar text
      let bestMatch: HistoricalItem | null = null;
      let bestScore = 0;

      for (const hist of allHistorical) {
        // Category must match (or be uncategorized)
        const catMatch = !item.category || !hist.category ||
          hist.category === 'Uncategorized' ||
          hist.category === item.category;
        if (!catMatch) continue;

        // Text similarity on work_item
        let score = textSimilarity(item.work_item, hist.work_item);
        
        // Boost if detail text also matches
        if (item.detail && hist.detail) {
          const detailScore = textSimilarity(item.detail, hist.detail);
          score = score * 0.6 + detailScore * 0.4;
        }

        // Bonus for same provider
        if (item.provider === hist.provider) score += 0.1;

        // Bonus for same category match
        if (item.category && hist.category === item.category) score += 0.15;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = hist;
        }
      }

      if (bestMatch && bestScore >= 0.5) {
        const convertedFee = smartRound(bestMatch.feeConverted);
        matchedResults.push({
          work_item: item.work_item,
          fee_amount: Math.max(convertedFee, 500),
          rationale: `Based on precedent "${bestMatch.work_item}" (${bestMatch.source}, score ${(bestScore * 100).toFixed(0)}%)`,
          matched: true,
        });
      } else {
        unmatchedItems.push(item);
      }
    }

    console.log(`Precedent matched: ${matchedResults.length}, sending ${unmatchedItems.length} to AI`);

    // ── Phase 3: AI pricing for unmatched items ─────────────────────────────

    let aiPrices: PriceResult[] = [];

    if (unmatchedItems.length > 0) {
      // Build category stats for AI context (using converted fees)
      const categoryStats: Record<string, { count: number; avg: number; min: number; max: number }> = {};
      for (const h of allHistorical) {
        const cat = h.category;
        if (!categoryStats[cat]) categoryStats[cat] = { count: 0, avg: 0, min: Infinity, max: 0 };
        categoryStats[cat].count++;
        categoryStats[cat].avg += h.feeConverted;
        categoryStats[cat].min = Math.min(categoryStats[cat].min, h.feeConverted);
        categoryStats[cat].max = Math.max(categoryStats[cat].max, h.feeConverted);
      }
      for (const cat of Object.keys(categoryStats)) {
        categoryStats[cat].avg = Math.round(categoryStats[cat].avg / categoryStats[cat].count);
      }

      const currencySymbol = targetCurrency === 'GBP' ? '£' : targetCurrency === 'USD' ? '$' : '€';

      const systemPrompt = `You are a legal fee proposal expert for Baker McKenzie. Suggest fee amounts for work items that have no direct historical precedent.

All amounts must be in ${targetCurrency} (${currencySymbol}).
All fees must be POSITIVE (minimum ${currencySymbol}500).

CATEGORY STATISTICS (converted to ${targetCurrency}):
${Object.entries(categoryStats).map(([cat, s]) =>
  `- ${cat}: ${s.count} items, avg ${currencySymbol}${s.avg.toLocaleString()}, range ${currencySymbol}${Math.round(s.min).toLocaleString()}-${currencySymbol}${Math.round(s.max).toLocaleString()}`
).join('\n')}

SAMPLE HISTORICAL (converted to ${targetCurrency}):
${allHistorical.slice(0, 30).map(h =>
  `- "${h.work_item}" (${h.category}, ${h.provider}): ${currencySymbol}${Math.round(h.feeConverted).toLocaleString()}`
).join('\n')}

Base your estimates on category averages and item complexity. Baker McKenzie items typically cost more than Local Counsel items.`;

      const userPrompt = `Suggest fees for these ${unmatchedItems.length} items (no strong precedent found):

${unmatchedItems.map((item: any, i: number) =>
  `${i + 1}. "${item.work_item}"${item.detail ? ` — ${item.detail.substring(0, 200)}` : ''} (${item.provider}, ${item.category || 'Uncategorized'})`
).join('\n')}`;

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
            { role: 'user', content: userPrompt },
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
                        work_item: { type: 'string' },
                        fee_amount: { type: 'number', minimum: 0 },
                        rationale: { type: 'string' },
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
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'Payment required, please add credits' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const toolCalls = data.choices?.[0]?.message?.tool_calls || [];

      for (const tc of toolCalls) {
        if (tc.function?.name === 'suggest_pricing') {
          try {
            const parsed = JSON.parse(tc.function.arguments);
            if (parsed.prices && Array.isArray(parsed.prices)) {
              for (const p of parsed.prices) {
                aiPrices.push({
                  work_item: p.work_item,
                  fee_amount: Math.max(smartRound(p.fee_amount || 0), 500),
                  rationale: p.rationale || 'AI estimated',
                  matched: false,
                });
              }
            }
          } catch (e) {
            console.error('Failed to parse AI response:', e);
          }
        }
      }
    }

    // ── Combine results ─────────────────────────────────────────────────────

    const allPrices = [...matchedResults, ...aiPrices];

    // Final guard: ensure no negative fees
    for (const p of allPrices) {
      if (p.fee_amount < 0) p.fee_amount = 500;
    }

    console.log(`Returning ${allPrices.length} prices (${matchedResults.length} matched, ${aiPrices.length} AI)`);

    return new Response(JSON.stringify({
      prices: allPrices,
      historicalDataUsed: allHistorical.length,
      precedentMatched: matchedResults.length,
      aiPriced: aiPrices.length,
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
