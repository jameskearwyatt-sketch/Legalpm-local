import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Version: v4.0.0 — Scope-aware pricing intelligence with percentile-based anchoring

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
  
  // Detail length signals
  if (detailLen > 250) score += 2;
  else if (detailLen > 150) score += 1;
  else if (detailLen < 80) score -= 1;
  
  // Keyword signals
  const broadMatches = combined.match(BROAD_INDICATORS);
  if (broadMatches) score += 2;
  
  const narrowMatches = workItem.match(NARROW_INDICATORS);
  if (narrowMatches) score -= 2;
  
  // Generic work_item (short, no proper nouns) signals broad
  const words = significantWords(workItem);
  const hasProperNoun = /[A-Z][a-z]{2,}/.test(workItem.replace(/^[A-Z]/, 'x')); // ignore first letter
  if (words.size <= 4 && !hasProperNoun && !narrowMatches) score += 1;
  
  if (score >= 3) return 'broad';
  if (score <= -1) return 'narrow';
  return 'moderate';
}

interface HistoricalItem {
  work_item: string;
  detail: string | null;
  category: string;
  provider: string;
  fee: number;
  feeConverted: number;
  source: string;
}

interface CategoryPercentiles {
  count: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
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
    const { items, currency, proposalId, pricedItemsInProposal } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetCurrency = currency || 'GBP';
    console.log(`suggest-pricing v4: ${items.length} items, currency=${targetCurrency}, user=${userId}`);

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
        .select('work_item, detail, category, provider, fee_amount, fee_lower, fee_upper, proposal_id, pricing_proposals(currency)')
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

    const convertToTarget = (amount: number, sourceCurrency: string): number => {
      if (sourceCurrency === targetCurrency) return amount;
      const srcRate = fxRates[sourceCurrency] || 1;
      const tgtRate = fxRates[targetCurrency] || 1;
      return amount * (tgtRate / srcRate);
    };

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

    const currentProposalPriced: HistoricalItem[] = (pricedItemsInProposal || []).map((item: any) => ({
      work_item: item.work_item,
      detail: item.detail || null,
      category: item.category || 'Uncategorized',
      provider: item.provider,
      fee: item.fee_amount,
      feeConverted: item.fee_amount,
      source: 'current_proposal',
    }));

    const allHistorical = [...budgetItems, ...proposalItems, ...currentProposalPriced];
    console.log(`Historical: ${budgetItems.length} budget, ${proposalItems.length} proposal, ${currentProposalPriced.length} current`);

    // ── Build category percentile stats ─────────────────────────────────────

    const categoryPercentiles: Record<string, CategoryPercentiles> = {};
    for (const h of allHistorical) {
      const cat = h.category;
      if (!categoryPercentiles[cat]) {
        categoryPercentiles[cat] = { count: 0, p25: 0, p50: 0, p75: 0, p90: 0, min: Infinity, max: 0, fees: [] };
      }
      categoryPercentiles[cat].fees.push(h.feeConverted);
      categoryPercentiles[cat].count++;
      categoryPercentiles[cat].min = Math.min(categoryPercentiles[cat].min, h.feeConverted);
      categoryPercentiles[cat].max = Math.max(categoryPercentiles[cat].max, h.feeConverted);
    }
    for (const cat of Object.keys(categoryPercentiles)) {
      const cp = categoryPercentiles[cat];
      cp.p25 = percentile(cp.fees, 25);
      cp.p50 = median(cp.fees);
      cp.p75 = percentile(cp.fees, 75);
      cp.p90 = percentile(cp.fees, 90);
    }

    // ── Phase 2: Tiered precedent matching ──────────────────────────────────

    interface PriceResult {
      work_item: string;
      fee_amount: number;
      rationale: string;
      matched: boolean;
    }

    const matchedResults: PriceResult[] = [];
    const unmatchedItems: any[] = [];

    for (const item of items) {
      // Find best text match (Tier 1)
      let bestMatch: HistoricalItem | null = null;
      let bestScore = 0;

      for (const hist of allHistorical) {
        const catMatch = !item.category || !hist.category ||
          hist.category === 'Uncategorized' ||
          hist.category === item.category;
        if (!catMatch) continue;

        let score = textSimilarity(item.work_item, hist.work_item);
        if (item.detail && hist.detail) {
          const detailScore = textSimilarity(item.detail, hist.detail);
          score = score * 0.6 + detailScore * 0.4;
        }
        if (item.provider === hist.provider) score += 0.1;
        if (item.category && hist.category === item.category) score += 0.15;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = hist;
        }
      }

      // Tier 1: Strong text match
      if (bestMatch && bestScore >= 0.5) {
        const convertedFee = smartRound(bestMatch.feeConverted);
        matchedResults.push({
          work_item: item.work_item,
          fee_amount: Math.max(convertedFee, 500),
          rationale: `Based on precedent "${bestMatch.work_item}" (${bestMatch.source}, score ${(bestScore * 100).toFixed(0)}%)`,
          matched: true,
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
          scopeLabel = 'broad scope → 80th percentile';
        } else if (scope === 'narrow') {
          scopeFee = catStats.p25;
          scopeLabel = 'narrow scope → 25th percentile';
        } else {
          scopeFee = catStats.p50;
          scopeLabel = 'moderate scope → median';
        }
        
        const roundedFee = smartRound(scopeFee);
        matchedResults.push({
          work_item: item.work_item,
          fee_amount: Math.max(roundedFee, 500),
          rationale: `${item.category} ${scopeLabel} (${catStats.count} precedents, range ${Math.round(catStats.min).toLocaleString()}-${Math.round(catStats.max).toLocaleString()})`,
          matched: true,
        });
        console.log(`Tier 2 scope-aware: "${item.work_item}" → scope=${scope}, fee=${roundedFee}`);
        continue;
      }

      // Tier 3: No category data → send to AI
      unmatchedItems.push(item);
    }

    console.log(`Tier 1 matched: ${matchedResults.length - unmatchedItems.length}, Tier 2 scope-aware: ${matchedResults.length}, Tier 3 to AI: ${unmatchedItems.length}`);

    // ── Phase 3: AI pricing for Tier 3 items ────────────────────────────────

    let aiPrices: PriceResult[] = [];

    if (unmatchedItems.length > 0) {
      const currencySymbol = targetCurrency === 'GBP' ? '£' : targetCurrency === 'USD' ? '$' : '€';

      // Build category-relevant context per unmatched item
      const categoryContext: string[] = [];
      for (const item of unmatchedItems) {
        const cat = item.category || 'Uncategorized';
        const catItems = allHistorical.filter(h => h.category === cat);
        const cp = categoryPercentiles[cat];
        
        if (catItems.length > 0 && cp) {
          // Top 5 highest and 5 lowest from category
          const sorted = [...catItems].sort((a, b) => b.feeConverted - a.feeConverted);
          const top5 = sorted.slice(0, 5);
          const bottom5 = sorted.slice(-5);
          const scope = classifyScope(item.work_item, item.detail || null);

          categoryContext.push(`\nItem: "${item.work_item}"${item.detail ? ` — ${item.detail.substring(0, 300)}` : ''}
Provider: ${item.provider}, Category: ${cat}, Scope: ${scope.toUpperCase()}
${cat} percentiles: 25th=${currencySymbol}${Math.round(cp.p25).toLocaleString()}, median=${currencySymbol}${Math.round(cp.p50).toLocaleString()}, 75th=${currencySymbol}${Math.round(cp.p75).toLocaleString()}, 90th=${currencySymbol}${Math.round(cp.p90).toLocaleString()}
${scope === 'broad' ? '→ Price at 75th-90th percentile given broad scope.' : scope === 'narrow' ? '→ Price at 25th percentile given narrow scope.' : '→ Price around the median.'}
Highest in category: ${top5.map(h => `"${h.work_item}" ${currencySymbol}${Math.round(h.feeConverted).toLocaleString()}`).join('; ')}
Lowest in category: ${bottom5.map(h => `"${h.work_item}" ${currencySymbol}${Math.round(h.feeConverted).toLocaleString()}`).join('; ')}`);
        } else {
          categoryContext.push(`\nItem: "${item.work_item}"${item.detail ? ` — ${item.detail.substring(0, 300)}` : ''} (${item.provider}, ${cat}) — no historical data for this category`);
        }
      }

      const systemPrompt = `You are a legal fee proposal expert for Baker McKenzie. Suggest fee amounts for work items that have no direct historical precedent.

All amounts must be in ${targetCurrency} (${currencySymbol}).
All fees must be POSITIVE (minimum ${currencySymbol}500).
Round all fees to the nearest ${currencySymbol}1,000 (or ${currencySymbol}500 for small items under ${currencySymbol}2,500).

IMPORTANT: Pay close attention to each item's SCOPE classification:
- BROAD scope items (comprehensive reports, full packages, multi-jurisdiction work) should be priced at the HIGH END of their category range (75th-90th percentile).
- NARROW scope items (single entity, single jurisdiction, specific tasks) should be priced at the LOW END (25th percentile).
- MODERATE scope items should be priced around the MEDIAN.

OVERALL CATEGORY STATISTICS (${targetCurrency}):
${Object.entries(categoryPercentiles).map(([cat, cp]) =>
  `- ${cat}: ${cp.count} items, 25th=${currencySymbol}${Math.round(cp.p25).toLocaleString()}, median=${currencySymbol}${Math.round(cp.p50).toLocaleString()}, 75th=${currencySymbol}${Math.round(cp.p75).toLocaleString()}, 90th=${currencySymbol}${Math.round(cp.p90).toLocaleString()}`
).join('\n')}`;

      const userPrompt = `Suggest fees for these ${unmatchedItems.length} items:
${categoryContext.join('\n')}`;

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

    for (const p of allPrices) {
      if (p.fee_amount < 0) p.fee_amount = 500;
    }

    console.log(`Returning ${allPrices.length} prices (${matchedResults.length} matched/scope-aware, ${aiPrices.length} AI)`);

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
