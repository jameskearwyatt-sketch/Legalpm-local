/**
 * PPA Precedent Intelligence Engine
 * 
 * Aggregates, analyzes, and synthesizes patterns from the precedent bank
 * to provide ultra-intelligent market context for PPA analysis.
 */

import { PPAPrecedent, PPAPerspective } from '@/lib/hooks/usePPAAnalyses';

export interface CategoryPattern {
  category: string;
  positionCount: number;
  uniqueDeals: number;
  
  // Key terms and their frequency
  commonTerms: Array<{
    term: string;
    frequency: number;
    examples: string[];
  }>;
  
  // Numeric patterns (where detectable)
  numericPatterns: Array<{
    metric: string;
    min: number;
    max: number;
    median: number;
    unit: string;
    examples: string[];
  }>;
  
  // Position clusters (similar positions grouped)
  positionClusters: Array<{
    theme: string;
    positions: string[];
    dealCount: number;
  }>;
  
  // Jurisdiction breakdown
  jurisdictionBreakdown: Array<{
    jurisdiction: string;
    count: number;
    distinctPatterns: string[];
  }>;
  
  // Perspective analysis
  perspectiveAnalysis: {
    buyerPositions: number;
    sellerPositions: number;
    buyerTendencies: string[];
    sellerTendencies: string[];
  };
  
  // Temporal trends (if timestamps available)
  recentTrend: string | null;
}

export interface MarketIntelligence {
  totalDeals: number;
  totalPositions: number;
  jurisdictionCoverage: string[];
  perspectiveBalance: { buyer: number; seller: number };
  categoryPatterns: CategoryPattern[];
  
  // Cross-category insights
  crossCategoryInsights: string[];
  
  // Market norms summary
  marketNormsSummary: string;
  
  // Confidence level based on data volume
  intelligenceConfidence: 'low' | 'medium' | 'high' | 'very_high';
  
  // NEW: Advanced intelligence features
  temporalAnalysis: {
    oldestPrecedent: string | null;
    newestPrecedent: string | null;
    recentTrends: string[];
    marketMovement: 'stable' | 'shifting_buyer' | 'shifting_seller' | 'volatile' | 'insufficient_data';
  };
  
  // Similarity scoring for current context
  contextRelevance: {
    jurisdictionMatchCount: number;
    perspectiveMatchCount: number;
    relevanceScore: number; // 0-100
  };
  
  // Negotiation intelligence
  negotiationInsights: {
    highRiskCategories: string[];
    commonPushbackAreas: string[];
    suggestedPriorities: Array<{
      category: string;
      reason: string;
      leverage: 'high' | 'medium' | 'low';
    }>;
  };
  
  // Statistical depth
  statisticalDepth: {
    categoriesWithNumericData: number;
    categoriesWithTrends: number;
    averagePositionsPerCategory: number;
    dataQualityScore: number; // 0-100
  };
}

// Numeric extraction patterns for common PPA terms
const NUMERIC_PATTERNS = [
  { regex: /(\d+(?:\.\d+)?)\s*%\s*(?:availability|guaranteed)/i, metric: 'Availability Guarantee', unit: '%' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*(?:capacity|minimum)/i, metric: 'Minimum Capacity', unit: '%' },
  { regex: /£?€?\$?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:k|m|million|thousand)?\s*(?:LC|letter of credit|security|guarantee)/i, metric: 'Credit Support Amount', unit: '£' },
  { regex: /(\d+)\s*(?:days?|business days?)\s*(?:cure|notice|payment)/i, metric: 'Cure/Notice Period', unit: 'days' },
  { regex: /(\d+)\s*(?:months?|years?)\s*(?:term|duration|period)/i, metric: 'Term Length', unit: 'months' },
  { regex: /(\d+)\s*(?:days?)\s*(?:delay|LD|liquidated damages)/i, metric: 'Delay LD Period', unit: 'days' },
  { regex: /(\d+(?:\.\d+)?)\s*%\s*(?:cap|maximum|floor)/i, metric: 'Cap/Floor Percentage', unit: '%' },
];

// Key term extraction patterns
const KEY_TERMS = [
  // Credit support
  { pattern: /parent company guarantee|PCG/i, term: 'Parent Company Guarantee' },
  { pattern: /letter of credit|LC|L\/C/i, term: 'Letter of Credit' },
  { pattern: /performance bond/i, term: 'Performance Bond' },
  { pattern: /no security|no credit support/i, term: 'No Security Required' },
  
  // Pricing
  { pattern: /fixed price/i, term: 'Fixed Price' },
  { pattern: /floating|indexed|CPI|RPI/i, term: 'Indexed/Floating' },
  { pattern: /collar|floor|cap/i, term: 'Price Collar' },
  { pattern: /discount to/i, term: 'Discount to Reference' },
  
  // Volume
  { pattern: /pay.as.produced|PAYG/i, term: 'Pay-As-Produced' },
  { pattern: /baseload|shaped/i, term: 'Baseload/Shaped' },
  { pattern: /take.or.pay|minimum offtake/i, term: 'Take-or-Pay' },
  
  // Curtailment
  { pattern: /no compensation|at buyer.?s cost/i, term: 'No Curtailment Compensation' },
  { pattern: /full compensation|100%/i, term: 'Full Curtailment Compensation' },
  { pattern: /partial compensation/i, term: 'Partial Curtailment Compensation' },
  
  // Termination
  { pattern: /termination for convenience|TFC/i, term: 'Termination for Convenience' },
  { pattern: /material adverse change|MAC/i, term: 'MAC Clause' },
  { pattern: /cross.?default/i, term: 'Cross-Default' },
  
  // Force Majeure
  { pattern: /day.for.day extension/i, term: 'Day-for-Day FM Extension' },
  { pattern: /capped FM|FM cap/i, term: 'Capped FM Extension' },
  { pattern: /uncapped FM/i, term: 'Uncapped FM Extension' },
  
  // REGOs
  { pattern: /bundled|included in price/i, term: 'REGOs Bundled' },
  { pattern: /separate|additional/i, term: 'REGOs Separately Priced' },
  { pattern: /shortfall damages|REGO penalty/i, term: 'REGO Shortfall Damages' },
];

function extractNumericValues(text: string): Array<{ metric: string; value: number; unit: string }> {
  const results: Array<{ metric: string; value: number; unit: string }> = [];
  
  for (const pattern of NUMERIC_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      // Normalize to base units
      if (/million|m$/i.test(match[0])) value *= 1000000;
      if (/thousand|k$/i.test(match[0])) value *= 1000;
      if (/years?/i.test(match[0]) && pattern.unit === 'months') value *= 12;
      
      results.push({ metric: pattern.metric, value, unit: pattern.unit });
    }
  }
  
  return results;
}

function extractKeyTerms(text: string): string[] {
  const terms: string[] = [];
  
  for (const { pattern, term } of KEY_TERMS) {
    if (pattern.test(text)) {
      terms.push(term);
    }
  }
  
  return terms;
}

function clusterSimilarPositions(positions: string[]): Array<{ theme: string; positions: string[]; count: number }> {
  // Simple clustering based on shared key terms
  const clusters = new Map<string, string[]>();
  
  for (const position of positions) {
    const terms = extractKeyTerms(position);
    const clusterKey = terms.length > 0 ? terms.sort().join('|') : 'General';
    
    if (!clusters.has(clusterKey)) {
      clusters.set(clusterKey, []);
    }
    clusters.get(clusterKey)!.push(position);
  }
  
  return Array.from(clusters.entries())
    .map(([theme, positions]) => ({
      theme: theme === 'General' ? 'Other Positions' : theme.split('|').slice(0, 3).join(', '),
      positions,
      count: positions.length,
    }))
    .sort((a, b) => b.count - a.count);
}

function analyzeCategoryPattern(
  category: string,
  categoryPrecedents: PPAPrecedent[]
): CategoryPattern {
  const positions = categoryPrecedents.map(p => p.position_summary);
  const uniqueDeals = new Set(categoryPrecedents.map(p => p.project_name)).size;
  
  // Extract all numeric values
  const allNumericValues: Record<string, { values: number[]; unit: string; examples: string[] }> = {};
  for (const pos of positions) {
    const numerics = extractNumericValues(pos);
    for (const { metric, value, unit } of numerics) {
      if (!allNumericValues[metric]) {
        allNumericValues[metric] = { values: [], unit, examples: [] };
      }
      allNumericValues[metric].values.push(value);
      if (allNumericValues[metric].examples.length < 3) {
        allNumericValues[metric].examples.push(pos.substring(0, 150));
      }
    }
  }
  
  const numericPatterns = Object.entries(allNumericValues)
    .filter(([_, data]) => data.values.length >= 2)
    .map(([metric, data]) => {
      const sorted = data.values.sort((a, b) => a - b);
      return {
        metric,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: sorted[Math.floor(sorted.length / 2)],
        unit: data.unit,
        examples: data.examples,
      };
    });
  
  // Extract and count key terms
  const termCounts = new Map<string, { count: number; examples: string[] }>();
  for (const pos of positions) {
    const terms = extractKeyTerms(pos);
    for (const term of terms) {
      if (!termCounts.has(term)) {
        termCounts.set(term, { count: 0, examples: [] });
      }
      termCounts.get(term)!.count++;
      if (termCounts.get(term)!.examples.length < 2) {
        termCounts.get(term)!.examples.push(pos.substring(0, 100));
      }
    }
  }
  
  const commonTerms = Array.from(termCounts.entries())
    .map(([term, data]) => ({
      term,
      frequency: data.count / positions.length,
      examples: data.examples,
    }))
    .filter(t => t.frequency >= 0.1) // At least 10% occurrence
    .sort((a, b) => b.frequency - a.frequency);
  
  // Cluster positions
  const positionClusters = clusterSimilarPositions(positions).map(c => ({
    ...c,
    dealCount: c.count,
  }));
  
  // Jurisdiction breakdown
  const jurisdictionGroups = new Map<string, string[]>();
  for (const p of categoryPrecedents) {
    const jur = p.jurisdiction || 'Unknown';
    if (!jurisdictionGroups.has(jur)) {
      jurisdictionGroups.set(jur, []);
    }
    jurisdictionGroups.get(jur)!.push(p.position_summary);
  }
  
  const jurisdictionBreakdown = Array.from(jurisdictionGroups.entries())
    .map(([jurisdiction, positions]) => ({
      jurisdiction,
      count: positions.length,
      distinctPatterns: [...new Set(positions.flatMap(p => extractKeyTerms(p)))].slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count);
  
  // Perspective analysis
  const buyerPositions = categoryPrecedents.filter(p => p.perspective === 'buyer');
  const sellerPositions = categoryPrecedents.filter(p => p.perspective === 'seller');
  
  const buyerTerms = buyerPositions.flatMap(p => extractKeyTerms(p.position_summary));
  const sellerTerms = sellerPositions.flatMap(p => extractKeyTerms(p.position_summary));
  
  const buyerTermCounts = new Map<string, number>();
  const sellerTermCounts = new Map<string, number>();
  
  for (const t of buyerTerms) {
    buyerTermCounts.set(t, (buyerTermCounts.get(t) || 0) + 1);
  }
  for (const t of sellerTerms) {
    sellerTermCounts.set(t, (sellerTermCounts.get(t) || 0) + 1);
  }
  
  // Find terms that are more common in buyer vs seller deals
  const buyerTendencies: string[] = [];
  const sellerTendencies: string[] = [];
  
  for (const [term, count] of buyerTermCounts) {
    const sellerCount = sellerTermCounts.get(term) || 0;
    const buyerRate = count / Math.max(buyerPositions.length, 1);
    const sellerRate = sellerCount / Math.max(sellerPositions.length, 1);
    if (buyerRate > sellerRate * 1.5 && buyerRate >= 0.2) {
      buyerTendencies.push(term);
    }
  }
  
  for (const [term, count] of sellerTermCounts) {
    const buyerCount = buyerTermCounts.get(term) || 0;
    const sellerRate = count / Math.max(sellerPositions.length, 1);
    const buyerRate = buyerCount / Math.max(buyerPositions.length, 1);
    if (sellerRate > buyerRate * 1.5 && sellerRate >= 0.2) {
      sellerTendencies.push(term);
    }
  }
  
  return {
    category,
    positionCount: positions.length,
    uniqueDeals,
    commonTerms,
    numericPatterns,
    positionClusters,
    jurisdictionBreakdown,
    perspectiveAnalysis: {
      buyerPositions: buyerPositions.length,
      sellerPositions: sellerPositions.length,
      buyerTendencies,
      sellerTendencies,
    },
    recentTrend: null, // Could be enhanced with timestamp analysis
  };
}

function generateCrossCategoryInsights(patterns: CategoryPattern[]): string[] {
  const insights: string[] = [];
  
  // Find categories with strong patterns
  const strongPatterns = patterns.filter(p => p.positionCount >= 3 && p.commonTerms.length > 0);
  
  // Credit support correlation
  const creditPattern = patterns.find(p => p.category.toLowerCase().includes('credit'));
  const paymentPattern = patterns.find(p => p.category.toLowerCase().includes('payment'));
  
  if (creditPattern && paymentPattern) {
    const hasLC = creditPattern.commonTerms.some(t => t.term.includes('Letter of Credit'));
    const hasStrict = paymentPattern.commonTerms.some(t => t.term.includes('Strict'));
    if (hasLC && hasStrict) {
      insights.push('Deals with LC requirements tend to have stricter payment terms');
    }
  }
  
  // Delay LD correlation with COD terms
  const delayPattern = patterns.find(p => p.category.toLowerCase().includes('delay'));
  const codPattern = patterns.find(p => p.category.toLowerCase().includes('cod') || p.category.toLowerCase().includes('target'));
  
  if (delayPattern && codPattern) {
    insights.push('Delay LD provisions correlate with Target COD milestone structures');
  }
  
  // FM and curtailment correlation
  const fmPattern = patterns.find(p => p.category.toLowerCase().includes('force majeure'));
  const curtailPattern = patterns.find(p => p.category.toLowerCase().includes('curtail'));
  
  if (fmPattern && curtailPattern) {
    const fmTerms = fmPattern.commonTerms.map(t => t.term);
    const curtailTerms = curtailPattern.commonTerms.map(t => t.term);
    if (fmTerms.includes('Day-for-Day FM Extension') && curtailTerms.includes('No Curtailment Compensation')) {
      insights.push('Deals with generous FM extension often have limited curtailment compensation (risk balance)');
    }
  }
  
  // Jurisdiction-specific insights
  const jurisdictions = new Set<string>();
  for (const p of patterns) {
    for (const j of p.jurisdictionBreakdown) {
      if (j.count >= 2) jurisdictions.add(j.jurisdiction);
    }
  }
  
  if (jurisdictions.size >= 3) {
    insights.push(`Market intelligence spans ${jurisdictions.size} jurisdictions with sufficient depth for regional comparison`);
  }
  
  return insights;
}

function generateMarketNormsSummary(patterns: CategoryPattern[]): string {
  const summaryParts: string[] = [];
  
  // Find most consistent patterns (high frequency terms across multiple categories)
  const allTermFrequencies = new Map<string, number>();
  for (const pattern of patterns) {
    for (const term of pattern.commonTerms) {
      if (term.frequency >= 0.5) { // Very common
        allTermFrequencies.set(term.term, (allTermFrequencies.get(term.term) || 0) + 1);
      }
    }
  }
  
  const marketNorms = Array.from(allTermFrequencies.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term]) => term);
  
  if (marketNorms.length > 0) {
    summaryParts.push(`Common market structures: ${marketNorms.join(', ')}`);
  }
  
  // Summarize numeric ranges
  const allNumericRanges: string[] = [];
  for (const pattern of patterns) {
    for (const numeric of pattern.numericPatterns) {
      if (numeric.min !== numeric.max) {
        allNumericRanges.push(`${numeric.metric}: ${numeric.min}-${numeric.max}${numeric.unit}`);
      }
    }
  }
  
  if (allNumericRanges.length > 0) {
    summaryParts.push(`Key ranges: ${allNumericRanges.slice(0, 4).join('; ')}`);
  }
  
  return summaryParts.join('. ') || 'Insufficient data for market norms summary';
}

/**
 * Analyze temporal trends in precedent data
 */
function analyzeTemporalTrends(
  precedents: PPAPrecedent[],
  categoryPatterns: CategoryPattern[]
): MarketIntelligence['temporalAnalysis'] {
  if (precedents.length === 0) {
    return {
      oldestPrecedent: null,
      newestPrecedent: null,
      recentTrends: [],
      marketMovement: 'insufficient_data',
    };
  }
  
  // Sort by banked_at timestamp
  const sorted = [...precedents].sort((a, b) => 
    new Date(a.banked_at).getTime() - new Date(b.banked_at).getTime()
  );
  
  const oldestPrecedent = sorted[0]?.banked_at || null;
  const newestPrecedent = sorted[sorted.length - 1]?.banked_at || null;
  
  // Analyze trends by looking at term frequency in recent vs older precedents
  const midpoint = Math.floor(sorted.length / 2);
  const olderHalf = sorted.slice(0, midpoint);
  const newerHalf = sorted.slice(midpoint);
  
  const recentTrends: string[] = [];
  
  // Compare term frequencies between periods
  const olderTerms = new Map<string, number>();
  const newerTerms = new Map<string, number>();
  
  for (const p of olderHalf) {
    const terms = extractKeyTerms(p.position_summary);
    for (const t of terms) {
      olderTerms.set(t, (olderTerms.get(t) || 0) + 1);
    }
  }
  
  for (const p of newerHalf) {
    const terms = extractKeyTerms(p.position_summary);
    for (const t of terms) {
      newerTerms.set(t, (newerTerms.get(t) || 0) + 1);
    }
  }
  
  // Find emerging and declining terms
  const olderTotal = Math.max(olderHalf.length, 1);
  const newerTotal = Math.max(newerHalf.length, 1);
  
  for (const [term, newCount] of newerTerms) {
    const oldCount = olderTerms.get(term) || 0;
    const oldRate = oldCount / olderTotal;
    const newRate = newCount / newerTotal;
    
    if (newRate > oldRate * 2 && newRate >= 0.2) {
      recentTrends.push(`📈 "${term}" increasingly common (+${Math.round((newRate - oldRate) * 100)}%)`);
    }
  }
  
  for (const [term, oldCount] of olderTerms) {
    const newCount = newerTerms.get(term) || 0;
    const oldRate = oldCount / olderTotal;
    const newRate = newCount / newerTotal;
    
    if (oldRate > newRate * 2 && oldRate >= 0.2) {
      recentTrends.push(`📉 "${term}" declining (-${Math.round((oldRate - newRate) * 100)}%)`);
    }
  }
  
  // Determine market movement
  let marketMovement: MarketIntelligence['temporalAnalysis']['marketMovement'] = 'stable';
  
  const buyerTermsOld = ['Letter of Credit', 'Parent Company Guarantee', 'Full Curtailment Compensation'];
  const sellerTermsOld = ['No Security Required', 'No Curtailment Compensation', 'Uncapped FM Extension'];
  
  let buyerShift = 0;
  let sellerShift = 0;
  
  for (const term of buyerTermsOld) {
    const oldRate = (olderTerms.get(term) || 0) / olderTotal;
    const newRate = (newerTerms.get(term) || 0) / newerTotal;
    if (newRate > oldRate + 0.1) buyerShift++;
    if (newRate < oldRate - 0.1) sellerShift++;
  }
  
  for (const term of sellerTermsOld) {
    const oldRate = (olderTerms.get(term) || 0) / olderTotal;
    const newRate = (newerTerms.get(term) || 0) / newerTotal;
    if (newRate > oldRate + 0.1) sellerShift++;
    if (newRate < oldRate - 0.1) buyerShift++;
  }
  
  if (precedents.length < 6) {
    marketMovement = 'insufficient_data';
  } else if (buyerShift > sellerShift + 1) {
    marketMovement = 'shifting_buyer';
  } else if (sellerShift > buyerShift + 1) {
    marketMovement = 'shifting_seller';
  } else if (recentTrends.length > 3) {
    marketMovement = 'volatile';
  }
  
  return {
    oldestPrecedent,
    newestPrecedent,
    recentTrends: recentTrends.slice(0, 5),
    marketMovement,
  };
}

/**
 * Generate negotiation insights
 */
function generateNegotiationInsights(
  categoryPatterns: CategoryPattern[],
  perspective: 'buyer' | 'seller' = 'buyer'
): MarketIntelligence['negotiationInsights'] {
  const highRiskCategories: string[] = [];
  const commonPushbackAreas: string[] = [];
  const suggestedPriorities: MarketIntelligence['negotiationInsights']['suggestedPriorities'] = [];
  
  // Categories where positions vary most (high negotiation potential)
  const highVarianceCategories = categoryPatterns.filter(p => {
    const hasNumericVariance = p.numericPatterns.some(n => (n.max - n.min) / Math.max(n.median, 1) > 0.3);
    const hasMultipleClusters = p.positionClusters.length >= 3;
    return hasNumericVariance || hasMultipleClusters;
  });
  
  for (const cat of highVarianceCategories.slice(0, 5)) {
    highRiskCategories.push(cat.category);
  }
  
  // Categories where perspective tendencies differ most
  for (const cat of categoryPatterns) {
    if (cat.perspectiveAnalysis.buyerTendencies.length > 0 && cat.perspectiveAnalysis.sellerTendencies.length > 0) {
      commonPushbackAreas.push(cat.category);
    }
  }
  
  // Generate priority suggestions
  const criticalCategories = [
    'Credit Support (Seller)',
    'Credit Support (Buyer)',
    'Delay Liquidated Damages',
    'Curtailment',
    'Force Majeure',
    'Termination Rights',
    'Liability & Limitations',
  ];
  
  for (const cat of categoryPatterns) {
    if (criticalCategories.some(c => cat.category.includes(c.replace(' (Seller)', '').replace(' (Buyer)', '')))) {
      const tendencies = perspective === 'buyer' 
        ? cat.perspectiveAnalysis.buyerTendencies 
        : cat.perspectiveAnalysis.sellerTendencies;
      
      if (tendencies.length > 0) {
        suggestedPriorities.push({
          category: cat.category,
          reason: `${perspective === 'buyer' ? 'Buyer' : 'Seller'}-favorable precedents show: ${tendencies.slice(0, 2).join(', ')}`,
          leverage: cat.uniqueDeals >= 3 ? 'high' : cat.uniqueDeals >= 2 ? 'medium' : 'low',
        });
      }
    }
  }
  
  return {
    highRiskCategories,
    commonPushbackAreas: commonPushbackAreas.slice(0, 5),
    suggestedPriorities: suggestedPriorities.slice(0, 5),
  };
}

/**
 * Calculate statistical depth metrics
 */
function calculateStatisticalDepth(
  categoryPatterns: CategoryPattern[],
  totalPositions: number
): MarketIntelligence['statisticalDepth'] {
  const categoriesWithNumericData = categoryPatterns.filter(p => p.numericPatterns.length > 0).length;
  const categoriesWithTrends = categoryPatterns.filter(p => p.recentTrend !== null).length;
  const averagePositionsPerCategory = categoryPatterns.length > 0 
    ? totalPositions / categoryPatterns.length 
    : 0;
  
  // Calculate data quality score (0-100)
  let dataQualityScore = 0;
  
  // Volume component (max 40 points)
  dataQualityScore += Math.min(40, totalPositions * 2);
  
  // Category coverage component (max 30 points)
  const coverageRatio = categoryPatterns.length / 27; // 27 is our standard category count
  dataQualityScore += Math.min(30, coverageRatio * 30);
  
  // Numeric depth component (max 20 points)
  const numericRatio = categoriesWithNumericData / Math.max(categoryPatterns.length, 1);
  dataQualityScore += numericRatio * 20;
  
  // Consistency component (max 10 points)
  const avgPositions = averagePositionsPerCategory;
  if (avgPositions >= 2) dataQualityScore += 10;
  else if (avgPositions >= 1) dataQualityScore += 5;
  
  return {
    categoriesWithNumericData,
    categoriesWithTrends,
    averagePositionsPerCategory: Math.round(averagePositionsPerCategory * 10) / 10,
    dataQualityScore: Math.round(dataQualityScore),
  };
}

/**
 * Main function to generate comprehensive market intelligence from precedent bank
 */
export function generateMarketIntelligence(
  precedents: PPAPrecedent[],
  goldStandardPrecedents: PPAPrecedent[],
  currentJurisdiction?: string,
  currentPerspective?: 'buyer' | 'seller'
): MarketIntelligence {
  // Exclude gold standard from regular analysis (they're templates, not market data)
  const marketPrecedents = precedents.filter(p => !p.is_gold_standard);
  
  const totalDeals = new Set(marketPrecedents.map(p => p.project_name)).size;
  const totalPositions = marketPrecedents.length;
  const jurisdictionCoverage = [...new Set(marketPrecedents.map(p => p.jurisdiction).filter(Boolean))] as string[];
  
  const buyerCount = marketPrecedents.filter(p => p.perspective === 'buyer').length;
  const sellerCount = marketPrecedents.filter(p => p.perspective === 'seller').length;
  
  // Group by category and analyze each
  const categoryGroups = new Map<string, PPAPrecedent[]>();
  for (const p of marketPrecedents) {
    if (!categoryGroups.has(p.category)) {
      categoryGroups.set(p.category, []);
    }
    categoryGroups.get(p.category)!.push(p);
  }
  
  const categoryPatterns = Array.from(categoryGroups.entries())
    .map(([category, precedents]) => analyzeCategoryPattern(category, precedents))
    .sort((a, b) => b.positionCount - a.positionCount);
  
  const crossCategoryInsights = generateCrossCategoryInsights(categoryPatterns);
  const marketNormsSummary = generateMarketNormsSummary(categoryPatterns);
  
  // NEW: Temporal analysis
  const temporalAnalysis = analyzeTemporalTrends(marketPrecedents, categoryPatterns);
  
  // NEW: Context relevance scoring
  const jurisdictionMatchCount = currentJurisdiction 
    ? marketPrecedents.filter(p => p.jurisdiction === currentJurisdiction).length 
    : 0;
  const perspectiveMatchCount = currentPerspective 
    ? marketPrecedents.filter(p => p.perspective === currentPerspective).length 
    : 0;
  
  let relevanceScore = 50; // Base score
  if (currentJurisdiction && jurisdictionMatchCount > 0) {
    relevanceScore += Math.min(25, jurisdictionMatchCount * 5);
  }
  if (currentPerspective && perspectiveMatchCount > 0) {
    relevanceScore += Math.min(25, (perspectiveMatchCount / Math.max(totalPositions, 1)) * 50);
  }
  
  const contextRelevance = {
    jurisdictionMatchCount,
    perspectiveMatchCount,
    relevanceScore: Math.min(100, Math.round(relevanceScore)),
  };
  
  // NEW: Negotiation insights
  const negotiationInsights = generateNegotiationInsights(categoryPatterns, currentPerspective || 'buyer');
  
  // NEW: Statistical depth
  const statisticalDepth = calculateStatisticalDepth(categoryPatterns, totalPositions);
  
  // Determine confidence level
  let intelligenceConfidence: 'low' | 'medium' | 'high' | 'very_high';
  if (totalDeals >= 10 && jurisdictionCoverage.length >= 3) {
    intelligenceConfidence = 'very_high';
  } else if (totalDeals >= 5) {
    intelligenceConfidence = 'high';
  } else if (totalDeals >= 3) {
    intelligenceConfidence = 'medium';
  } else {
    intelligenceConfidence = 'low';
  }
  
  return {
    totalDeals,
    totalPositions,
    jurisdictionCoverage,
    perspectiveBalance: { buyer: buyerCount, seller: sellerCount },
    categoryPatterns,
    crossCategoryInsights,
    marketNormsSummary,
    intelligenceConfidence,
    temporalAnalysis,
    contextRelevance,
    negotiationInsights,
    statisticalDepth,
  };
}

/**
 * Format market intelligence for AI prompt consumption
 */
export function formatIntelligenceForPrompt(intelligence: MarketIntelligence): string {
  if (intelligence.totalDeals === 0) {
    return 'NO PRECEDENT DATA AVAILABLE - This is the first analysis. Rely on the How-To Bible framework and Gold Standard templates only.';
  }
  
  const sections: string[] = [];
  
  // Overview with enhanced metrics
  sections.push(`## 📊 MARKET INTELLIGENCE OVERVIEW
- **Total Precedent Deals**: ${intelligence.totalDeals}
- **Total Analyzed Positions**: ${intelligence.totalPositions}
- **Jurisdiction Coverage**: ${intelligence.jurisdictionCoverage.join(', ') || 'Various'}
- **Perspective Balance**: ${intelligence.perspectiveBalance.buyer} buyer / ${intelligence.perspectiveBalance.seller} seller positions
- **Intelligence Confidence**: ${intelligence.intelligenceConfidence.toUpperCase()}
- **Data Quality Score**: ${intelligence.statisticalDepth.dataQualityScore}/100
- **Context Relevance Score**: ${intelligence.contextRelevance.relevanceScore}/100
- **Market Norms**: ${intelligence.marketNormsSummary}`);

  // NEW: Temporal trends section
  if (intelligence.temporalAnalysis.marketMovement !== 'insufficient_data') {
    const movementLabel = {
      stable: '📈 STABLE - Market positions are consistent over time',
      shifting_buyer: '⬆️ SHIFTING BUYER-FAVORABLE - Recent deals show stronger buyer protections',
      shifting_seller: '⬇️ SHIFTING SELLER-FAVORABLE - Recent deals show more seller-friendly terms',
      volatile: '🔄 VOLATILE - Significant variation in recent positions',
    };
    
    sections.push(`## 🕐 TEMPORAL ANALYSIS (Market Movement)
**Market Direction**: ${movementLabel[intelligence.temporalAnalysis.marketMovement]}
${intelligence.temporalAnalysis.recentTrends.length > 0 ? `
**Recent Trends**:
${intelligence.temporalAnalysis.recentTrends.map(t => `• ${t}`).join('\n')}

⚠️ INSTRUCTION: Weight RECENT precedents more heavily. If market is shifting, positions that were "on_market" 12 months ago may now be "off_market".` : ''}`);
  }

  // NEW: Context relevance section
  if (intelligence.contextRelevance.jurisdictionMatchCount > 0 || intelligence.contextRelevance.perspectiveMatchCount > 0) {
    sections.push(`## 🎯 CONTEXT-SPECIFIC INTELLIGENCE
- **Matching Jurisdiction Precedents**: ${intelligence.contextRelevance.jurisdictionMatchCount}
- **Matching Perspective Precedents**: ${intelligence.contextRelevance.perspectiveMatchCount}

⚠️ INSTRUCTION: Prioritize precedents that match the current jurisdiction and perspective. ${intelligence.contextRelevance.jurisdictionMatchCount >= 3 ? 'You have STRONG jurisdiction-specific data - use it!' : 'Limited jurisdiction-specific data - rely more on general patterns.'}`);
  }

  // NEW: Negotiation insights section
  if (intelligence.negotiationInsights.suggestedPriorities.length > 0) {
    sections.push(`## 🎲 NEGOTIATION INTELLIGENCE
**High-Risk Categories** (significant variation in market):
${intelligence.negotiationInsights.highRiskCategories.map(c => `• ${c}`).join('\n') || '• None identified'}

**Common Pushback Areas** (buyer vs seller tension):
${intelligence.negotiationInsights.commonPushbackAreas.map(c => `• ${c}`).join('\n') || '• None identified'}

**Suggested Priorities Based on Precedents**:
${intelligence.negotiationInsights.suggestedPriorities.map(p => `• ${p.category} (${p.leverage} leverage): ${p.reason}`).join('\n')}

⚠️ INSTRUCTION: For high-risk categories, be MORE PRECISE in market position assessment. These are the areas where deviation matters most commercially.`);
  }
  
  // Cross-category insights
  if (intelligence.crossCategoryInsights.length > 0) {
    sections.push(`## 🔗 CROSS-CATEGORY CORRELATIONS
${intelligence.crossCategoryInsights.map(i => `• ${i}`).join('\n')}

⚠️ INSTRUCTION: Consider these correlations when assessing positions. If one category deviates, related categories may also show unusual patterns.`);
  }
  
  // Category-specific intelligence (top categories with good data)
  const strongCategories = intelligence.categoryPatterns.filter(p => p.uniqueDeals >= 2);
  
  if (strongCategories.length > 0) {
    sections.push(`## 📋 CATEGORY-SPECIFIC MARKET INTELLIGENCE`);
    
    for (const cat of strongCategories.slice(0, 15)) { // Top 15 categories
      const catSection: string[] = [];
      catSection.push(`### ${cat.category} (${cat.uniqueDeals} deals, ${cat.positionCount} positions)`);
      
      // Numeric ranges with statistical context
      if (cat.numericPatterns.length > 0) {
        catSection.push(`**Market Ranges** (USE FOR PRECISION BENCHMARKING):`);
        for (const num of cat.numericPatterns) {
          const range = num.max - num.min;
          const rangeContext = range / Math.max(num.median, 1) > 0.3 ? '(HIGH VARIANCE ⚠️)' : '(consistent)';
          catSection.push(`  • ${num.metric}: ${num.min}-${num.max}${num.unit} (median: ${num.median}${num.unit}) ${rangeContext}`);
        }
      }
      
      // Common terms with actionable thresholds
      if (cat.commonTerms.length > 0) {
        const terms = cat.commonTerms.slice(0, 5).map(t => {
          const threshold = t.frequency >= 0.7 ? '✓ STANDARD' : t.frequency >= 0.4 ? '~ COMMON' : '? LESS COMMON';
          return `${t.term} (${Math.round(t.frequency * 100)}% ${threshold})`;
        });
        catSection.push(`**Common Structures**: ${terms.join(', ')}`);
      }
      
      // Position clusters (market norms)
      if (cat.positionClusters.length > 0) {
        const topClusters = cat.positionClusters.slice(0, 3).map(c => `${c.theme} (${c.dealCount} deals)`);
        catSection.push(`**Market Clusters**: ${topClusters.join('; ')}`);
      }
      
      // Jurisdiction patterns
      if (cat.jurisdictionBreakdown.length > 1) {
        const jurPatterns = cat.jurisdictionBreakdown
          .filter(j => j.count >= 2 && j.distinctPatterns.length > 0)
          .slice(0, 3)
          .map(j => `${j.jurisdiction}: ${j.distinctPatterns.slice(0, 2).join(', ')}`);
        if (jurPatterns.length > 0) {
          catSection.push(`**Regional Patterns**: ${jurPatterns.join(' | ')}`);
        }
      }
      
      // Perspective tendencies
      if (cat.perspectiveAnalysis.buyerTendencies.length > 0 || cat.perspectiveAnalysis.sellerTendencies.length > 0) {
        if (cat.perspectiveAnalysis.buyerTendencies.length > 0) {
          catSection.push(`**Buyer-Side Tendency**: ${cat.perspectiveAnalysis.buyerTendencies.slice(0, 3).join(', ')}`);
        }
        if (cat.perspectiveAnalysis.sellerTendencies.length > 0) {
          catSection.push(`**Seller-Side Tendency**: ${cat.perspectiveAnalysis.sellerTendencies.slice(0, 3).join(', ')}`);
        }
      }
      
      sections.push(catSection.join('\n'));
    }
  }
  
  // Enhanced instructions for AI
  sections.push(`## 🎯 HOW TO USE THIS INTELLIGENCE (CRITICAL)

### Market Position Assessment Rules:
1. **ON_MARKET**: Position is within stated ranges, uses structures with ≥50% frequency, matches common clusters
2. **OFF_MARKET**: Position is at edge of ranges (within 10% of min/max), uses structures with 20-50% frequency, partially matches clusters
3. **WAY_OFF_MARKET**: Position is OUTSIDE stated ranges, uses structures with <20% frequency, matches no clusters, OR contradicts strong jurisdiction patterns

### Precision Requirements:
- **Cite specific data**: "This 93% availability is below the market range of 95-99% (median 97%)"
- **Reference term frequency**: "LC requirement is standard (78% of precedents use LC)"
- **Note jurisdiction context**: "While on-market generally, this deviates from typical UK practice"
- **Consider temporal trends**: If market is shifting, note whether position is ahead or behind the trend

### Negotiation Context:
- For HIGH-RISK categories: Be precise and flag any deviation
- For COMMON PUSHBACK areas: Note the buyer/seller tension explicitly
- Reference the SUGGESTED PRIORITIES when relevant

### Statistical Confidence:
- Data Quality: ${intelligence.statisticalDepth.dataQualityScore}/100
- Categories with numeric benchmarks: ${intelligence.statisticalDepth.categoriesWithNumericData}
- Average positions per category: ${intelligence.statisticalDepth.averagePositionsPerCategory}
${intelligence.statisticalDepth.dataQualityScore < 50 ? '\n⚠️ LIMITED DATA - Market positions should be treated as indicative rather than definitive' : ''}`);
  
  return sections.join('\n\n');
}
