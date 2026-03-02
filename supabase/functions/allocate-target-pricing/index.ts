import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Version: v3.0.0 — Two-phase: AI base prices + deterministic scaling

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

const MINIMUM_ITEM_FEE = 500;

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
    console.log(`allocate-target v3: ${targetAmount} ${targetCurrency} across ${items.length} items, user=${userId}`);

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

    // Build matter currency lookup
    const matterCurrency: Record<string, string> = {};
    for (const m of (mattersResult.data || [])) {
      matterCurrency[m.id] = m.currency || 'GBP';
    }

    // Build FX lookup
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

    // Build historical items with converted fees
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

    // ── Phase 2: Get UNCONSTRAINED base prices ──────────────────────────────
    // Step A: Precedent matching
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

      if (bestMatch && bestScore >= 0.5) {
        basePrices.push({
          work_item: item.work_item,
          baseFee: Math.max(smartRound(bestMatch.feeConverted), MINIMUM_ITEM_FEE),
          rationale: `Precedent: "${bestMatch.work_item}" (score ${(bestScore * 100).toFixed(0)}%)`,
        });
      } else {
        basePrices.push({ work_item: item.work_item, baseFee: 0, rationale: '' });
        unmatchedIndices.push(i);
      }
    }

    console.log(`Precedent matched: ${items.length - unmatchedIndices.length}, sending ${unmatchedIndices.length} to AI`);

    // Step B: AI pricing for unmatched items
    if (unmatchedIndices.length > 0) {
      const currencySymbol = targetCurrency === 'GBP' ? '£' : targetCurrency === 'USD' ? '$' : '€';

      // Category stats for context
      const catStats: Record<string, { count: number; avg: number }> = {};
      for (const h of allHistorical) {
        if (!catStats[h.category]) catStats[h.category] = { count: 0, avg: 0 };
        catStats[h.category].count++;
        catStats[h.category].avg += h.feeConverted;
      }
      for (const cat of Object.keys(catStats)) {
        catStats[cat].avg = Math.round(catStats[cat].avg / catStats[cat].count);
      }

      const unmatchedItems = unmatchedIndices.map(i => items[i]);

      const systemPrompt = `You are a legal fee proposal expert. Suggest UNCONSTRAINED base prices for work items. Do NOT try to hit any target — just estimate what each item is worth based on complexity and category.

All fees in ${targetCurrency} (${currencySymbol}). Minimum ${currencySymbol}${MINIMUM_ITEM_FEE} per item. All fees MUST be positive.

CATEGORY AVERAGES (${targetCurrency}):
${Object.entries(catStats).map(([c, s]) => `- ${c}: avg ${currencySymbol}${s.avg.toLocaleString()} (${s.count} items)`).join('\n')}

SAMPLE HISTORICAL (${targetCurrency}):
${allHistorical.slice(0, 25).map(h => `- "${h.work_item}" (${h.category}, ${h.provider}): ${currencySymbol}${Math.round(h.feeConverted).toLocaleString()}`).join('\n')}`;

      const userPrompt = `Suggest base prices for these ${unmatchedItems.length} items:

${unmatchedItems.map((item: any, i: number) =>
  `${i + 1}. "${item.work_item}"${item.detail ? ` — ${item.detail.substring(0, 200)}` : ''} (${item.provider}, ${item.category || 'Uncategorized'})`
).join('\n')}

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

      // Map AI results back to unmatched items
      const aiResults: { work_item: string; fee_amount: number; rationale: string }[] = [];
      for (const tc of toolCalls) {
        if (tc.function?.name === 'suggest_base_prices') {
          try {
            const parsed = JSON.parse(tc.function.arguments);
            if (parsed.prices) aiResults.push(...parsed.prices);
          } catch (e) { console.error('Parse error:', e); }
        }
      }

      // Match AI results to unmatched items
      for (let j = 0; j < unmatchedIndices.length; j++) {
        const idx = unmatchedIndices[j];
        const item = items[idx];

        // Find best AI match
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
          // Fallback: use category average or a default
          const catAvg = catStats[item.category]?.avg;
          const fallbackFee = catAvg ? smartRound(catAvg) : 5000;
          basePrices[idx] = {
            work_item: item.work_item,
            baseFee: Math.max(fallbackFee, MINIMUM_ITEM_FEE),
            rationale: catAvg ? `Category average (${item.category})` : 'Default estimate',
          };
        }
      }
    }

    // ── Phase 3: Deterministic scaling to hit target ────────────────────────

    const totalBaseFee = basePrices.reduce((sum, p) => sum + p.baseFee, 0);

    if (totalBaseFee <= 0) {
      // Edge case: all items got minimum fees, distribute evenly
      const evenFee = smartRound(targetAmount / items.length);
      const allocations = basePrices.map(p => ({
        work_item: p.work_item,
        fee_amount: evenFee,
        rationale: 'Evenly distributed (no precedent data)',
      }));
      // Adjust last item for exact total
      const totalEven = evenFee * items.length;
      if (totalEven !== targetAmount) {
        allocations[allocations.length - 1].fee_amount += (targetAmount - totalEven);
      }
      return new Response(JSON.stringify({ allocations, targetAmount, historicalDataUsed: allHistorical.length, scaleFactor: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const scaleFactor = targetAmount / totalBaseFee;
    console.log(`Base total: ${totalBaseFee}, target: ${targetAmount}, scale factor: ${(scaleFactor * 100).toFixed(1)}%`);

    // Scale all items
    const scaled = basePrices.map(p => ({
      work_item: p.work_item,
      rawScaled: p.baseFee * scaleFactor,
      rationale: p.rationale,
    }));

    // Smart round each item, enforcing minimum
    const allocations = scaled.map(s => ({
      work_item: s.work_item,
      fee_amount: Math.max(smartRound(s.rawScaled), MINIMUM_ITEM_FEE),
      rationale: s.rationale + (scaleFactor !== 1 ? ` (scaled ${(scaleFactor * 100).toFixed(0)}%)` : ''),
    }));

    // ── Distribute rounding error ───────────────────────────────────────────

    let currentTotal = allocations.reduce((sum, a) => sum + a.fee_amount, 0);
    let remainder = targetAmount - currentTotal;

    if (Math.abs(remainder) > 0) {
      // Determine increment size based on deal size
      const increment = targetAmount >= 100000 ? 1000 : 100;

      // Sort indices by fee descending for distribution
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
            // Only subtract if it won't go below minimum
            if (allocations[idx].fee_amount - increment >= MINIMUM_ITEM_FEE) {
              allocations[idx].fee_amount -= increment;
              remainder += increment;
            }
          }
        }
        safetyCounter++;
      }

      // Handle any tiny remainder left (less than increment) — add to largest item
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
    return new Response(JSON.stringify({ error: 'An error occurred. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
