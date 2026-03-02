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

// Version: v6.0.0 — Two-stage target allocation: Stage 1 baseline via shared engine, Stage 2 pro-rata scaling

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Configurable: extreme scaling factor thresholds */
const EXTREME_SCALE_LOW = 0.5;
const EXTREME_SCALE_HIGH = 2.0;

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
    const currencyWarning = !currency ? 'No currency specified — defaulting to GBP. Confidence reduced.' : null;
    console.log(`allocate-target v6: ${targetAmount} ${pricingCurrency} across ${items.length} items, user=${userId}`);

    // ══════════════════════════════════════════════════════════════════════════
    // FETCH HISTORICAL DATA (identical to suggest-pricing)
    // ══════════════════════════════════════════════════════════════════════════

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

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 1 — BASELINE PRICING (identical engine to suggest-pricing)
    // ══════════════════════════════════════════════════════════════════════════

    const minFee = minimumFee(pricingCurrency, fx);
    const baselineResults: PricingResult[] = [];
    const tier3Items: { item: ItemToPrice; index: number }[] = [];

    for (let i = 0; i < items.length; i++) {
      const inputItem: ItemToPrice = {
        work_item: items[i].work_item,
        detail: items[i].detail || null,
        category: items[i].category || 'Uncategorized',
        provider: items[i].provider,
      };

      const result = priceItem(inputItem, allHistorical, pricingCurrency, fx);
      if (result) {
        if (currencyWarning && result.confidence !== 'LOW') {
          result.confidence = result.confidence === 'HIGH' ? 'MEDIUM' : 'LOW';
        }
        baselineResults.push(result);
      } else {
        // Placeholder — will be filled by AI
        baselineResults.push(null as any);
        tier3Items.push({ item: inputItem, index: i });
      }
    }

    const tier1Count = baselineResults.filter(r => r?.tierUsed === 'TIER_1').length;
    const tier2Count = baselineResults.filter(r => r?.tierUsed === 'TIER_2').length;
    console.log(`Stage 1: Tier 1=${tier1Count}, Tier 2=${tier2Count}, Tier 3 to AI=${tier3Items.length}`);

    // AI pricing for Tier 3 items
    if (tier3Items.length > 0) {
      const systemPrompt = buildAISystemPrompt(pricingCurrency, allHistorical, fx, true);
      const itemContexts = tier3Items.map(({ item }) =>
        buildAIContextForItem(item, allHistorical, pricingCurrency, fx)
      );
      const userPrompt = `Suggest base prices for these ${tier3Items.length} items:\n${itemContexts.join('\n\n')}\n\nReturn your best estimate of what each is worth. Do NOT try to hit any target total.`;

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
          return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'Payment required, please add credits' }),
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

      for (const { item, index } of tier3Items) {
        const complexity = classifyComplexity(item.work_item, item.detail);
        const tgtPctl = targetPercentileFromComplexity(complexity.complexityScore);
        const catData = buildCategoryPercentiles(allHistorical, item.category);
        const matches = findSimilarityMatches(item, allHistorical, pricingCurrency, fx, 3);
        const bandLow = Math.max(0.05, tgtPctl - 0.10);
        const bandHigh = Math.min(0.95, tgtPctl + 0.10);
        const bandLowGBP = interpolateAtPercentile(catData.feesGBP, bandLow);
        const bandHighGBP = interpolateAtPercentile(catData.feesGBP, bandHigh);
        const statsGBP = catData.stats;

        const aiMatch = aiResults.find(r =>
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
          const fallbackGBP = complexity.scope === 'broad' ? 25000 : complexity.scope === 'narrow' ? 5000 : 10000;
          suggestedPriceBaseGBP = smartRound(fallbackGBP, 'GBP');
          suggestedPrice = Math.max(smartRound(convertFromGBP(fallbackGBP, pricingCurrency, fx), pricingCurrency), minFee);
          explanation = `Default estimate (${complexity.scope} scope, no AI match)`;
        }

        let confidence = computeConfidence('TIER_3', 0, catData, fx, pricingCurrency);
        if (currencyWarning && confidence !== 'LOW') {
          confidence = confidence === 'HIGH' ? 'MEDIUM' : 'LOW';
        }

        baselineResults[index] = {
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
        };
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 2 — PRO-RATA SCALING TO HIT TARGET (pure maths, no re-matching)
    // ══════════════════════════════════════════════════════════════════════════

    const baselineTotal = baselineResults.reduce((sum, r) => sum + r.suggestedPrice, 0);

    if (baselineTotal <= 0) {
      return new Response(JSON.stringify({
        error: 'Cannot scale to target because baseline total is zero or invalid. Please run baseline pricing first or check selected items.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const scalingFactor = targetAmount / baselineTotal;
    console.log(`Stage 2: baselineTotal=${baselineTotal}, target=${targetAmount}, scalingFactor=${scalingFactor.toFixed(4)}`);

    // 6) Apply pro-rata scaling
    const scaledRaw = baselineResults.map(r => r.suggestedPrice * scalingFactor);

    // 7) Currency-specific rounding
    const roundedScaled = scaledRaw.map(v => smartRound(v, pricingCurrency));

    // 8) Reconciliation
    const roundedTotal = roundedScaled.reduce((s, v) => s + v, 0);
    let residual = targetAmount - roundedTotal;

    // Apply residual to largest item(s)
    const finalPrices = [...roundedScaled];

    if (Math.abs(residual) > 0) {
      // Sort indices by finalPrice descending
      const sortedIndices = finalPrices
        .map((_, i) => i)
        .sort((a, b) => finalPrices[b] - finalPrices[a]);

      for (const idx of sortedIndices) {
        if (Math.abs(residual) < 0.01) break;
        const adjusted = finalPrices[idx] + residual;
        if (adjusted >= 0) {
          finalPrices[idx] = adjusted;
          residual = 0;
          break;
        }
        // Would go negative — skip to next largest
      }
    }

    // Find which item was adjusted
    let itemAdjustedForResidual: string | null = null;
    for (let i = 0; i < finalPrices.length; i++) {
      if (finalPrices[i] !== roundedScaled[i]) {
        itemAdjustedForResidual = baselineResults[i].workItem;
        break;
      }
    }

    // Verify exact total
    const finalTotal = finalPrices.reduce((s, v) => s + v, 0);
    console.log(`Final total: ${finalTotal} (target: ${targetAmount}, match: ${finalTotal === targetAmount})`);

    // ══════════════════════════════════════════════════════════════════════════
    // BUILD OUTPUT
    // ══════════════════════════════════════════════════════════════════════════

    // Warnings
    const warnings: string[] = [];
    if (currencyWarning) warnings.push(currencyWarning);
    const extremeScale = scalingFactor < EXTREME_SCALE_LOW || scalingFactor > EXTREME_SCALE_HIGH;
    if (extremeScale) {
      warnings.push(`Target materially deviates from baseline estimate (scaling factor ${scalingFactor.toFixed(2)}×).`);
    }

    // Per-item allocations with full baseline + scaled data
    const allocations = baselineResults.map((baseline, i) => {
      // Determine per-item confidence: if extreme scale, downgrade by one level
      let itemConfidence = baseline.confidence;
      if (extremeScale && itemConfidence !== 'LOW') {
        itemConfidence = itemConfidence === 'HIGH' ? 'MEDIUM' : 'LOW';
      }

      return {
        work_item: baseline.workItem,
        // Baseline data
        baselinePrice: baseline.suggestedPrice,
        // Scaled data
        scaledPriceBeforeRounding: Math.round(scaledRaw[i] * 100) / 100,
        roundedScaledPrice: roundedScaled[i],
        finalPrice: finalPrices[i],
        // For backward compat — front-end reads fee_amount
        fee_amount: finalPrices[i],
        // Baseline engine output
        tierUsed: baseline.tierUsed,
        confidence: itemConfidence,
        baselineConfidence: baseline.confidence,
        explanation: baseline.explanation,
        scalingNote: `Scaled pro-rata by factor ${scalingFactor.toFixed(4)} to meet target total.`,
        // Complexity
        scope: baseline.scope,
        complexityScore: baseline.complexityScore,
        signals: baseline.signals,
        // Stats
        percentileStats: baseline.percentileStats,
        targetPercentile: baseline.targetPercentile,
        permittedBand: baseline.permittedBand,
        // Matches
        similarityMatches: baseline.similarityMatches,
        // Diagnostics
        diagnostics: baseline.diagnostics,
        // Backward compat
        rationale: baseline.explanation + ` | Scaled ${(scalingFactor * 100).toFixed(0)}% to meet target.`,
        matched: baseline.tierUsed !== 'TIER_3',
      };
    });

    return new Response(JSON.stringify({
      allocations,
      // Aggregate-level data
      baselineTotal,
      targetTotal: targetAmount,
      scalingFactor: Math.round(scalingFactor * 10000) / 10000,
      roundedTotalBeforeReconciliation: roundedTotal,
      residual: targetAmount - roundedTotal,
      itemAdjustedForResidual,
      // Metadata
      pricingCurrency,
      historicalDataUsed: allHistorical.length,
      precedentMatched: tier1Count + tier2Count,
      aiPriced: tier3Items.length,
      fxInfo: {
        rateUsed: convertToGBP(1, pricingCurrency, fx).fxInfo.rateUsed,
        source: fx.source,
        timestamp: fx.timestamp,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
      // Backward compat: targetAmount
      targetAmount,
      scaleFactor: Math.round(scalingFactor * 100),
      baseEstimate: baselineTotal,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in allocate-target-pricing:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your request. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
