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
 * Main function to generate comprehensive market intelligence from precedent bank
 */
export function generateMarketIntelligence(
  precedents: PPAPrecedent[],
  goldStandardPrecedents: PPAPrecedent[]
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
  
  // Overview
  sections.push(`## MARKET INTELLIGENCE OVERVIEW
- **Total Precedent Deals**: ${intelligence.totalDeals}
- **Total Analyzed Positions**: ${intelligence.totalPositions}
- **Jurisdiction Coverage**: ${intelligence.jurisdictionCoverage.join(', ') || 'Various'}
- **Perspective Balance**: ${intelligence.perspectiveBalance.buyer} buyer / ${intelligence.perspectiveBalance.seller} seller positions
- **Intelligence Confidence**: ${intelligence.intelligenceConfidence.toUpperCase()}
- **Market Norms**: ${intelligence.marketNormsSummary}`);
  
  // Cross-category insights
  if (intelligence.crossCategoryInsights.length > 0) {
    sections.push(`## CROSS-CATEGORY INSIGHTS
${intelligence.crossCategoryInsights.map(i => `• ${i}`).join('\n')}`);
  }
  
  // Category-specific intelligence (top categories with good data)
  const strongCategories = intelligence.categoryPatterns.filter(p => p.uniqueDeals >= 2);
  
  if (strongCategories.length > 0) {
    sections.push(`## CATEGORY-SPECIFIC MARKET INTELLIGENCE`);
    
    for (const cat of strongCategories.slice(0, 15)) { // Top 15 categories
      const catSection: string[] = [];
      catSection.push(`### ${cat.category} (${cat.uniqueDeals} deals, ${cat.positionCount} positions)`);
      
      // Numeric ranges
      if (cat.numericPatterns.length > 0) {
        catSection.push(`**Market Ranges**:`);
        for (const num of cat.numericPatterns) {
          catSection.push(`  • ${num.metric}: ${num.min}-${num.max}${num.unit} (median: ${num.median}${num.unit})`);
        }
      }
      
      // Common terms
      if (cat.commonTerms.length > 0) {
        const terms = cat.commonTerms.slice(0, 5).map(t => `${t.term} (${Math.round(t.frequency * 100)}%)`);
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
  
  // Instructions for AI
  sections.push(`## HOW TO USE THIS INTELLIGENCE

1. **Market Position Assessment**: Compare the PPA position against the ranges and common structures above. If a position falls OUTSIDE the stated ranges or uses uncommon structures, flag as "off_market" or "way_off_market".

2. **Jurisdiction Context**: If analyzing a PPA from a jurisdiction with specific patterns noted above, weight those patterns more heavily.

3. **Perspective Awareness**: Consider whether positions align with buyer-side or seller-side tendencies. Positions that align with the OPPOSITE party's tendencies may indicate negotiating strength or weakness.

4. **Numeric Precision**: When the PPA contains specific figures, compare against the median and ranges. Deviations beyond the min/max are "way_off_market".

5. **Pattern Clusters**: If a position matches a common market cluster, it's likely "on_market". Novel structures not matching any cluster warrant "off_market" consideration.`);
  
  return sections.join('\n\n');
}
