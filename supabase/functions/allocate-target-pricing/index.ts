import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type HistoricalItem, type FXRateSet, type ItemToPrice,
  convertToGBP, convertFromGBP, smartRound, minimumFee,
  priceItem, buildAIContextForItem, buildAISystemPrompt, currencySymbol,
  textSimilarity, classifyComplexity, targetPercentileFromComplexity,
  buildCategoryPercentiles, computeConfidence, findSimilarityMatches,
  isFallbackFX, FALLBACK_FX_RATES, MINIMUM_ITEM_FEE_GBP,
} from "../_shared/pricingEngine.ts";

// Version: v5.0.0 — Scope-aware base pricing + deterministic scaling, shared engine

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorisation required' }),
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
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'No items provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!targetAmount || targetAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Target amount must be > 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pricingCurrency = currency || 'GBP';
    const currencyWarning = !currency ? 'No currency specified — defaulting to GBP.' : null;
    console.log(`allocate-target v5: ${targetAmount} ${pricingCurrency} across ${items.length} items, user=${userId}`);

    // ── Phase 1: Fetch historical data ──────────────────────────────────────

    const [budgetResult, proposalResult, mattersResult, ratesResult] = await Promise.all([
      supabase.from('budget_line_items')
        .select('work_item, category, provider, fee_amount, matter_id')
        .eq('user_id', userId).gt('fee_amount', 0)
        .order('created_at', { ascending: false }).limit(500),
      supabase.from('pricing_proposal_items')
        .select('work_item, detail, category, provider, fee_amount, pricing_proposals(currency)')
        .eq('user_id', userId).gt('fee_amount', 0)
        .order('created_at', { ascending: false }).limit(500),
      supabase.from('matters')
        .select('id, currency').eq('user_id', userId),
      supabase.from('exchange_rates')
        .select('currency_code, rate_to_usd, fetched_at')
        .order('fetched_at', { ascending: false }).limit(20),
    ]);

    const matterCurrency: Record<string, string> = {};
    for (const m of (mattersResult.data || [])) matterCurrency[m.id] = m.currency || 'GBP';

    const dbRates: Record<string, number> = { USD: 1 };
    let fxTimestamp: string | null = null;
    let fxSource: 'db_table' | 'fallback' = 'fallback';
    for (const r of (ratesResult.data || [])) {
      if (r.currency_code && r.rate_to_usd) {
        dbRates[r.currency_code] = r.rate_to_usd;
        if (!fxTimestamp && r.fetched_at) fxTimestamp = r.fetched_at;
        fxSource = 'db_table';
      }
    }
    const mergedRates = { ...FALLBACK_FX_RATES, ...dbRates };
    const fx: FXRateSet = { rates: mergedRates, source: fxSource, timestamp: fxTimestamp };

    // ── Build historical items (normalised to GBP) ──────────────────────────

    const allHistorical: HistoricalItem[] = [];

    for (const item of (budgetResult.data || [])) {
      const srcCcy = matterCurrency[item.matter_id] || 'GBP';
      const { amountGBP } = convertToGBP(item.fee_amount, srcCcy, fx);
      allHistorical.push({
        work_item: item.work_item, detail: null,
        category: item.category || 'Uncategorized', provider: item.provider,
        feeOriginal: item.fee_amount, feeOriginalCurrency: srcCcy,
        feeGBP: amountGBP, source: 'budget', matterId: item.matter_id,
      });
    }
    for (const item of (proposalResult.data || [])) {
      const srcCcy = (item as any).pricing_proposals?.currency || 'GBP';
      const { amountGBP } = convertToGBP(item.fee_amount, srcCcy, fx);
      allHistorical.push({
        work_item: item.work_item, detail: (item as any).detail || null,
        category: item.category || 'Uncategorized', provider: item.provider,
        feeOriginal: item.fee_amount, feeOriginalCurrency: srcCcy,
        feeGBP: amountGBP, source: 'proposal',
      });
    }

    console.log(`Historical data: ${allHistorical.length} items`);

    // ── Phase 2: Get unconstrained base prices using tiered engine ───────────

    const minFee = minimumFee(pricingCurrency, fx);
    interface BasePrice { work_item: string; baseFee: number; rationale: string; tier: string; }
    const basePrices: BasePrice[] = [];
    const unmatchedIndices: number[] = [];

    for (let i = 0; i < items.length; i++) {
      const inputItem: ItemToPrice = {
        work_item: items[i].work_item,
        detail: items[i].detail || null,
        category: items[i].category || 'Uncategorized',
        provider: items[i].provider,
      };

      const result = priceItem(inputItem, allHistorical, pricingCurrency, fx);
      if (result) {
        basePrices.push({
          work_item: inputItem.work_item,
          baseFee: result.suggestedPrice,
          rationale: result.explanation,
          tier: result.tierUsed,
        });
      } else {
        basePrices.push({ work_item: inputItem.work_item, baseFee: 0, rationale: '', tier: 'TIER_3' });
        unmatchedIndices.push(i);
      }
    }

    console.log(`Tier 1+2 matched: ${items.length - unmatchedIndices.length}, Tier 3 to AI: ${unmatchedIndices.length}`);

    // Step B: AI pricing for Tier 3 items
    if (unmatchedIndices.length > 0) {
      const systemPrompt = buildAISystemPrompt(pricingCurrency, allHistorical, fx, true);
      const unmatchedItems = unmatchedIndices.map(i => items[i]);

      const itemContexts = unmatchedItems.map((item: any) =>
        buildAIContextForItem(
          { work_item: item.work_item, detail: item.detail || null, category: item.category || 'Uncategorized', provider: item.provider },
          allHistorical, pricingCurrency, fx
        )
      );

      const userPrompt = `Suggest base prices for these ${unmatchedItems.length} items:\n${itemContexts.join('\n\n')}\n\nReturn your best estimate of what each is worth. Do NOT try to hit any target total.`;

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
              name: 'suggest_base_prices',
              description: 'Return unconstrained base prices',
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
          tool_choice: { type: 'function', function: { name: 'suggest_base_prices' } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'Payment required' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const errorText = await response.text();
        console.error('AI error:', response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
      const aiResults: { work_item: string; fee_amount: number; rationale: string }[] = [];
      for (const tc of toolCalls) {
        if (tc.function?.name === 'suggest_base_prices') {
          try {
            const parsed = JSON.parse(tc.function.arguments);
            if (parsed.prices) aiResults.push(...parsed.prices);
          } catch (e) { console.error('Parse error:', e); }
        }
      }

      for (let j = 0; j < unmatchedIndices.length; j++) {
        const idx = unmatchedIndices[j];
        const item = items[idx];

        const aiMatch = aiResults.find(r =>
          r.work_item === item.work_item ||
          r.work_item?.startsWith(item.work_item) ||
          item.work_item?.startsWith(r.work_item) ||
          textSimilarity(r.work_item, item.work_item).score > 0.6
        );

        if (aiMatch && aiMatch.fee_amount > 0) {
          basePrices[idx] = {
            work_item: item.work_item,
            baseFee: Math.max(smartRound(aiMatch.fee_amount, pricingCurrency), minFee),
            rationale: aiMatch.rationale || 'AI estimated',
            tier: 'TIER_3',
          };
        } else {
          const complexity = classifyComplexity(item.work_item, item.detail || null);
          const fallbackGBP = complexity.scope === 'broad' ? 25000 : complexity.scope === 'narrow' ? 5000 : 10000;
          basePrices[idx] = {
            work_item: item.work_item,
            baseFee: Math.max(smartRound(convertFromGBP(fallbackGBP, pricingCurrency, fx), pricingCurrency), minFee),
            rationale: `Default estimate (${complexity.scope} scope)`,
            tier: 'TIER_3',
          };
        }
      }
    }

    // ── Phase 3: Deterministic scaling to hit target ────────────────────────

    const totalBaseFee = basePrices.reduce((sum, p) => sum + p.baseFee, 0);

    if (totalBaseFee <= 0) {
      const evenFee = smartRound(targetAmount / items.length, pricingCurrency);
      const allocations = basePrices.map(p => ({
        work_item: p.work_item,
        fee_amount: evenFee,
        rationale: 'Evenly distributed (no precedent data)',
      }));
      const totalEven = evenFee * items.length;
      if (totalEven !== targetAmount) {
        allocations[allocations.length - 1].fee_amount += (targetAmount - totalEven);
      }
      return new Response(JSON.stringify({ allocations, targetAmount, pricingCurrency, historicalDataUsed: allHistorical.length, scaleFactor: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const scaleFactor = targetAmount / totalBaseFee;
    console.log(`Base total: ${totalBaseFee}, target: ${targetAmount}, scale factor: ${(scaleFactor * 100).toFixed(1)}%`);

    const allocations = basePrices.map(p => ({
      work_item: p.work_item,
      fee_amount: Math.max(smartRound(p.baseFee * scaleFactor, pricingCurrency), minFee),
      rationale: p.rationale + (scaleFactor !== 1 ? ` (scaled ${(scaleFactor * 100).toFixed(0)}%)` : ''),
    }));

    // ── Distribute rounding error ───────────────────────────────────────────

    let currentTotal = allocations.reduce((sum, a) => sum + a.fee_amount, 0);
    let remainder = targetAmount - currentTotal;

    if (Math.abs(remainder) > 0) {
      // Determine increment based on currency + deal size
      let increment: number;
      if (pricingCurrency === 'USD') {
        increment = targetAmount >= 250000 ? 5000 : targetAmount >= 50000 ? 2500 : 1000;
      } else if (pricingCurrency === 'GBP') {
        increment = targetAmount >= 100000 ? 5000 : targetAmount >= 25000 ? 1000 : 500;
      } else {
        increment = 1000;
      }

      const sortedIndices = allocations
        .map((_, i) => i)
        .sort((a, b) => allocations[b].fee_amount - allocations[a].fee_amount);

      let safetyCounter = 0;
      const maxIterations = items.length * 20;

      while (Math.abs(remainder) >= increment && safetyCounter < maxIterations) {
        for (const idx of sortedIndices) {
          if (Math.abs(remainder) < increment) break;
          if (remainder > 0) {
            allocations[idx].fee_amount += increment;
            remainder -= increment;
          } else {
            if (allocations[idx].fee_amount - increment >= minFee) {
              allocations[idx].fee_amount -= increment;
              remainder += increment;
            }
          }
        }
        safetyCounter++;
      }

      if (Math.abs(remainder) > 0 && Math.abs(remainder) < increment) {
        allocations[sortedIndices[0]].fee_amount += remainder;
        remainder = 0;
      }
    }

    const finalTotal = allocations.reduce((sum, a) => sum + a.fee_amount, 0);
    console.log(`Final total: ${finalTotal} (target: ${targetAmount}, diff: ${targetAmount - finalTotal})`);

    return new Response(JSON.stringify({
      allocations,
      targetAmount,
      pricingCurrency,
      historicalDataUsed: allHistorical.length,
      scaleFactor: Math.round(scaleFactor * 100),
      baseEstimate: totalBaseFee,
      fxInfo: {
        rateUsed: convertToGBP(1, pricingCurrency, fx).fxInfo.rateUsed,
        source: fx.source,
        timestamp: fx.timestamp,
      },
      ...(currencyWarning ? { warning: currencyWarning } : {}),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in allocate-target-pricing:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
