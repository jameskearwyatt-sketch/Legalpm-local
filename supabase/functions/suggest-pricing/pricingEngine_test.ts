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
  // Create a realistic spread of DD items
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

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Security package vs single agreement
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Multi-jurisdiction opinion
// ═══════════════════════════════════════════════════════════════════════════════

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
  // Should be narrow or moderate (single jurisdiction)
  if (result.scope === 'broad') throw new Error("Single jurisdiction opinion should not be broad");
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test: FX conversion
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("convertToGBP: identity for GBP", () => {
  const { amountGBP } = convertToGBP(10000, 'GBP', defaultFX);
  assertEquals(amountGBP, 10000);
});

Deno.test("convertToGBP: USD to GBP", () => {
  const { amountGBP, fxInfo } = convertToGBP(10000, 'USD', defaultFX);
  // 10000 USD * (0.79 GBP/USD) = 7900 GBP
  assertAlmostEquals(amountGBP, 7900, 100);
  assertEquals(fxInfo.source, 'db_table');
});

Deno.test("convertFromGBP: GBP to USD", () => {
  const amountUSD = convertFromGBP(10000, 'USD', defaultFX);
  // 10000 GBP / 0.79 * 1 ≈ 12658 USD
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

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Sparse category fallback
// ═══════════════════════════════════════════════════════════════════════════════

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
  // Should fall back to all items
  if (result.stats.n === 0) throw new Error("Should fall back to all-items percentiles");
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Currency-specific rounding
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Percentile computation
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("computePercentileStats: basic", () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const stats = computePercentileStats(values);
  assertEquals(stats.n, 10);
  assertAlmostEquals(stats.p50, 55, 1);
  if (stats.IQR <= 0) throw new Error("IQR should be positive");
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Continuous percentile targeting
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("targetPercentileFromComplexity: broad", () => {
  const pctl = targetPercentileFromComplexity(5);
  // 0.25 + 5*0.08 = 0.65
  assertAlmostEquals(pctl, 0.65, 0.01);
});

Deno.test("targetPercentileFromComplexity: narrow", () => {
  const pctl = targetPercentileFromComplexity(-2);
  // clamp(0.25 + (-2)*0.08, 0.20, 0.90) = clamp(0.09, 0.20, 0.90) = 0.20
  assertEquals(pctl, 0.20);
});

Deno.test("targetPercentileFromComplexity: very broad capped at 0.90", () => {
  const pctl = targetPercentileFromComplexity(10);
  // 0.25 + 10*0.08 = 1.05 → capped at 0.90
  assertEquals(pctl, 0.90);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Similarity matching
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("textSimilarity: identical strings return object with score", () => {
  const result = textSimilarity("corporate diligence review land title", "corporate diligence review land title");
  // Verify it returns the expected shape
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

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Deduplication
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("normalisedFeeSeries: deduplicates same matter+work_item", () => {
  const items = [
    makeHistoricalItem({ matterId: 'm1', work_item: 'Colombian DD', feeGBP: 15000 }),
    makeHistoricalItem({ matterId: 'm1', work_item: 'Colombian DD', feeGBP: 16000 }),
    makeHistoricalItem({ matterId: 'm2', work_item: 'Colombian DD', feeGBP: 14000 }),
  ];
  const series = normalisedFeeSeries(items, 'Due Diligence');
  // Should deduplicate m1 entries, keeping first (most recent)
  assertEquals(series.count, 2);
  assertEquals(series.diagnostics.deduplicatedCount, 2);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test: priceItem — Tier 2 broad DD gets high percentile
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("priceItem: broad DD report priced at high percentile (Tier 2)", () => {
  const historical = makeDDHistorical();
  const result = priceItem(
    {
      work_item: "Due diligence report",
      detail: "Comprehensive review of all project documents including PPAs, land leases, EPC contracts, O&M agreements, grid connection agreements, and financing documents",
      category: "Due Diligence",
      provider: "Baker McKenzie",
    },
    historical,
    'GBP',
    defaultFX
  );

  if (!result) throw new Error("Expected Tier 2 result, got null (Tier 3)");
  assertEquals(result.tierUsed, 'TIER_2');
  assertEquals(result.scope, 'broad');
  // Should be at high percentile — well above median of ~18500
  // Should be above median (~18500) — broad scope pushes to higher percentile
  if (result.suggestedPrice < 20000) {
    throw new Error(`Broad DD should be priced above median. Got £${result.suggestedPrice}`);
  }
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
    historical,
    'GBP',
    defaultFX
  );

  // Could be Tier 1 (exact match) or Tier 2
  if (!result) throw new Error("Expected priced result");
  // Should be at low end — below median
  if (result.suggestedPrice > 25000) {
    throw new Error(`Narrow DD should be priced below median. Got £${result.suggestedPrice}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test: priceItem — USD deal with FX conversion
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("priceItem: USD deal returns price in USD", () => {
  const historical = makeDDHistorical();
  const result = priceItem(
    {
      work_item: "Due diligence report",
      detail: "Comprehensive review covering 15 document categories",
      category: "Due Diligence",
      provider: "Baker McKenzie",
    },
    historical,
    'USD',
    defaultFX
  );

  if (!result) throw new Error("Expected result");
  assertEquals(result.pricingCurrency, 'USD');
  // USD price should be higher than GBP price (1 GBP ≈ 1.27 USD)
  if (result.suggestedPrice <= result.suggestedPriceBaseGBP) {
    throw new Error(`USD price ($${result.suggestedPrice}) should be higher than GBP base (£${result.suggestedPriceBaseGBP})`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test: Output structure completeness
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("priceItem: returns complete output structure", () => {
  const historical = makeDDHistorical();
  const result = priceItem(
    {
      work_item: "Tax DD review",
      detail: "Review of tax structure",
      category: "Due Diligence",
      provider: "Baker McKenzie",
    },
    historical,
    'GBP',
    defaultFX
  );

  if (!result) throw new Error("Expected result");

  // Check all required fields exist
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

  // Check percentileStats fields
  const ps = result.percentileStats;
  if (ps.p25 === undefined || ps.p50 === undefined || ps.p75 === undefined || ps.p90 === undefined) {
    throw new Error("Missing percentile stat field");
  }
  if (ps.n === undefined || ps.IQR === undefined) throw new Error("Missing n or IQR");

  // Check diagnostics
  const d = result.diagnostics;
  if (d.fxRateUsed === undefined) throw new Error("Missing fxRateUsed");
  if (d.fxSource === undefined) throw new Error("Missing fxSource");
  if (d.categoryCount === undefined) throw new Error("Missing categoryCount");
});
