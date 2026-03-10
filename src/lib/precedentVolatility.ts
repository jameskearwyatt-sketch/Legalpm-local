/**
 * Computes negotiation volatility scores for precedent bank categories.
 * 
 * Volatility = how "hotly negotiated" a category is, factoring in:
 * 1. Diversity of market_position values (on/off/way-off market)
 * 2. Diversity of party_favorability values
 * 3. Text divergence across position summaries (Jaccard distance)
 * 4. Data confidence weighting via log2(count + 1)
 */

interface PrecedentLike {
  market_position?: string | null;
  party_favorability?: string | null;
  position_summary: string;
}

export interface VolatilityScore {
  score: number;
  level: 'high' | 'medium' | 'low';
  precedentCount: number;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

function jaccardDistance(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) { if (b.has(w)) intersection++; }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : 1 - intersection / union;
}

function uniqueRatio(values: (string | null | undefined)[]): number {
  const defined = values.filter(Boolean) as string[];
  if (defined.length <= 1) return 0;
  const unique = new Set(defined).size;
  // Normalize: 1 unique value = 0, all different = 1
  return (unique - 1) / (defined.length - 1);
}

function averagePairwiseJaccard(summaries: string[]): number {
  if (summaries.length <= 1) return 0;
  const tokenSets = summaries.map(tokenize);
  let totalDist = 0;
  let pairs = 0;
  // Sample up to 20 pairs for performance
  const maxPairs = 20;
  if (tokenSets.length <= 6) {
    // All pairs
    for (let i = 0; i < tokenSets.length; i++) {
      for (let j = i + 1; j < tokenSets.length; j++) {
        totalDist += jaccardDistance(tokenSets[i], tokenSets[j]);
        pairs++;
      }
    }
  } else {
    // Random sampling
    for (let p = 0; p < maxPairs; p++) {
      const i = Math.floor(Math.random() * tokenSets.length);
      let j = Math.floor(Math.random() * (tokenSets.length - 1));
      if (j >= i) j++;
      totalDist += jaccardDistance(tokenSets[i], tokenSets[j]);
      pairs++;
    }
  }
  return pairs === 0 ? 0 : totalDist / pairs;
}

export function computeVolatilityScores<T extends PrecedentLike>(
  groupedPrecedents: Record<string, T[]>
): Record<string, VolatilityScore> {
  const results: Record<string, VolatilityScore> = {};
  
  for (const [category, precedents] of Object.entries(groupedPrecedents)) {
    const count = precedents.length;
    
    if (count === 0) {
      results[category] = { score: 0, level: 'low', precedentCount: 0 };
      continue;
    }
    
    // Signal 1: market_position diversity (0-1)
    const mpDiversity = uniqueRatio(precedents.map(p => p.market_position));
    
    // Signal 2: party_favorability diversity (0-1)
    const pfDiversity = uniqueRatio(precedents.map(p => p.party_favorability));
    
    // Signal 3: text divergence (0-1)
    const textDivergence = averagePairwiseJaccard(precedents.map(p => p.position_summary));
    
    // Combined diversity ratio (weighted average)
    const diversityRatio = (mpDiversity * 0.3) + (pfDiversity * 0.3) + (textDivergence * 0.4);
    
    // Data confidence multiplier: log2(count + 1)
    const confidence = Math.log2(count + 1);
    
    const score = diversityRatio * confidence;
    
    results[category] = {
      score,
      level: score >= 1.5 ? 'high' : score >= 0.6 ? 'medium' : 'low',
      precedentCount: count,
    };
  }
  
  return results;
}

export function sortByVolatility(
  entries: [string, unknown[]][],
  scores: Record<string, VolatilityScore>
): [string, unknown[]][] {
  return [...entries].sort((a, b) => {
    const scoreA = scores[a[0]]?.score ?? 0;
    const scoreB = scores[b[0]]?.score ?? 0;
    return scoreB - scoreA; // Descending: most volatile first
  });
}
