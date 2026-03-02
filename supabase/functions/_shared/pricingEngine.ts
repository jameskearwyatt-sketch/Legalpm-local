// supabase/functions/_shared/pricingEngine.ts
// Version: v5.0.0 — Shared pricing intelligence engine
// Used by: suggest-pricing, allocate-target-pricing

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const INTERNAL_BASE_CCY = 'GBP';
export const MINIMUM_ITEM_FEE_GBP = 500;

/** Minimum category count before we trust percentiles; below this we widen band + reduce confidence */
export const SPARSE_CATEGORY_THRESHOLD = 10;

/** Outlier filtering: exclude fees below this percentile or above this percentile */
export const OUTLIER_LOWER_PCTL = 2;
export const OUTLIER_UPPER_PCTL = 98;

/** Similarity threshold for Tier 1 */
export const TIER1_SIMILARITY_THRESHOLD = 0.5;

// Fallback FX constants (used only when DB rates unavailable)
export const FALLBACK_FX_RATES: Record<string, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  CHF: 0.88,
  AUD: 1.53,
  CAD: 1.36,
  SGD: 1.34,
  MYR: 4.47,
  Ringgit: 4.47,
  SEK: 10.95,
  BRL: 5.0,
  MXN: 17.2,
  JPY: 149.0,
  CNY: 7.25,
  INR: 83.0,
  KRW: 1330.0,
  ZAR: 18.5,
  NZD: 1.63,
  HKD: 7.82,
  NOK: 10.8,
  DKK: 6.87,
  PLN: 4.05,
  CZK: 23.2,
  HUF: 360.0,
  TRY: 30.0,
  THB: 35.5,
  IDR: 15500.0,
  PHP: 56.0,
  VND: 24500.0,
  CLP: 900.0,
  COP: 4000.0,
  PEN: 3.75,
  ARS: 850.0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type Scope = 'narrow' | 'moderate' | 'broad';
export type Tier = 'TIER_1' | 'TIER_2' | 'TIER_3';

export interface FXInfo {
  rateUsed: number;        // pricingCurrency per 1 GBP
  source: 'proposal' | 'db_table' | 'fallback';
  timestamp: string | null;
}

export interface ComplexityResult {
  scope: Scope;
  complexityScore: number;
  signals: string[];
}

export interface PercentileStats {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  n: number;
  IQR: number;
}

export interface SimilarityMatch {
  workItem: string;
  category: string;
  provider: string;
  feeGBP: number;
  feePricingCcy: number;
  similarityScore: number;
  matchSignals: string[];
  source: string;
}

export interface PricingDiagnostics {
  fxRateUsed: number;
  fxSource: string;
  fxTimestamp: string | null;
  categoryCount: number;
  outlierMethod: string;
  sparseCategory: boolean;
}

export interface PricingResult {
  workItem: string;
  suggestedPrice: number;
  pricingCurrency: string;
  suggestedPriceBaseGBP: number;
  tierUsed: Tier;
  confidence: Confidence;
  scope: Scope;
  complexityScore: number;
  signals: string[];
  percentileStats: PercentileStats;
  targetPercentile: number;
  permittedBand: {
    lowPercentile: number;
    highPercentile: number;
    lowValuePricingCcy: number;
    highValuePricingCcy: number;
    lowValueGBP: number;
    highValueGBP: number;
  };
  similarityMatches: SimilarityMatch[];
  explanation: string;
  diagnostics: PricingDiagnostics;
}

export interface HistoricalItem {
  work_item: string;
  detail: string | null;
  category: string;
  provider: string;
  feeOriginal: number;
  feeOriginalCurrency: string;
  feeGBP: number;
  source: string;
  matterId?: string;
}

export interface NormalisedFeeSeries {
  valuesGBP: number[];
  count: number;
  diagnostics: {
    rawCount: number;
    outlierRemoved: number;
    deduplicatedCount: number;
    method: string;
  };
}

export interface CategoryPercentileData {
  stats: PercentileStats;
  feesGBP: number[];
  sparse: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEXT PROCESSING & SIMILARITY
// ═══════════════════════════════════════════════════════════════════════════════

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'in', 'to', 'for', 'with', 'on',
  'at', 'by', 'from', 'is', 'it', 'its', 'this', 'that', 'as', 'be',
  'are', 'was', 'were', 'has', 'have', 'had', 'not', 'but', 'if', 'all',
  'each', 'any', 'such', 'will', 'may', 'can', 'shall', 'should',
  'would', 'could', 're', 'etc', 'ie', 'eg', 'including', 'included',
]);

export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^\\w\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

export function significantWords(text: string): Set<string> {
  return new Set(tokenise(text));
}

/** Jaccard-style similarity with bonus weighting for jurisdiction/deliverable tokens */
export function textSimilarity(a: string, b: string): { score: number; matchSignals: string[] } {
  const tokensA = tokenise(a);
  const tokensB = tokenise(b);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (setA.size === 0 || setB.size === 0) return { score: 0, matchSignals: [] };

  let overlap = 0;
  const matchedTokens: string[] = [];
  for (const w of setA) {
    if (setB.has(w)) {
      overlap++;
      matchedTokens.push(w);
    }
  }

  const union = new Set([...setA, ...setB]).size;
  const jaccardScore = overlap / union;

  // Weighted boost: jurisdiction and deliverable type tokens count more
  const signals: string[] = [];
  const jurisdictionMatches = matchedTokens.filter(t => JURISDICTION_TOKENS.has(t));
  const deliverableMatches = matchedTokens.filter(t => DELIVERABLE_TOKENS.has(t));
  const docTypeMatches = matchedTokens.filter(t => DOCUMENT_TYPE_TOKENS.has(t));

  let bonus = 0;
  if (jurisdictionMatches.length > 0) {
    bonus += 0.1 * jurisdictionMatches.length;
    signals.push(`jurisdiction match: ${jurisdictionMatches.join(', ')}`);
  }
  if (deliverableMatches.length > 0) {
    bonus += 0.08 * deliverableMatches.length;
    signals.push(`deliverable match: ${deliverableMatches.join(', ')}`);
  }
  if (docTypeMatches.length > 0) {
    bonus += 0.05 * docTypeMatches.length;
    signals.push(`document type match: ${docTypeMatches.join(', ')}`);
  }

  return {
    score: Math.min(jaccardScore + bonus, 1.0),
    matchSignals: signals,
  };
}

const JURISDICTION_TOKENS = new Set([
  'colombian', 'brazilian', 'chilean', 'peruvian', 'mexican', 'argentine',
  'uruguayan', 'ecuadorian', 'bolivian', 'venezuelan', 'panamanian',
  'bvi', 'cayman', 'bermuda', 'bahamas', 'singapore', 'hong', 'kong',
  'thailand', 'vietnam', 'indonesia', 'malaysia', 'philippines', 'taiwan',
  'korean', 'japanese', 'indian', 'chinese', 'australian', 'zealand',
  'canadian', 'nigerian', 'kenyan', 'ghanaian', 'tanzanian', 'ugandan',
  'mozambican', 'zambian', 'zimbabwean', 'namibian', 'angolan',
  'english', 'scottish', 'irish', 'welsh', 'french', 'german', 'spanish',
  'italian', 'portuguese', 'dutch', 'belgian', 'swiss', 'austrian',
  'swedish', 'norwegian', 'danish', 'finnish', 'polish', 'czech',
  'hungarian', 'romanian', 'greek', 'turkish', 'russian', 'ukrainian',
  'usa', 'uk', 'eu', 'latam', 'apac', 'emea', 'mena',
]);

const DELIVERABLE_TOKENS = new Set([
  'report', 'opinion', 'advice', 'analysis', 'review', 'assessment',
  'certificate', 'memorandum', 'memo', 'letter', 'summary', 'overview',
]);

const DOCUMENT_TYPE_TOKENS = new Set([
  'agreement', 'contract', 'deed', 'lease', 'licence', 'license',
  'guarantee', 'mortgage', 'charge', 'pledge', 'security', 'undertaking',
  'certificate', 'consent', 'waiver', 'novation', 'assignment',
  'amendment', 'supplement', 'addendum',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLEXITY MODEL
// ═══════════════════════════════════════════════════════════════════════════════

const BROAD_INDICATORS = /\b(report|comprehensive|full|all project|covering|review of all|package|suite|multi|portfolio|across|various|range of|complete|extensive|wide|broad|overall|summary|overview|entire|whole|master|global|general)\b/i;

const PACKAGE_INDICATORS = /\b(security package|security suite|full dd|full due diligence|comprehensive dd|comprehensive due diligence|complete security|documentation package|full documentation|opinion covering|multi-jurisdiction|multi jurisdiction|multi-topic|cross-border)\b/i;

const NARROW_INDICATORS_REGEX = /\b(colombian|brazilian|chilean|peruvian|mexican|argentine|uruguayan|paraguayan|ecuadorian|bolivian|venezuelan|panamanian|costa rican|honduran|salvadoran|guatemalan|nicaraguan|dominican|cuban|jamaican|trinidadian|bvi|cayman|bermuda|bahamas|singapore|hong kong|thailand|vietnam|indonesia|malaysia|philippines|taiwan|korean|japanese|indian|chinese|australian|zealand|canadian|south african|nigerian|kenyan|ghanaian|tanzanian|ugandan|mozambican|zambian|zimbabwean|namibian|botswanan|angolan|congolese|senegalese|ivorian|cameroonian|ethiopian|egyptian|moroccan|tunisian|algerian|libyan|english|scottish|irish|welsh|french|german|spanish|italian|portuguese|dutch|belgian|swiss|austrian|swedish|norwegian|danish|finnish|polish|czech|hungarian|romanian|bulgarian|croatian|serbian|slovenian|slovak|greek|turkish|russian|ukrainian|estonian|latvian|lithuanian|cypriot|maltese|luxembourgish|icelandic)\b/i;

/** Count jurisdiction references in text (capped at 8 for scoring) */
function countJurisdictions(text: string): number {
  const matches = new Set<string>();
  const lower = text.toLowerCase();
  for (const j of JURISDICTION_TOKENS) {
    if (lower.includes(j)) matches.add(j);
  }
  return Math.min(matches.size, 8);
}

/** Estimate document/item count from text ("15 documents", "covering items 1-23", etc.) */
function estimateDocumentCount(text: string): number {
  const patterns = [
    /(\d+)\s*(?:documents?|items?|agreements?|contracts?|topics?|areas?|issues?|points?)/i,
    /items?\s*(?:\d+\s*[-–]\s*)?(\d+)/i,
    /covering\s+(\d+)/i,
  ];
  let maxCount = 0;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) maxCount = Math.max(maxCount, parseInt(m[1], 10));
  }
  return maxCount;
}

/** Detect if text is long but generic (boilerplate, not substantive complexity) */
function isLongButGeneric(text: string): boolean {
  if (text.length < 200) return false;
  const tokens = tokenise(text);
  const unique = new Set(tokens);
  // High repetition ratio = generic text
  if (unique.size < tokens.length * 0.4) return true;
  // Very few domain-specific tokens
  const domainTokens = tokens.filter(t =>
    JURISDICTION_TOKENS.has(t) || DELIVERABLE_TOKENS.has(t) || DOCUMENT_TYPE_TOKENS.has(t)
  );
  if (domainTokens.length < 2 && text.length > 400) return true;
  return false;
}

export function classifyComplexity(workItem: string, detail: string | null): ComplexityResult {
  const combined = `${workItem} ${detail || ''}`;
  const detailText = detail || '';
  const detailLen = detailText.length;

  let score = 0;
  const signals: string[] = [];

  // 1. Detail length (with generic-text guard)
  if (isLongButGeneric(detailText)) {
    signals.push('Long but generic detail text — not counted as complexity');
  } else {
    if (detailLen > 250) {
      score += 2;
      signals.push(`Detail length ${detailLen} chars (>250 → +2)`);
    } else if (detailLen > 150) {
      score += 1;
      signals.push(`Detail length ${detailLen} chars (>150 → +1)`);
    } else if (detailLen < 80) {
      score -= 1;
      signals.push(`Detail length ${detailLen} chars (<80 → -1)`);
    }
  }

  // 2. Broad keyword indicators
  if (BROAD_INDICATORS.test(combined)) {
    score += 2;
    const broadMatch = combined.match(BROAD_INDICATORS);
    signals.push(`Broad indicator: "${broadMatch?.[0]}"`);
  }

  // 3. Package indicators (strong broad signal)
  if (PACKAGE_INDICATORS.test(combined)) {
    score += 2;
    const pkgMatch = combined.match(PACKAGE_INDICATORS);
    signals.push(`Package indicator: "${pkgMatch?.[0]}"`);
  }

  // 4. Multi-jurisdiction detection
  const jurisdictionCount = countJurisdictions(combined);
  if (jurisdictionCount >= 3) {
    const increment = Math.min(jurisdictionCount - 2, 3);
    score += increment;
    signals.push(`Multi-jurisdiction: ${jurisdictionCount} detected (+${increment})`);
  } else if (jurisdictionCount === 1) {
    // Single jurisdiction = narrowing signal
    score -= 1;
    signals.push(`Single jurisdiction detected (-1)`);
  }

  // 5. Document/item count proxy
  const docCount = estimateDocumentCount(combined);
  if (docCount >= 10) {
    score += 3;
    signals.push(`High document count: ~${docCount} (+3)`);
  } else if (docCount >= 5) {
    score += 2;
    signals.push(`Moderate document count: ~${docCount} (+2)`);
  } else if (docCount >= 2) {
    score += 1;
    signals.push(`Some enumeration: ~${docCount} items (+1)`);
  }

  // 6. Narrow indicators (specific jurisdiction/entity in work_item)
  if (NARROW_INDICATORS_REGEX.test(workItem)) {
    score -= 2;
    const narrowMatch = workItem.match(NARROW_INDICATORS_REGEX);
    signals.push(`Narrow indicator in work item: "${narrowMatch?.[0]}" (-2)`);
  }

  // 7. Generic work item (short, no proper nouns)
  const words = significantWords(workItem);
  const hasProperNoun = /[A-Z][a-z]{2,}/.test(workItem.replace(/^[A-Z]/, 'x'));
  if (words.size <= 4 && !hasProperNoun) {
    score += 1;
    signals.push(`Generic work item (≤4 significant words, no proper nouns → +1)`);
  }

  // Determine scope
  let scope: Scope;
  if (score >= 3) scope = 'broad';
  else if (score <= -1) scope = 'narrow';
  else scope = 'moderate';

  return { scope, complexityScore: score, signals };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERCENTILE & STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const frac = index - lower;
  if (lower + 1 >= sorted.length) return sorted[lower];
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower]);
}

export function computePercentileStats(valuesGBP: number[]): PercentileStats {
  const p25 = computePercentile(valuesGBP, 25);
  const p50 = computeMedian(valuesGBP);
  const p75 = computePercentile(valuesGBP, 75);
  const p90 = computePercentile(valuesGBP, 90);
  return { p25, p50, p75, p90, n: valuesGBP.length, IQR: p75 - p25 };
}

/** Map complexityScore to a continuous percentile target */
export function targetPercentileFromComplexity(complexityScore: number): number {
  return Math.max(0.20, Math.min(0.90, 0.25 + complexityScore * 0.08));
}

/** Interpolate a value at a given percentile from sorted data */
export function interpolateAtPercentile(valuesGBP: number[], pctl: number): number {
  if (valuesGBP.length === 0) return 0;
  return computePercentile(valuesGBP, pctl * 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA HYGIENE & NORMALISATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Deduplicate historical items: per (matterId, work_item) keep the most recent.
 * Then remove outliers using winsorisation at configured percentiles.
 */
export function normalisedFeeSeries(
  items: HistoricalItem[],
  category: string
): NormalisedFeeSeries {
  const categoryItems = items.filter(h => h.category === category && h.feeGBP > 0);
  const rawCount = categoryItems.length;

  // Deduplicate: group by (matterId + work_item), keep first (most recent due to sort order)
  const seen = new Map<string, HistoricalItem>();
  for (const item of categoryItems) {
    const key = `${item.matterId || 'unknown'}::${item.work_item.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  const deduped = Array.from(seen.values());
  const deduplicatedCount = deduped.length;

  // Remove zero/negative (already filtered above)
  let fees = deduped.map(d => d.feeGBP);

  // Outlier filtering: exclude below 2nd percentile and above 98th percentile
  let outlierRemoved = 0;
  if (fees.length >= 5) {
    const lower = computePercentile(fees, OUTLIER_LOWER_PCTL);
    const upper = computePercentile(fees, OUTLIER_UPPER_PCTL);
    const before = fees.length;
    fees = fees.filter(f => f >= lower && f <= upper);
    outlierRemoved = before - fees.length;
  }

  return {
    valuesGBP: fees,
    count: fees.length,
    diagnostics: {
      rawCount,
      outlierRemoved,
      deduplicatedCount,
      method: fees.length < rawCount ? `winsorise_p${OUTLIER_LOWER_PCTL}_p${OUTLIER_UPPER_PCTL}` : 'none',
    },
  };
}

/**
 * Build category percentile data with sparse-category handling.
 * If category has fewer items than threshold, merge with all-categories data.
 */
export function buildCategoryPercentiles(
  allItems: HistoricalItem[],
  category: string
): CategoryPercentileData {
  const series = normalisedFeeSeries(allItems, category);

  if (series.count >= SPARSE_CATEGORY_THRESHOLD) {
    return {
      stats: computePercentileStats(series.valuesGBP),
      feesGBP: series.valuesGBP,
      sparse: false,
    };
  }

  // Sparse: also include all items as fallback context, but prefer category data
  const allFees = allItems.filter(h => h.feeGBP > 0).map(h => h.feeGBP);

  if (series.count >= 2) {
    // Some category data exists — use it but mark sparse
    return {
      stats: computePercentileStats(series.valuesGBP),
      feesGBP: series.valuesGBP,
      sparse: true,
    };
  }

  // Very sparse — fall back to all-items percentiles
  return {
    stats: computePercentileStats(allFees),
    feesGBP: allFees,
    sparse: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FX CONVERSION
// ═══════════════════════════════════════════════════════════════════════════════

export interface FXRateSet {
  rates: Record<string, number>; // currency → rate per 1 USD
  source: 'proposal' | 'db_table' | 'fallback';
  timestamp: string | null;
}

/**
 * Convert an amount from one currency to GBP using the FX rate set.
 * Returns { amountGBP, fxInfo }.
 */
export function convertToGBP(
  amount: number,
  sourceCurrency: string,
  fx: FXRateSet
): { amountGBP: number; fxInfo: FXInfo } {
  if (sourceCurrency === 'GBP') {
    return {
      amountGBP: amount,
      fxInfo: { rateUsed: 1, source: fx.source, timestamp: fx.timestamp },
    };
  }

  const srcRate = fx.rates[sourceCurrency] || FALLBACK_FX_RATES[sourceCurrency] || 1;
  const gbpRate = fx.rates['GBP'] || FALLBACK_FX_RATES['GBP'] || 0.79;
  const actualSource = fx.rates[sourceCurrency] ? fx.source : 'fallback';

  // amount in source → USD → GBP
  // If 1 USD = srcRate source, then amount source = amount/srcRate USD
  // If 1 USD = gbpRate GBP, then (amount/srcRate) * gbpRate = amount in GBP
  const amountGBP = amount * (gbpRate / srcRate);

  return {
    amountGBP,
    fxInfo: {
      rateUsed: gbpRate / srcRate,
      source: actualSource,
      timestamp: fx.timestamp,
    },
  };
}

/**
 * Convert an amount from GBP to the pricing currency.
 */
export function convertFromGBP(
  amountGBP: number,
  targetCurrency: string,
  fx: FXRateSet
): number {
  if (targetCurrency === 'GBP') return amountGBP;

  const gbpRate = fx.rates['GBP'] || FALLBACK_FX_RATES['GBP'] || 0.79;
  const tgtRate = fx.rates[targetCurrency] || FALLBACK_FX_RATES[targetCurrency] || 1;

  // GBP → USD → target
  // amountGBP / gbpRate = USD; USD * tgtRate = target
  return amountGBP * (tgtRate / gbpRate);
}

export function isFallbackFX(fx: FXRateSet, currency: string): boolean {
  if (currency === 'GBP') return false;
  return !fx.rates[currency] || fx.source === 'fallback';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CURRENCY-SPECIFIC ROUNDING
// ═══════════════════════════════════════════════════════════════════════════════

export function smartRound(amount: number, currency: string): number {
  if (amount <= 0) return 0;

  switch (currency) {
    case 'GBP':
      if (amount < 25000) return Math.round(amount / 500) * 500;
      if (amount <= 100000) return Math.round(amount / 1000) * 1000;
      return Math.round(amount / 5000) * 5000;

    case 'USD':
      if (amount < 50000) return Math.round(amount / 1000) * 1000;
      if (amount <= 250000) return Math.round(amount / 2500) * 2500;
      return Math.round(amount / 5000) * 5000;

    case 'EUR':
      return Math.round(amount / 1000) * 1000;

    default:
      // Generic: nearest 1000
      return Math.round(amount / 1000) * 1000;
  }
}

/** Minimum fee in pricing currency */
export function minimumFee(currency: string, fx: FXRateSet): number {
  return Math.max(smartRound(convertFromGBP(MINIMUM_ITEM_FEE_GBP, currency, fx), currency), 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMILARITY MATCHING
// ═══════════════════════════════════════════════════════════════════════════════

export interface ItemToPrice {
  work_item: string;
  detail: string | null;
  category: string;
  provider: string;
}

/**
 * Find top N similarity matches for an item, with category filter first.
 */
export function findSimilarityMatches(
  item: ItemToPrice,
  allHistorical: HistoricalItem[],
  pricingCurrency: string,
  fx: FXRateSet,
  topN = 3
): SimilarityMatch[] {
  const candidates: { hist: HistoricalItem; score: number; signals: string[] }[] = [];

  for (const hist of allHistorical) {
    // Category filter: must match or be uncategorised
    const catMatch = !item.category || !hist.category ||
      hist.category === 'Uncategorized' ||
      hist.category === item.category;
    if (!catMatch) continue;

    // Work item similarity
    const sim = textSimilarity(item.work_item, hist.work_item);
    let totalScore = sim.score;
    const matchSignals = [...sim.matchSignals];

    // Detail similarity boost
    if (item.detail && hist.detail) {
      const detailSim = textSimilarity(item.detail, hist.detail);
      totalScore = totalScore * 0.6 + detailSim.score * 0.4;
      if (detailSim.matchSignals.length > 0) {
        matchSignals.push(`detail: ${detailSim.matchSignals.join(', ')}`);
      }
    }

    // Provider bonus
    if (item.provider === hist.provider) {
      totalScore += 0.1;
      matchSignals.push('same provider');
    }

    // Category bonus
    if (item.category && hist.category === item.category) {
      totalScore += 0.15;
      matchSignals.push('same category');
    }

    if (totalScore > 0.1) {
      candidates.push({ hist, score: totalScore, signals: matchSignals });
    }
  }

  // Sort by score descending, take top N
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, topN).map(c => ({
    workItem: c.hist.work_item,
    category: c.hist.category,
    provider: c.hist.provider,
    feeGBP: c.hist.feeGBP,
    feePricingCcy: smartRound(convertFromGBP(c.hist.feeGBP, pricingCurrency, fx), pricingCurrency),
    similarityScore: c.score,
    matchSignals: c.signals,
    source: c.hist.source,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

export function computeConfidence(
  tier: Tier,
  similarityScore: number,
  categoryData: CategoryPercentileData,
  fx: FXRateSet,
  pricingCurrency: string
): Confidence {
  let level: number; // 3=HIGH, 2=MEDIUM, 1=LOW

  if (tier === 'TIER_1') level = 3;
  else if (tier === 'TIER_2') level = 2;
  else level = 1; // TIER_3

  // Modifiers
  if (categoryData.sparse) level--;
  if (isFallbackFX(fx, pricingCurrency)) level--;
  if (categoryData.stats.IQR > categoryData.stats.p50 * 2) level--; // wide IQR
  if (tier === 'TIER_1' && similarityScore >= 0.7) level++; // strong match upgrade

  if (level >= 3) return 'HIGH';
  if (level >= 2) return 'MEDIUM';
  return 'LOW';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE PRICING FUNCTION (SINGLE ITEM)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Price a single item using the tiered approach.
 * Returns a PricingResult or null (for Tier 3 items that need AI).
 */
export function priceItem(
  item: ItemToPrice,
  allHistorical: HistoricalItem[],
  pricingCurrency: string,
  fx: FXRateSet
): PricingResult | null {
  // Step 1: Complexity classification
  const complexity = classifyComplexity(item.work_item, item.detail);
  const tgtPctl = targetPercentileFromComplexity(complexity.complexityScore);
  const bandLow = Math.max(0.05, tgtPctl - 0.10);
  const bandHigh = Math.min(0.95, tgtPctl + 0.10);

  // Step 2: Category percentile data
  const catData = buildCategoryPercentiles(allHistorical, item.category);
  const statsGBP = catData.stats;

  // Step 3: Similarity matching
  const matches = findSimilarityMatches(item, allHistorical, pricingCurrency, fx, 3);
  const bestMatch = matches.length > 0 ? matches[0] : null;

  // Step 4: Permitted band values
  const bandLowGBP = interpolateAtPercentile(catData.feesGBP, bandLow);
  const bandHighGBP = interpolateAtPercentile(catData.feesGBP, bandHigh);
  const bandLowPricingCcy = smartRound(convertFromGBP(bandLowGBP, pricingCurrency, fx), pricingCurrency);
  const bandHighPricingCcy = smartRound(convertFromGBP(bandHighGBP, pricingCurrency, fx), pricingCurrency);

  const minFee = minimumFee(pricingCurrency, fx);

  // Percentile stats in pricing currency
  const pctlStatsPricingCcy: PercentileStats = {
    p25: smartRound(convertFromGBP(statsGBP.p25, pricingCurrency, fx), pricingCurrency),
    p50: smartRound(convertFromGBP(statsGBP.p50, pricingCurrency, fx), pricingCurrency),
    p75: smartRound(convertFromGBP(statsGBP.p75, pricingCurrency, fx), pricingCurrency),
    p90: smartRound(convertFromGBP(statsGBP.p90, pricingCurrency, fx), pricingCurrency),
    n: statsGBP.n,
    IQR: smartRound(convertFromGBP(statsGBP.IQR, pricingCurrency, fx), pricingCurrency),
  };

  const baseDiagnostics: PricingDiagnostics = {
    fxRateUsed: convertToGBP(1, pricingCurrency, fx).fxInfo.rateUsed,
    fxSource: isFallbackFX(fx, pricingCurrency) ? 'fallback' : fx.source,
    fxTimestamp: fx.timestamp,
    categoryCount: statsGBP.n,
    outlierMethod: catData.feesGBP.length < statsGBP.n ? `winsorise_p${OUTLIER_LOWER_PCTL}_p${OUTLIER_UPPER_PCTL}` : 'none',
    sparseCategory: catData.sparse,
  };

  const baseResult = {
    workItem: item.work_item,
    pricingCurrency,
    scope: complexity.scope,
    complexityScore: complexity.complexityScore,
    signals: complexity.signals,
    percentileStats: pctlStatsPricingCcy,
    targetPercentile: tgtPctl,
    permittedBand: {
      lowPercentile: bandLow,
      highPercentile: bandHigh,
      lowValuePricingCcy: Math.max(bandLowPricingCcy, minFee),
      highValuePricingCcy: Math.max(bandHighPricingCcy, minFee),
      lowValueGBP: bandLowGBP,
      highValueGBP: bandHighGBP,
    },
    similarityMatches: matches,
    diagnostics: baseDiagnostics,
  };

  // ── Tier 1: Strong similarity match ──
  if (bestMatch && bestMatch.similarityScore >= TIER1_SIMILARITY_THRESHOLD) {
    const feeGBP = bestMatch.feeGBP;
    const feePricingCcy = smartRound(convertFromGBP(feeGBP, pricingCurrency, fx), pricingCurrency);
    const confidence = computeConfidence('TIER_1', bestMatch.similarityScore, catData, fx, pricingCurrency);

    return {
      ...baseResult,
      suggestedPrice: Math.max(feePricingCcy, minFee),
      suggestedPriceBaseGBP: smartRound(feeGBP, 'GBP'),
      tierUsed: 'TIER_1',
      confidence,
      explanation: `Based on precedent "${bestMatch.workItem}" (similarity ${(bestMatch.similarityScore * 100).toFixed(0)}%, ${bestMatch.source})`,
    };
  }

  // ── Tier 2: Category + complexity percentile anchor ──
  if (catData.feesGBP.length >= 2) {
    const anchorGBP = interpolateAtPercentile(catData.feesGBP, tgtPctl);
    const anchorPricingCcy = smartRound(convertFromGBP(anchorGBP, pricingCurrency, fx), pricingCurrency);
    const confidence = computeConfidence('TIER_2', bestMatch?.similarityScore || 0, catData, fx, pricingCurrency);

    const scopeLabel = complexity.scope === 'broad'
      ? `broad scope → ${(tgtPctl * 100).toFixed(0)}th percentile`
      : complexity.scope === 'narrow'
        ? `narrow scope → ${(tgtPctl * 100).toFixed(0)}th percentile`
        : `moderate scope → ${(tgtPctl * 100).toFixed(0)}th percentile`;

    return {
      ...baseResult,
      suggestedPrice: Math.max(anchorPricingCcy, minFee),
      suggestedPriceBaseGBP: smartRound(anchorGBP, 'GBP'),
      tierUsed: 'TIER_2',
      confidence,
      explanation: `${item.category} ${scopeLabel} (${statsGBP.n} precedents${catData.sparse ? ', sparse data' : ''})`,
    };
  }

  // ── Tier 3: Needs AI ──
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

export function buildAIContextForItem(
  item: ItemToPrice,
  allHistorical: HistoricalItem[],
  pricingCurrency: string,
  fx: FXRateSet
): string {
  const complexity = classifyComplexity(item.work_item, item.detail);
  const tgtPctl = targetPercentileFromComplexity(complexity.complexityScore);
  const catData = buildCategoryPercentiles(allHistorical, item.category);
  const matches = findSimilarityMatches(item, allHistorical, pricingCurrency, fx, 5);

  const sym = currencySymbol(pricingCurrency);

  // Top 5 highest + bottom 5 lowest from category
  const catItems = allHistorical.filter(h => h.category === item.category && h.feeGBP > 0);
  const sortedCat = [...catItems].sort((a, b) => b.feeGBP - a.feeGBP);
  const top5 = sortedCat.slice(0, 5);
  const bottom5 = sortedCat.slice(-5);

  const statsGBP = catData.stats;
  const bandLow = Math.max(0.05, tgtPctl - 0.10);
  const bandHigh = Math.min(0.95, tgtPctl + 0.10);
  const bandLowVal = smartRound(convertFromGBP(interpolateAtPercentile(catData.feesGBP, bandLow), pricingCurrency, fx), pricingCurrency);
  const bandHighVal = smartRound(convertFromGBP(interpolateAtPercentile(catData.feesGBP, bandHigh), pricingCurrency, fx), pricingCurrency);

  let ctx = `
Item: "${item.work_item}"${item.detail ? `\nDetail: ${item.detail.substring(0, 500)}` : ''}
Provider: ${item.provider}, Category: ${item.category || 'Uncategorized'}
Scope: ${complexity.scope.toUpperCase()}, Complexity score: ${complexity.complexityScore}
Signals: ${complexity.signals.join('; ')}
Target percentile: ${(tgtPctl * 100).toFixed(0)}th
Permitted band: ${sym}${bandLowVal.toLocaleString()} – ${sym}${bandHighVal.toLocaleString()}`;

  if (catItems.length > 0) {
    ctx += `\n${item.category} stats (n=${statsGBP.n}): p25=${sym}${smartRound(convertFromGBP(statsGBP.p25, pricingCurrency, fx), pricingCurrency).toLocaleString()}, median=${sym}${smartRound(convertFromGBP(statsGBP.p50, pricingCurrency, fx), pricingCurrency).toLocaleString()}, p75=${sym}${smartRound(convertFromGBP(statsGBP.p75, pricingCurrency, fx), pricingCurrency).toLocaleString()}, p90=${sym}${smartRound(convertFromGBP(statsGBP.p90, pricingCurrency, fx), pricingCurrency).toLocaleString()}`;
    ctx += `\nHighest: ${top5.map(h => `"${h.work_item}" ${sym}${smartRound(convertFromGBP(h.feeGBP, pricingCurrency, fx), pricingCurrency).toLocaleString()}`).join('; ')}`;
    ctx += `\nLowest: ${bottom5.map(h => `"${h.work_item}" ${sym}${smartRound(convertFromGBP(h.feeGBP, pricingCurrency, fx), pricingCurrency).toLocaleString()}`).join('; ')}`;
  }

  if (matches.length > 0) {
    ctx += `\nTop similarity matches: ${matches.map(m => `"${m.workItem}" ${sym}${m.feePricingCcy.toLocaleString()} (${(m.similarityScore * 100).toFixed(0)}%)`).join('; ')}`;
  }

  return ctx;
}

export function currencySymbol(ccy: string): string {
  switch (ccy) {
    case 'GBP': return '£';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'CHF': return 'CHF ';
    case 'AUD': return 'A$';
    case 'CAD': return 'C$';
    case 'SGD': return 'S$';
    case 'JPY': return '¥';
    default: return `${ccy} `;
  }
}

export function buildAISystemPrompt(
  pricingCurrency: string,
  allHistorical: HistoricalItem[],
  fx: FXRateSet,
  isTargetMode = false
): string {
  const sym = currencySymbol(pricingCurrency);
  const minFee = minimumFee(pricingCurrency, fx);

  // Build overall category stats
  const categories = new Set(allHistorical.map(h => h.category));
  const catStatsLines: string[] = [];
  for (const cat of categories) {
    const catData = buildCategoryPercentiles(allHistorical, cat);
    const s = catData.stats;
    catStatsLines.push(`- ${cat}: n=${s.n}, p25=${sym}${smartRound(convertFromGBP(s.p25, pricingCurrency, fx), pricingCurrency).toLocaleString()}, median=${sym}${smartRound(convertFromGBP(s.p50, pricingCurrency, fx), pricingCurrency).toLocaleString()}, p75=${sym}${smartRound(convertFromGBP(s.p75, pricingCurrency, fx), pricingCurrency).toLocaleString()}, p90=${sym}${smartRound(convertFromGBP(s.p90, pricingCurrency, fx), pricingCurrency).toLocaleString()}${catData.sparse ? ' (sparse)' : ''}`);
  }

  return `You are a legal fee proposal expert for Baker McKenzie.${isTargetMode ? ' Suggest UNCONSTRAINED base prices — do NOT try to hit any target total.' : ' Suggest fee amounts based on complexity and category.'}

All amounts in ${pricingCurrency} (${sym}). Minimum ${sym}${minFee} per item. All fees MUST be positive.

CRITICAL RULES:
1. Pay close attention to each item's SCOPE and COMPLEXITY SCORE.
2. Price within the PERMITTED BAND unless you have strong reason not to (explain if outside band).
3. BROAD scope items (comprehensive reports, full packages) → HIGH END of range.
4. NARROW scope items (single entity, single jurisdiction) → LOW END of range.
5. Provide 2–4 bullet reasons referencing the provided statistics.
6. Return one numeric price per item, rounded per currency conventions.

CATEGORY STATISTICS (${pricingCurrency}):
${catStatsLines.join('\n')}`;
}
