import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Version: v4.0.0 — Scope-aware base pricing + deterministic scaling

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
  if (amount < 2500) return Math.round(amount / 500) * 500;
  return Math.round(amount / 1000) * 1000;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const frac = index - lower;
  if (lower + 1 >= sorted.length) return sorted[lower];
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower]);
}

// ── Scope Classification ─────────────────────────────────────────────────────

const BROAD_INDICATORS = /\b(report|comprehensive|full|all project|covering|review of all|package|suite|multi|portfolio|across|various|range of|complete|extensive|wide|broad|overall|summary|overview|entire|whole|master|global|general)\b/i;

const NARROW_INDICATORS = /\b(colombian|brazilian|chilean|peruvian|mexican|argentine|uruguayan|paraguayan|ecuadorian|bolivian|venezuelan|panamanian|costa rican|honduran|salvadoran|guatemalan|nicaraguan|dominican|cuban|jamaican|trinidadian|bvi|cayman|bermuda|bahamas|singapore|hong kong|thailand|vietnam|indonesia|malaysia|philippines|taiwan|korean|japanese|indian|chinese|australian|zealand|canadian|south african|nigerian|kenyan|ghanaian|tanzanian|ugandan|mozambican|zambian|zimbabwean|namibian|botswanan|angolan|congolese|senegalese|ivorian|cameroonian|ethiopian|egyptian|moroccan|tunisian|algerian|libyan|english|scottish|irish|welsh|french|german|spanish|italian|portuguese|dutch|belgian|swiss|austrian|swedish|norwegian|danish|finnish|polish|czech|hungarian|romanian|bulgarian|croatian|serbian|slovenian|slovak|greek|turkish|russian|ukrainian|estonian|latvian|lithuanian|cypriot|maltese|luxembourgish|icelandic)\b/i;

function classifyScope(workItem: string, detail: string | null): 'narrow' | 'moderate' | 'broad' {
  const combined = `${workItem} ${detail || ''}`;
  const detailLen = (detail || '').length;
  
  let score = 0;
  
  if (detailLen > 250) score += 2;
  else if (detailLen > 150) score += 1;
  else if (detailLen < 80) score -= 1;
  
  const broadMatches = combined.match(BROAD_INDICATORS);
  if (broadMatches) score += 2;
  
  const narrowMatches = workItem.match(NARROW_INDICATORS);
  if (narrowMatches) score -= 2;
  
  const words = significantWords(workItem);
  const hasProperNoun = /[A-Z][a-z]{2,}/.test(workItem.replace(/^[A-Z]/, 'x'));
  if (words.size <= 4 && !hasProperNoun && !narrowMatches) score += 1;
  
  if (score >= 3) return 'broad';
  if (score <= -1) return 'narrow';
  return 'moderate';
}

const MINIMUM_ITEM_FEE = 500;

interface CategoryPercentiles {
  count: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  fees: number[];
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

    const targetCurrency = currency || 'GBP';
    console.log(`allocate-target v4: ${targetAmount} ${targetCurrency} across ${items.length} items, user=${userId}`);

    // ── Phase 1: Fetch historical data WITH currency ────────────────────────

    const [budgetResult, proposalResult, mattersResult, ratesResult] = await Promise.all([
      supabase
        .from('budget_line_items')
        .select('work_item, category, provider, fee_amount, matter_id')
        .eq('user_id', userId)
        .gt('fee_amount', 0)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('pricing_proposal_items')
        .select('work_item, detail, category, provider, fee_amount, pricing_proposals(currency)')
        .eq('user_id', userId)
        .gt('fee_amount', 0)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('matters')
        .select('id, currency')
        .eq('user_id', userId),
      supabase
        .from('exchange_rates')
        .select('currency_code, rate_to_usd')
        .order('fetched_at', { ascending: false })
        .limit(20),
    ]);

    const matterCurrency: Record<string, string> = {};
    for (const m of (mattersResult.data || [])) {
      matterCurrency[m.id] = m.currency || 'GBP';
    }

    const fxRates: Record<string, number> = { USD: 1 };
    for (const r of (ratesResult.data || [])) {
      if (r.currency_code && r.rate_to_usd) fxRates[r.currency_code] = r.rate_to_usd;
    }
    if (!fxRates['GBP']) fxRates['GBP'] = 0.79;
    if (!fxRates['EUR']) fxRates['EUR'] = 0.92;

    const convertToTarget = (amount: number, srcCurrency: string): number => {
      if (srcCurrency === targetCurrency) return amount;
      const srcRate = fxRates[srcCurrency] || 1;
      const tgtRate = fxRates[targetCurrency] || 1;
      return amount * (tgtRate / srcRate);
    };

    interface HistItem { work_item: string; detail: string | null; category: string; provider: string; feeConverted: number; source: string; }

    const allHistorical: HistItem[] = [];
    for (const item of (budgetResult.data || [])) {
      const srcCur = matterCurrency[item.matter_id] || 'GBP';
      allHistorical.push({
        work_item: item.work_item,
        detail: null,
        category: item.category || 'Uncategorized',
        provider: item.provider,
        feeConverted: convertToTarget(item.fee_amount, srcCur),
        source: 'budget',
      });
    }
    for (const item of (proposalResult.data || [])) {
      const srcCur = (item as any).pricing_proposals?.currency || 'GBP';
      allHistorical.push({
        work_item: item.work_item,
        detail: (item as any).detail || null,
        category: item.category || 'Uncategorized',
        provider: item.provider,
        feeConverted: convertToTarget(item.fee_amount, srcCur),
        source: 'proposal',
      });
    }

    console.log(`Historical data: ${allHistorical.length} items`);

    // ── Build category percentile stats ─────────────────────────────────────

    const categoryPercentiles: Record<string, CategoryPercentiles> = {};
    for (const h of allHistorical) {
      const cat = h.category;
      if (!categoryPercentiles[cat]) {
        categoryPercentiles[cat] = { count: 0, p25: 0, p50: 0, p75: 0, p90: 0, fees: [] };
      }
      categoryPercentiles[cat].fees.push(h.feeConverted);
      categoryPercentiles[cat].count++;
    }
    for (const cat of Object.keys(categoryPercentiles)) {
      const cp = categoryPercentiles[cat];
      cp.p25 = percentile(cp.fees, 25);
      cp.p50 = median(cp.fees);
      cp.p75 = percentile(cp.fees, 75);
      cp.p90 = percentile(cp.fees, 90);
    }

    // ── Phase 2: Get UNCONSTRAINED base prices ──────────────────────────────
    // Step A: Tiered precedent matching (Tier 1: text match, Tier 2: scope-aware category)
    interface BasePrice { work_item: string; baseFee: number; rationale: string; }
    const basePrices: BasePrice[] = [];
    const unmatchedIndices: number[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let bestMatch: HistItem | null = null;
      let bestScore = 0;

      for (const hist of allHistorical) {
        const catMatch = !item.category || !hist.category || hist.category === 'Uncategorized' || hist.category === item.category;
        if (!catMatch) continue;
        let score = textSimilarity(item.work_item, hist.work_item);
        if (item.detail && hist.detail) score = score * 0.6 + textSimilarity(item.detail, hist.detail) * 0.4;
        if (item.provider === hist.provider) score += 0.1;
        if (item.category && hist.category === item.category) score += 0.15;
        if (score > bestScore) { bestScore = score; bestMatch = hist; }
      }

      // Tier 1: Strong text match
      if (bestMatch && bestScore >= 0.5) {
        basePrices.push({
          work_item: item.work_item,
          baseFee: Math.max(smartRound(bestMatch.feeConverted), MINIMUM_ITEM_FEE),
          rationale: `Precedent: "${bestMatch.work_item}" (score ${(bestScore * 100).toFixed(0)}%)`,
        });
        continue;
      }

      // Tier 2: Category match with scope-aware percentile pricing
      const catStats = item.category ? categoryPercentiles[item.category] : null;
      if (catStats && catStats.count >= 2) {
        const scope = classifyScope(item.work_item, item.detail || null);
        let scopeFee: number;
        let scopeLabel: string;
        
        if (scope === 'broad') {
          scopeFee = percentile(catStats.fees, 80);
          scopeLabel = `broad scope → 80th pctl`;
        } else if (scope === 'narrow') {
          scopeFee = catStats.p25;
          scopeLabel = `narrow scope → 25th pctl`;
        } else {
          scopeFee = catStats.p50;
          scopeLabel = `moderate scope → median`;
        }
        
        basePrices.push({
          work_item: item.work_item,
          baseFee: Math.max(smartRound(scopeFee), MINIMUM_ITEM_FEE),
          rationale: `${item.category} ${scopeLabel} (${catStats.count} precedents)`,
        });
        console.log(`Tier 2 scope-aware: "${item.work_item}" → scope=${scope}, fee=${smartRound(scopeFee)}`);
        continue;
      }

      // Tier 3: No match → send to AI
      basePrices.push({ work_item: item.work_item, baseFee: 0, rationale: '' });
      unmatchedIndices.push(i);
    }

    console.log(`Tier 1+2 matched: ${items.length - unmatchedIndices.length}, Tier 3 to AI: ${unmatchedIndices.length}`);

    // Step B: AI pricing for Tier 3 items
    if (unmatchedIndices.length > 0) {
      const currencySymbol = targetCurrency === 'GBP' ? '£' : targetCurrency === 'USD' ? '$' : '€';

      const unmatchedItems = unmatchedIndices.map(i => items[i]);

      // Build category-relevant context
      const categoryContext: string[] = [];
      for (const item of unmatchedItems) {
        const cat = item.category || 'Uncategorized';
        const catItems = allHistorical.filter(h => h.category === cat);
        const cp = categoryPercentiles[cat];
        
        if (catItems.length > 0 && cp) {
          const sorted = [...catItems].sort((a, b) => b.feeConverted - a.feeConverted);
          const top5 = sorted.slice(0, 5);
          const bottom5 = sorted.slice(-5);
          const scope = classifyScope(item.work_item, item.detail || null);

          categoryContext.push(`\nItem: "${item.work_item}"${item.detail ? ` — ${item.detail.substring(0, 300)}` : ''}
Provider: ${item.provider}, Category: ${cat}, Scope: ${scope.toUpperCase()}
${cat} percentiles: 25th=${currencySymbol}${Math.round(cp.p25).toLocaleString()}, median=${currencySymbol}${Math.round(cp.p50).toLocaleString()}, 75th=${currencySymbol}${Math.round(cp.p75).toLocaleString()}, 90th=${currencySymbol}${Math.round(cp.p90).toLocaleString()}
${scope === 'broad' ? '→ Price at 75th-90th percentile given broad scope.' : scope === 'narrow' ? '→ Price at 25th percentile given narrow scope.' : '→ Price around the median.'}
Highest: ${top5.map(h => `"${h.work_item}" ${currencySymbol}${Math.round(h.feeConverted).toLocaleString()}`).join('; ')}
Lowest: ${bottom5.map(h => `"${h.work_item}" ${currencySymbol}${Math.round(h.feeConverted).toLocaleString()}`).join('; ')}`);
        } else {
          categoryContext.push(`\nItem: "${item.work_item}"${item.detail ? ` — ${item.detail.substring(0, 300)}` : ''} (${item.provider}, ${cat}) — no category data`);
        }
      }

      const systemPrompt = `You are a legal fee proposal expert. Suggest UNCONSTRAINED base prices for work items. Do NOT try to hit any target — just estimate what each item is worth based on complexity and category.

All fees in ${targetCurrency} (${currencySymbol}). Minimum ${currencySymbol}${MINIMUM_ITEM_FEE} per item. All fees MUST be positive.
Round all fees to the nearest ${currencySymbol}1,000 (or ${currencySymbol}500 for small items under ${currencySymbol}2,500).

IMPORTANT: Pay close attention to each item's SCOPE classification and price accordingly within the percentile range.

OVERALL CATEGORY STATISTICS (${targetCurrency}):
${Object.entries(categoryPercentiles).map(([cat, cp]) =>
  `- ${cat}: ${cp.count} items, 25th=${currencySymbol}${Math.round(cp.p25).toLocaleString()}, median=${currencySymbol}${Math.round(cp.p50).toLocaleString()}, 75th=${currencySymbol}${Math.round(cp.p75).toLocaleString()}, 90th=${currencySymbol}${Math.round(cp.p90).toLocaleString()}`
).join('\n')}`;

      const userPrompt = `Suggest base prices for these ${unmatchedItems.length} items:
${categoryContext.join('\n')}

Return your best estimate of what each is worth. Do NOT try to hit any target total.`;

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
          textSimilarity(r.work_item, item.work_item) > 0.6
        );

        if (aiMatch && aiMatch.fee_amount > 0) {
          basePrices[idx] = {
            work_item: item.work_item,
            baseFee: Math.max(smartRound(aiMatch.fee_amount), MINIMUM_ITEM_FEE),
            rationale: aiMatch.rationale || 'AI estimated',
          };
        } else {
          // Fallback: scope-aware default
          const scope = classifyScope(item.work_item, item.detail || null);
          const fallbackFee = scope === 'broad' ? 25000 : scope === 'narrow' ? 5000 : 10000;
          basePrices[idx] = {
            work_item: item.work_item,
            baseFee: fallbackFee,
            rationale: `Default estimate (${scope} scope)`,
          };
        }
      }
    }

    // ── Phase 3: Deterministic scaling to hit target ────────────────────────

    const totalBaseFee = basePrices.reduce((sum, p) => sum + p.baseFee, 0);

    if (totalBaseFee <= 0) {
      const evenFee = smartRound(targetAmount / items.length);
      const allocations = basePrices.map(p => ({
        work_item: p.work_item,
        fee_amount: evenFee,
        rationale: 'Evenly distributed (no precedent data)',
      }));
      const totalEven = evenFee * items.length;
      if (totalEven !== targetAmount) {
        allocations[allocations.length - 1].fee_amount += (targetAmount - totalEven);
      }
      return new Response(JSON.stringify({ allocations, targetAmount, historicalDataUsed: allHistorical.length, scaleFactor: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const scaleFactor = targetAmount / totalBaseFee;
    console.log(`Base total: ${totalBaseFee}, target: ${targetAmount}, scale factor: ${(scaleFactor * 100).toFixed(1)}%`);

    const scaled = basePrices.map(p => ({
      work_item: p.work_item,
      rawScaled: p.baseFee * scaleFactor,
      rationale: p.rationale,
    }));

    const allocations = scaled.map(s => ({
      work_item: s.work_item,
      fee_amount: Math.max(smartRound(s.rawScaled), MINIMUM_ITEM_FEE),
      rationale: s.rationale + (scaleFactor !== 1 ? ` (scaled ${(scaleFactor * 100).toFixed(0)}%)` : ''),
    }));

    // ── Distribute rounding error ───────────────────────────────────────────

    let currentTotal = allocations.reduce((sum, a) => sum + a.fee_amount, 0);
    let remainder = targetAmount - currentTotal;

    if (Math.abs(remainder) > 0) {
      const increment = targetAmount >= 50000 ? 1000 : 500;

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
            if (allocations[idx].fee_amount - increment >= MINIMUM_ITEM_FEE) {
              allocations[idx].fee_amount -= increment;
              remainder += increment;
            }
          }
        }
        safetyCounter++;
      }

      if (Math.abs(remainder) > 0 && Math.abs(remainder) < increment) {
        const largestIdx = sortedIndices[0];
        allocations[largestIdx].fee_amount += remainder;
        remainder = 0;
      }
    }

    const finalTotal = allocations.reduce((sum, a) => sum + a.fee_amount, 0);
    console.log(`Final total: ${finalTotal} (target: ${targetAmount}, diff: ${targetAmount - finalTotal})`);

    return new Response(JSON.stringify({
      allocations,
      targetAmount,
      historicalDataUsed: allHistorical.length,
      scaleFactor: Math.round(scaleFactor * 100),
      baseEstimate: totalBaseFee,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in allocate-target-pricing:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
