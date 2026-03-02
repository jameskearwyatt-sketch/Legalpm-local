import {
  classifyComplexity,
  computePercentileStats,
  targetPercentileFromComplexity,
  smartRound,
  convertToGBP,
  convertFromGBP,
  normalisedFeeSeries,
  buildCategoryPercentiles,
  textSimilarity,
  priceItem,
  computeConfidence,
  type FXRateSet,
  type HistoricalItem,
  type PricingResult,
  FALLBACK_FX_RATES,
  SPARSE_CATEGORY_THRESHOLD,
} from "../_shared/pricingEngine.ts";
import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

const defaultFX: FXRateSet = {
  rates: { ...FALLBACK_FX_RATES },
  source: 'db_table',
  timestamp: '2026-03-01T00:00:00Z',
};

function makeHistoricalItem(overrides: Partial<HistoricalItem>): HistoricalItem {
  return {
    work_item: 'Test item',
    detail: null,
    category: 'Due Diligence',
    provider: 'Baker McKenzie',
    feeOriginal: 15000,
    feeOriginalCurrency: 'GBP',
    feeGBP: 15000,
    source: 'finalized_budget',
    ...overrides,
  };
}

function makeDDHistorical(): HistoricalItem[] {
  const items: HistoricalItem[] = [];
  const ddFees = [7400, 10000, 12000, 14000, 15000, 15000, 16000, 17000, 18000, 20000,
    22000, 25000, 26000, 30000, 35000, 45000, 55000, 80000, 120000, 287500];
  const ddNames = [
    'Corporate search — BVI', 'Corporate DD on BVI entity', 'Colombian DD (incl land)',
    'Chilean corporate DD', 'Peruvian regulatory DD', 'Condition precedent DD',
    'Environmental DD review', 'Title DD review', 'Insurance DD review',
    'Tax DD review', 'Labour DD', 'Regulatory approvals DD',
    'Grid connection DD', 'Land rights DD review', 'Permits and licences DD',
    'Technical DD review', 'Financial model DD', 'Comprehensive DD report',
    'Full DD report covering all project documents', 'Due diligence report — comprehensive',
  ];
  for (let i = 0; i < ddFees.length; i++) {
    items.push(makeHistoricalItem({
      work_item: ddNames[i],
      feeGBP: ddFees[i],
      feeOriginal: ddFees[i],
      matterId: `matter-${i}`,
    }));
  }
  return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Simulate Stage 2 scaling logic (mirrors allocate-target-pricing)
// ═══════════════════════════════════════════════════════════════════════════════

function stage2Scale(
  baselinePrices: number[],
  targetTotal: number,
  pricingCurrency: string
): {
  scalingFactor: number;
  scaledRaw: number[];
  roundedScaled: number[];
  finalPrices: number[];
  residual: number;
  itemAdjustedIndex: number | null;
} {
  const baselineTotal = baselinePrices.reduce((s, v) => s + v, 0);
  if (baselineTotal <= 0) throw new Error('Baseline total <= 0');

  const scalingFactor = targetTotal / baselineTotal;
  const scaledRaw = baselinePrices.map(p => p * scalingFactor);
  const roundedScaled = scaledRaw.map(v => smartRound(v, pricingCurrency));
  const roundedTotal = roundedScaled.reduce((s, v) => s + v, 0);
  let residual = targetTotal - roundedTotal;

  const finalPrices = [...roundedScaled];
  let itemAdjustedIndex: number | null = null;

  if (Math.abs(residual) > 0) {
    const sortedIndices = finalPrices
      .map((_, i) => i)
      .sort((a, b) => finalPrices[b] - finalPrices[a]);

    for (const idx of sortedIndices) {
      if (Math.abs(residual) < 0.01) break;
      const adjusted = finalPrices[idx] + residual;
      if (adjusted >= 0) {
        finalPrices[idx] = adjusted;
        itemAdjustedIndex = idx;
        residual = 0;
        break;
      }
    }
  }

  return { scalingFactor, scaledRaw, roundedScaled, finalPrices, residual: targetTotal - roundedTotal, itemAdjustedIndex };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Broad vs Narrow DD
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("classifyComplexity: broad DD report", () => {
  const result = classifyComplexity(
    "Due diligence report",
    "Comprehensive review of all project documents including PPAs, land leases, EPC contracts, O&M agreements, grid connection agreements, share purchase agreements, financing documents, environmental permits, construction permits, insurance policies, and corporate structure documents across 3 jurisdictions."
  );
  assertEquals(result.scope, "broad");
  if (result.complexityScore < 3) throw new Error(`Expected score >= 3, got ${result.complexityScore}`);
  if (result.signals.length === 0) throw new Error("Expected signals to be populated");
});

Deno.test("classifyComplexity: narrow DD task", () => {
  const result = classifyComplexity(
    "Colombian DD (incl land)",
    "Review of Colombian land title"
  );
  assertEquals(result.scope, "narrow");
  if (result.complexityScore > -1) throw new Error(`Expected score <= -1, got ${result.complexityScore}`);
});

Deno.test("classifyComplexity: moderate DD task", () => {
  const result = classifyComplexity(
    "Environmental DD review",
    "Review of environmental permits and compliance certificates"
  );
  assertEquals(result.scope, "moderate");
});

Deno.test("classifyComplexity: full security package", () => {
  const result = classifyComplexity(
    "Security package",
    "Complete security suite including share pledges, account charges, assignment of receivables, direct agreements, and step-in rights across all project entities"
  );
  assertEquals(result.scope, "broad");
});

Deno.test("classifyComplexity: single security agreement", () => {
  const result = classifyComplexity(
    "BVI share pledge",
    "Pledge over shares in BVI SPV"
  );
  assertEquals(result.scope, "narrow");
});

Deno.test("classifyComplexity: multi-jurisdiction opinion", () => {
  const result = classifyComplexity(
    "Legal opinion",
    "Multi-jurisdiction legal opinion covering English, Colombian, Chilean, Peruvian, and Panamanian law aspects of the financing documents"
  );
  assertEquals(result.scope, "broad");
  const multiJurisSignal = result.signals.find(s => s.includes('Multi-jurisdiction'));
  if (!multiJurisSignal) throw new Error("Expected multi-jurisdiction signal");
});

Deno.test("classifyComplexity: single jurisdiction opinion", () => {
  const result = classifyComplexity(
    "English law legal opinion",
    "Opinion on capacity and enforceability under English law"
  );
  if (result.scope === 'broad') throw new Error("Single jurisdiction opinion should not be broad");
});

Deno.test("convertToGBP: identity for GBP", () => {
  const { amountGBP } = convertToGBP(10000, 'GBP', defaultFX);
  assertEquals(amountGBP, 10000);
});

Deno.test("convertToGBP: USD to GBP", () => {
  const { amountGBP, fxInfo } = convertToGBP(10000, 'USD', defaultFX);
  assertAlmostEquals(amountGBP, 7900, 100);
  assertEquals(fxInfo.source, 'db_table');
});

Deno.test("convertFromGBP: GBP to USD", () => {
  const amountUSD = convertFromGBP(10000, 'USD', defaultFX);
  assertAlmostEquals(amountUSD, 12658, 200);
});

Deno.test("convertToGBP: fallback FX flagged", () => {
  const sparseRates: FXRateSet = { rates: { USD: 1 }, source: 'fallback', timestamp: null };
  const { fxInfo } = convertToGBP(10000, 'SGD', sparseRates);
  assertEquals(fxInfo.source, 'fallback');
});

Deno.test("FX round-trip consistency", () => {
  const originalGBP = 50000;
  const usd = convertFromGBP(originalGBP, 'USD', defaultFX);
  const { amountGBP } = convertToGBP(usd, 'USD', defaultFX);
  assertAlmostEquals(amountGBP, originalGBP, 10);
});

Deno.test("buildCategoryPercentiles: sparse category", () => {
  const items = [
    makeHistoricalItem({ category: 'Rare Category', feeGBP: 5000 }),
    makeHistoricalItem({ category: 'Rare Category', feeGBP: 10000 }),
    makeHistoricalItem({ category: 'Rare Category', feeGBP: 15000 }),
  ];
  const result = buildCategoryPercentiles(items, 'Rare Category');
  assertEquals(result.sparse, true);
  if (result.stats.n < 3) throw new Error("Should still use available data");
});

Deno.test("buildCategoryPercentiles: empty category falls back to all items", () => {
  const items = makeDDHistorical();
  const result = buildCategoryPercentiles(items, 'NonExistent Category');
  assertEquals(result.sparse, true);
  if (result.stats.n === 0) throw new Error("Should fall back to all-items percentiles");
});

Deno.test("smartRound: GBP rules", () => {
  assertEquals(smartRound(3200, 'GBP'), 3000);
  assertEquals(smartRound(3750, 'GBP'), 4000);
  assertEquals(smartRound(24800, 'GBP'), 25000);
  assertEquals(smartRound(55000, 'GBP'), 55000);
  assertEquals(smartRound(123000, 'GBP'), 125000);
});

Deno.test("smartRound: USD rules", () => {
  assertEquals(smartRound(3200, 'USD'), 3000);
  assertEquals(smartRound(48500, 'USD'), 49000);
  assertEquals(smartRound(75000, 'USD'), 75000);
  assertEquals(smartRound(260000, 'USD'), 260000);
});

Deno.test("smartRound: EUR rules", () => {
  assertEquals(smartRound(5500, 'EUR'), 6000);
  assertEquals(smartRound(45400, 'EUR'), 45000);
});

Deno.test("computePercentileStats: basic", () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const stats = computePercentileStats(values);
  assertEquals(stats.n, 10);
  assertAlmostEquals(stats.p50, 55, 1);
  if (stats.IQR <= 0) throw new Error("IQR should be positive");
});

Deno.test("targetPercentileFromComplexity: broad", () => {
  const pctl = targetPercentileFromComplexity(5);
  assertAlmostEquals(pctl, 0.65, 0.01);
});

Deno.test("targetPercentileFromComplexity: narrow", () => {
  const pctl = targetPercentileFromComplexity(-2);
  assertEquals(pctl, 0.20);
});

Deno.test("targetPercentileFromComplexity: very broad capped at 0.90", () => {
  const pctl = targetPercentileFromComplexity(10);
  assertEquals(pctl, 0.90);
});

Deno.test("textSimilarity: identical strings return object with score", () => {
  const result = textSimilarity("corporate diligence review land title", "corporate diligence review land title");
  if (typeof result.score !== 'number') throw new Error("Expected score to be a number");
  if (!Array.isArray(result.matchSignals)) throw new Error("Expected matchSignals array");
});

Deno.test("textSimilarity: related strings return object", () => {
  const result = textSimilarity("diligence report covering documents", "diligence review covering agreements");
  if (typeof result.score !== 'number') throw new Error("Expected score to be a number");
});

Deno.test("textSimilarity: unrelated strings", () => {
  const result = textSimilarity("diligence report", "share purchase agreement");
  if (result.score > 0.5) throw new Error(`Expected low similarity, got ${result.score}`);
});

Deno.test("normalisedFeeSeries: deduplicates same matter+work_item", () => {
  const items = [
    makeHistoricalItem({ matterId: 'm1', work_item: 'Colombian DD', feeGBP: 15000 }),
    makeHistoricalItem({ matterId: 'm1', work_item: 'Colombian DD', feeGBP: 16000 }),
    makeHistoricalItem({ matterId: 'm2', work_item: 'Colombian DD', feeGBP: 14000 }),
  ];
  const series = normalisedFeeSeries(items, 'Due Diligence');
  assertEquals(series.count, 2);
  assertEquals(series.diagnostics.deduplicatedCount, 2);
});

Deno.test("priceItem: broad DD report priced at high percentile (Tier 2)", () => {
  const historical = makeDDHistorical();
  const result = priceItem(
    {
      work_item: "Due diligence report",
      detail: "Comprehensive review of all project documents including PPAs, land leases, EPC contracts, O&M agreements, grid connection agreements, and financing documents",
      category: "Due Diligence",
      provider: "Baker McKenzie",
    },
    historical, 'GBP', defaultFX
  );
  if (!result) throw new Error("Expected Tier 2 result, got null (Tier 3)");
  assertEquals(result.tierUsed, 'TIER_2');
  assertEquals(result.scope, 'broad');
  if (result.suggestedPrice < 20000) throw new Error(`Broad DD should be above median. Got £${result.suggestedPrice}`);
});

Deno.test("priceItem: narrow DD task priced at low percentile (Tier 2)", () => {
  const historical = makeDDHistorical();
  const result = priceItem(
    {
      work_item: "Colombian DD (incl land)",
      detail: "Review of Colombian land title",
      category: "Due Diligence",
      provider: "Local Counsel",
    },
    historical, 'GBP', defaultFX
  );
  if (!result) throw new Error("Expected priced result");
  if (result.suggestedPrice > 25000) throw new Error(`Narrow DD should be below median. Got £${result.suggestedPrice}`);
});

Deno.test("priceItem: USD deal returns price in USD", () => {
  const historical = makeDDHistorical();
  const result = priceItem(
    {
      work_item: "Due diligence report",
      detail: "Comprehensive review covering 15 document categories",
      category: "Due Diligence",
      provider: "Baker McKenzie",
    },
    historical, 'USD', defaultFX
  );
  if (!result) throw new Error("Expected result");
  assertEquals(result.pricingCurrency, 'USD');
  if (result.suggestedPrice <= result.suggestedPriceBaseGBP) {
    throw new Error(`USD price ($${result.suggestedPrice}) should be higher than GBP base (£${result.suggestedPriceBaseGBP})`);
  }
});

Deno.test("priceItem: returns complete output structure", () => {
  const historical = makeDDHistorical();
  const result = priceItem(
    { work_item: "Tax DD review", detail: "Review of tax structure", category: "Due Diligence", provider: "Baker McKenzie" },
    historical, 'GBP', defaultFX
  );
  if (!result) throw new Error("Expected result");
  if (result.suggestedPrice === undefined) throw new Error("Missing suggestedPrice");
  if (result.pricingCurrency === undefined) throw new Error("Missing pricingCurrency");
  if (result.suggestedPriceBaseGBP === undefined) throw new Error("Missing suggestedPriceBaseGBP");
  if (result.tierUsed === undefined) throw new Error("Missing tierUsed");
  if (result.confidence === undefined) throw new Error("Missing confidence");
  if (result.scope === undefined) throw new Error("Missing scope");
  if (result.complexityScore === undefined) throw new Error("Missing complexityScore");
  if (!result.signals) throw new Error("Missing signals");
  if (!result.percentileStats) throw new Error("Missing percentileStats");
  if (result.targetPercentile === undefined) throw new Error("Missing targetPercentile");
  if (!result.permittedBand) throw new Error("Missing permittedBand");
  if (!result.similarityMatches) throw new Error("Missing similarityMatches");
  if (!result.explanation) throw new Error("Missing explanation");
  if (!result.diagnostics) throw new Error("Missing diagnostics");
  const ps = result.percentileStats;
  if (ps.p25 === undefined || ps.p50 === undefined || ps.p75 === undefined || ps.p90 === undefined) throw new Error("Missing percentile stat field");
  if (ps.n === undefined || ps.IQR === undefined) throw new Error("Missing n or IQR");
  const d = result.diagnostics;
  if (d.fxRateUsed === undefined) throw new Error("Missing fxRateUsed");
  if (d.fxSource === undefined) throw new Error("Missing fxSource");
  if (d.categoryCount === undefined) throw new Error("Missing categoryCount");
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW: Target allocation Stage 2 tests
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("Stage 2: exact total matching after rounding + reconciliation (GBP)", () => {
  const baselines = [15000, 25000, 35000, 10000, 5000];
  const target = 120000;
  const result = stage2Scale(baselines, target, 'GBP');
  const finalTotal = result.finalPrices.reduce((s, v) => s + v, 0);
  assertEquals(finalTotal, target, `Final total ${finalTotal} must equal target ${target}`);
});

Deno.test("Stage 2: exact total matching (USD)", () => {
  const baselines = [12000, 30000, 45000, 8000];
  const target = 150000;
  const result = stage2Scale(baselines, target, 'USD');
  const finalTotal = result.finalPrices.reduce((s, v) => s + v, 0);
  assertEquals(finalTotal, target, `Final total ${finalTotal} must equal target ${target}`);
});

Deno.test("Stage 2: exact total matching (EUR)", () => {
  const baselines = [20000, 40000, 60000];
  const target = 200000;
  const result = stage2Scale(baselines, target, 'EUR');
  const finalTotal = result.finalPrices.reduce((s, v) => s + v, 0);
  assertEquals(finalTotal, target, `Final total ${finalTotal} must equal target ${target}`);
});

Deno.test("Stage 2: baselineTotal <= 0 throws error", () => {
  let threw = false;
  try {
    stage2Scale([0, 0, 0], 100000, 'GBP');
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "Should throw when baseline total is zero");
});

Deno.test("Stage 2: largest-item residual adjustment", () => {
  const baselines = [50000, 30000, 20000];
  const target = 110000;
  const result = stage2Scale(baselines, target, 'GBP');
  const finalTotal = result.finalPrices.reduce((s, v) => s + v, 0);
  assertEquals(finalTotal, target);
  // The largest item should have been adjusted
  if (result.itemAdjustedIndex !== null) {
    // The adjusted item should be the one with the largest rounded price
    const maxRounded = Math.max(...result.roundedScaled);
    const maxIdx = result.roundedScaled.indexOf(maxRounded);
    assertEquals(result.itemAdjustedIndex, maxIdx, "Residual should be applied to largest item");
  }
});

Deno.test("Stage 2: no item goes negative", () => {
  // Small baselines with large target → should still work
  const baselines = [500, 500, 500];
  const target = 5000;
  const result = stage2Scale(baselines, target, 'GBP');
  for (const p of result.finalPrices) {
    if (p < 0) throw new Error(`Item price ${p} went negative`);
  }
  const finalTotal = result.finalPrices.reduce((s, v) => s + v, 0);
  assertEquals(finalTotal, target);
});

Deno.test("Stage 2: extreme scaling factor < 0.5", () => {
  const baselines = [50000, 100000, 80000]; // total 230k
  const target = 80000; // factor ≈ 0.35
  const result = stage2Scale(baselines, target, 'GBP');
  if (result.scalingFactor >= 0.5) throw new Error(`Expected extreme low factor, got ${result.scalingFactor}`);
  const finalTotal = result.finalPrices.reduce((s, v) => s + v, 0);
  assertEquals(finalTotal, target);
});

Deno.test("Stage 2: extreme scaling factor > 2.0", () => {
  const baselines = [10000, 15000, 5000]; // total 30k
  const target = 100000; // factor ≈ 3.33
  const result = stage2Scale(baselines, target, 'GBP');
  if (result.scalingFactor <= 2.0) throw new Error(`Expected extreme high factor, got ${result.scalingFactor}`);
  const finalTotal = result.finalPrices.reduce((s, v) => s + v, 0);
  assertEquals(finalTotal, target);
});

Deno.test("Stage 2: scaling factor 1.0 (target equals baseline)", () => {
  const baselines = [10000, 20000, 30000];
  const target = 60000;
  const result = stage2Scale(baselines, target, 'GBP');
  assertAlmostEquals(result.scalingFactor, 1.0, 0.001);
  const finalTotal = result.finalPrices.reduce((s, v) => s + v, 0);
  assertEquals(finalTotal, target);
});

Deno.test("Stage 2: single item — price equals target exactly", () => {
  const baselines = [25000];
  const target = 75000;
  const result = stage2Scale(baselines, target, 'GBP');
  assertEquals(result.finalPrices[0], target);
});
