

## Plan: Category Sort Order — Contract Order vs. Volatility Ranking

### What Changes
Add a sort toggle to all five Precedent Bank tabs (PPA, Tolling, Carbon, IT Supply, Cloud Compute) with two options:
1. **Contract Order** — the existing canonical clause ordering (current default)
2. **Negotiation Volatility** — ranks categories from most to least "hotly negotiated"

### Volatility Scoring Algorithm

For each category, compute a **volatility score** that factors in both variation and data depth:

```text
volatilityScore = diversityRatio × dataConfidenceMultiplier

diversityRatio = unique market_position values + party_favorability spread
                 across precedents in this category (0–1 scale)

dataConfidenceMultiplier = log2(precedentCount + 1)
  → Categories with 1 precedent get ~1.0×
  → Categories with 3 get ~2.0×  
  → Categories with 7 get ~3.0×
  → Categories with 15 get ~4.0×
```

Concrete signals used:
- **market_position diversity**: If all precedents are `on_market`, low volatility. Mix of `on_market`, `off_market`, `way_off_market` = high volatility.
- **party_favorability diversity**: Mix of buyer-friendly/seller-friendly/balanced = high volatility.
- **Position text similarity**: Use simple Jaccard similarity on position_summary word sets — high divergence = high volatility.
- **Data confidence weighting**: `log2(count + 1)` ensures categories with more data points rank higher when volatility is similar, and categories with only 1-2 precedents are naturally deprioritised.

Categories with 0 precedents in the current filter are excluded. A small badge showing the volatility indicator (e.g., 🔴 High / 🟡 Medium / 🟢 Low) appears next to each category when in volatility sort mode.

### UI

A small `Select` dropdown or toggle group placed next to the existing "Expand all / Collapse all" buttons:

```
[Contract Order ▾]  |  Expand all  Collapse all
```

Options: "Contract Order" and "Negotiation Volatility"

When "Negotiation Volatility" is selected, each category header also shows a small volatility badge with a score indicator.

### Code Changes

**1. New shared utility: `src/lib/precedentVolatility.ts`**
- `computeVolatilityScores(groupedPrecedents)` → returns `Record<string, { score: number; level: 'high' | 'medium' | 'low' }>` 
- Pure function, works with any precedent type (they all share `market_position`, `party_favorability`, `position_summary`)

**2. All five PrecedentBank components** (PPA, Tolling, Carbon, IT Supply, Cloud Compute):
- Add `sortOrder: 'contract' | 'volatility'` state
- Add a `Select` dropdown in the header area
- Replace the existing `.sort()` call on `Object.entries(groupedPrecedents)` with a conditional sort based on `sortOrder`
- When `sortOrder === 'volatility'`, show a small colored badge next to each category name

### Files to Create/Edit

| File | Change |
|------|--------|
| `src/lib/precedentVolatility.ts` | **New** — shared volatility scoring function |
| `src/components/ppa-analyst/PPAPrecedentBank.tsx` | Add sort toggle + conditional sort |
| `src/components/tolling-analyst/TollingPrecedentBank.tsx` | Same |
| `src/components/carbon-analyst/CarbonPrecedentBank.tsx` | Same |
| `src/components/it-supply-analyst/ITSupplyPrecedentBank.tsx` | Same |
| `src/components/cloud-compute-analyst/CloudComputePrecedentBank.tsx` | Same |

