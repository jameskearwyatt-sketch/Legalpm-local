import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type HistoricalItem, type FXRateSet, type PricingResult, type ItemToPrice,
  convertToGBP, convertFromGBP, smartRound, minimumFee,
  priceItem, buildAIContextForItem, buildAISystemPrompt, currencySymbol,
  textSimilarity, classifyComplexity, targetPercentileFromComplexity,
  buildCategoryPercentiles, interpolateAtPercentile, computeConfidence,
  findSimilarityMatches, isFallbackFX,
  FALLBACK_FX_RATES, TIER1_SIMILARITY_THRESHOLD,
} from "../_shared/pricingEngine.ts";

// Version: v5.0.0 — Scope-aware pricing with shared engine, full diagnostics

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
    const { items, currency, proposalId, pricedItemsInProposal } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pricingCurrency = currency || 'GBP';
    const currencyWarning = !currency ? 'No currency specified — defaulting to GBP. Confidence reduced.' : null;
    console.log(`suggest-pricing v5: ${items.length} items, currency=${pricingCurrency}, user=${userId}`);

    // ── Phase 1: Fetch historical data ──────────────────────────────────────

    const [budgetResult, proposalResult, mattersResult, ratesResult] = await Promise.all([
      supabase.from('budget_line_items')
        .select('work_item, category, provider, fee_amount, matter_id')
        .eq('user_id', userId).gt('fee_amount', 0)
        .order('created_at', { ascending: false }).limit(500),
      supabase.from('pricing_proposal_items')
        .select('work_item, detail, category, provider, fee_amount, fee_lower, fee_upper, proposal_id, pricing_proposals(currency)')
        .eq('user_id', userId).gt('fee_amount', 0)
        .order('created_at', { ascending: false }).limit(500),
      supabase.from('matters')
        .select('id, currency').eq('user_id', userId),
      supabase.from('exchange_rates')
        .select('currency_code, rate_to_usd, fetched_at')
        .order('fetched_at', { ascending: false }).limit(20),
    ]);

    // Build FX rate set
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
    // Merge with fallbacks
    const mergedRates = { ...FALLBACK_FX_RATES, ...dbRates };
    const fx: FXRateSet = { rates: mergedRates, source: fxSource, timestamp: fxTimestamp };

    // ── Build historical items (all normalised to GBP) ──────────────────────

    const allHistorical: HistoricalItem[] = [];

    for (const item of (budgetResult.data || [])) {
      const srcCcy = matterCurrency[item.matter_id] || 'GBP';
      const { amountGBP } = convertToGBP(item.fee_amount, srcCcy, fx);
      allHistorical.push({
        work_item: item.work_item, detail: null,
        category: item.category || 'Uncategorized', provider: item.provider,
        feeOriginal: item.fee_amount, feeOriginalCurrency: srcCcy,
        feeGBP: amountGBP, source: 'finalized_budget',
        matterId: item.matter_id,
      });
    }

    for (const item of (proposalResult.data || [])) {
      if (proposalId && item.proposal_id === proposalId) continue;
      const srcCcy = (item as any).pricing_proposals?.currency || 'GBP';
      const { amountGBP } = convertToGBP(item.fee_amount, srcCcy, fx);
      allHistorical.push({
        work_item: item.work_item, detail: (item as any).detail || null,
        category: item.category || 'Uncategorized', provider: item.provider,
        feeOriginal: item.fee_amount, feeOriginalCurrency: srcCcy,
        feeGBP: amountGBP, source: 'pricing_proposal',
      });
    }

    for (const item of (pricedItemsInProposal || [])) {
      const { amountGBP } = convertToGBP(item.fee_amount, pricingCurrency, fx);
      allHistorical.push({
        work_item: item.work_item, detail: item.detail || null,
        category: item.category || 'Uncategorized', provider: item.provider,
        feeOriginal: item.fee_amount, feeOriginalCurrency: pricingCurrency,
        feeGBP: amountGBP, source: 'current_proposal',
      });
    }

    console.log(`Historical: ${allHistorical.length} items`);

    // ── Phase 2: Tier 1 & 2 pricing ─────────────────────────────────────────

    const results: PricingResult[] = [];
    const tier3Items: { item: ItemToPrice; index: number }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item: ItemToPrice = {
        work_item: items[i].work_item,
        detail: items[i].detail || null,
        category: items[i].category || 'Uncategorized',
        provider: items[i].provider,
      };

      const result = priceItem(item, allHistorical, pricingCurrency, fx);
      if (result) {
        // Apply currency warning confidence reduction
        if (currencyWarning && result.confidence !== 'LOW') {
          result.confidence = result.confidence === 'HIGH' ? 'MEDIUM' : 'LOW';
        }
        results.push(result);
      } else {
        tier3Items.push({ item, index: i });
      }
    }

    const tier1Count = results.filter(r => r.tierUsed === 'TIER_1').length;
    const tier2Count = results.filter(r => r.tierUsed === 'TIER_2').length;
    console.log(`Tier 1: ${tier1Count}, Tier 2: ${tier2Count}, Tier 3 to AI: ${tier3Items.length}`);

    // ── Phase 3: AI pricing for Tier 3 ──────────────────────────────────────

    if (tier3Items.length > 0) {
      const sym = currencySymbol(pricingCurrency);
      const minFee = minimumFee(pricingCurrency, fx);

      const systemPrompt = buildAISystemPrompt(pricingCurrency, allHistorical, fx, false);

      // Build per-item context
      const itemContexts = tier3Items.map(({ item }) =>
        buildAIContextForItem(item, allHistorical, pricingCurrency, fx)
      );

      const userPrompt = `Suggest fees for these ${tier3Items.length} items:\n${itemContexts.join('\n\n')}`;

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
          return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'Payment required, please add credits' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
      const aiPrices: { work_item: string; fee_amount: number; rationale: string }[] = [];

      for (const tc of toolCalls) {
        if (tc.function?.name === 'suggest_pricing') {
          try {
            const parsed = JSON.parse(tc.function.arguments);
            if (parsed.prices && Array.isArray(parsed.prices)) aiPrices.push(...parsed.prices);
          } catch (e) { console.error('Failed to parse AI response:', e); }
        }
      }

      // Map AI results back to tier3 items
      for (const { item } of tier3Items) {
        const complexity = classifyComplexity(item.work_item, item.detail);
        const tgtPctl = targetPercentileFromComplexity(complexity.complexityScore);
        const catData = buildCategoryPercentiles(allHistorical, item.category);
        const matches = findSimilarityMatches(item, allHistorical, pricingCurrency, fx, 3);
        const bandLow = Math.max(0.05, tgtPctl - 0.10);
        const bandHigh = Math.min(0.95, tgtPctl + 0.10);
        const bandLowGBP = interpolateAtPercentile(catData.feesGBP, bandLow);
        const bandHighGBP = interpolateAtPercentile(catData.feesGBP, bandHigh);

        // Find AI match
        const aiMatch = aiPrices.find(r =>
          r.work_item === item.work_item ||
          r.work_item?.startsWith(item.work_item) ||
          item.work_item?.startsWith(r.work_item) ||
          textSimilarity(r.work_item, item.work_item).score > 0.6
        );

        let suggestedPrice: number;
        let suggestedPriceBaseGBP: number;
        let explanation: string;

        if (aiMatch && aiMatch.fee_amount > 0) {
          suggestedPrice = Math.max(smartRound(aiMatch.fee_amount, pricingCurrency), minFee);
          suggestedPriceBaseGBP = smartRound(convertToGBP(suggestedPrice, pricingCurrency, fx).amountGBP, 'GBP');
          explanation = aiMatch.rationale || 'AI estimated';
        } else {
          // Fallback: scope-aware default
          const fallbackGBP = complexity.scope === 'broad' ? 25000 : complexity.scope === 'narrow' ? 5000 : 10000;
          suggestedPriceBaseGBP = smartRound(fallbackGBP, 'GBP');
          suggestedPrice = Math.max(smartRound(convertFromGBP(fallbackGBP, pricingCurrency, fx), pricingCurrency), minFee);
          explanation = `Default estimate (${complexity.scope} scope, no AI match)`;
        }

        let confidence = computeConfidence('TIER_3', 0, catData, fx, pricingCurrency);
        if (currencyWarning && confidence !== 'LOW') {
          confidence = confidence === 'HIGH' ? 'MEDIUM' : 'LOW';
        }

        const statsGBP = catData.stats;

        results.push({
          workItem: item.work_item,
          suggestedPrice,
          pricingCurrency,
          suggestedPriceBaseGBP,
          tierUsed: 'TIER_3',
          confidence,
          scope: complexity.scope,
          complexityScore: complexity.complexityScore,
          signals: complexity.signals,
          percentileStats: {
            p25: smartRound(convertFromGBP(statsGBP.p25, pricingCurrency, fx), pricingCurrency),
            p50: smartRound(convertFromGBP(statsGBP.p50, pricingCurrency, fx), pricingCurrency),
            p75: smartRound(convertFromGBP(statsGBP.p75, pricingCurrency, fx), pricingCurrency),
            p90: smartRound(convertFromGBP(statsGBP.p90, pricingCurrency, fx), pricingCurrency),
            n: statsGBP.n,
            IQR: smartRound(convertFromGBP(statsGBP.IQR, pricingCurrency, fx), pricingCurrency),
          },
          targetPercentile: tgtPctl,
          permittedBand: {
            lowPercentile: bandLow, highPercentile: bandHigh,
            lowValuePricingCcy: Math.max(smartRound(convertFromGBP(bandLowGBP, pricingCurrency, fx), pricingCurrency), minFee),
            highValuePricingCcy: Math.max(smartRound(convertFromGBP(bandHighGBP, pricingCurrency, fx), pricingCurrency), minFee),
            lowValueGBP: bandLowGBP, highValueGBP: bandHighGBP,
          },
          similarityMatches: matches,
          explanation,
          diagnostics: {
            fxRateUsed: convertToGBP(1, pricingCurrency, fx).fxInfo.rateUsed,
            fxSource: isFallbackFX(fx, pricingCurrency) ? 'fallback' : fx.source,
            fxTimestamp: fx.timestamp,
            categoryCount: statsGBP.n,
            outlierMethod: 'none',
            sparseCategory: catData.sparse,
          },
        });
      }
    }

    // ── Build backward-compatible output ─────────────────────────────────────
    // The front-end expects: { prices: [{ work_item, fee_amount, rationale, matched }], ... }

    const prices = results.map(r => ({
      work_item: r.workItem,
      fee_amount: r.suggestedPrice,
      fee_amount_base_gbp: r.suggestedPriceBaseGBP,
      rationale: r.explanation,
      matched: r.tierUsed !== 'TIER_3',
      tier: r.tierUsed,
      confidence: r.confidence,
      scope: r.scope,
      complexityScore: r.complexityScore,
      signals: r.signals,
      percentileStats: r.percentileStats,
      targetPercentile: r.targetPercentile,
      permittedBand: r.permittedBand,
      similarityMatches: r.similarityMatches,
      diagnostics: r.diagnostics,
    }));

    console.log(`Returning ${prices.length} prices: T1=${tier1Count}, T2=${tier2Count}, T3=${tier3Items.length}`);

    return new Response(JSON.stringify({
      prices,
      pricingCurrency,
      historicalDataUsed: allHistorical.length,
      precedentMatched: tier1Count + tier2Count,
      aiPriced: tier3Items.length,
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
    console.error('Error in suggest-pricing:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your request. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
