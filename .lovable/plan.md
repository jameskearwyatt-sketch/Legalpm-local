

# Scope-Aware Pricing Intelligence

## Problem

The system cannot distinguish between:
- A **single DD task** like "Colombian DD (incl land)" (~GBP 15-26k)
- A **comprehensive DD report** covering dozens of project documents (~GBP 100-287k)

Both fall into the "Due Diligence" category. The current matching either finds an exact text match (unlikely for broad items) or falls back to a flat category median (~GBP 17k), which is wildly wrong for a comprehensive report.

This is not unique to DD -- the same problem exists across categories (e.g., a single security agreement vs. a full security package; a simple legal opinion vs. a multi-jurisdiction opinion covering 10 topics).

## Solution: Scope Classification + Complexity-Weighted Percentile Pricing

### Core Idea

Before pricing, classify each item's **scope** using signals already available in the data:

1. **Detail text length** -- a comprehensive DD report will have a 300+ character detail describing all the areas covered; a single task will have a short or empty detail
2. **Keyword indicators** -- words like "comprehensive", "full", "report", "review of all", "covering", "including" signal broad scope; words like a single country/entity name signal narrow scope
3. **The item's own work_item label** -- "Due diligence report" (generic/broad) vs. "Colombian DD (incl land)" (specific/narrow)

Use this to place the item on a **percentile scale within its category**, rather than always using the median.

### Changes to `suggest-pricing/index.ts`

**Add scope classification function:**

```text
classifyScope(workItem, detail) -> 'narrow' | 'moderate' | 'broad'

Signals for 'broad':
  - detail length > 250 chars
  - Keywords in work_item or detail: "report", "comprehensive", "full", 
    "all project", "covering", "review of all", "package", "suite",
    "multi", "portfolio"
  - Generic work_item with no specific entity/country name
  
Signals for 'narrow':
  - detail length < 80 chars or no detail
  - Specific entity/country in work_item (e.g., "Colombian", "BVI", "Singapore")
  - Single-topic keywords: specific contract type names
  
Default: 'moderate'
```

**Replace flat category stats with percentile-based pricing:**

Currently when an item has no text match, it falls through to AI with only a category average. Instead:

1. Compute **percentiles** (25th, 50th, 75th, 90th) for each category from historical data
2. Map scope to percentile:
   - `narrow` -> 25th percentile
   - `moderate` -> 50th percentile (median)
   - `broad` -> 75th-90th percentile
3. Use this as a **strong anchor** -- either as the direct precedent price (Tier 2) or as explicit guidance to the AI

**Improve AI prompt for remaining unmatched items:**

When items still go to AI, include the scope classification and the percentile range in the prompt so the AI knows where in the range to price:

```text
Item: "Due diligence report"
Scope: BROAD (detail covers 15+ topics across multiple document types)
Category: Due Diligence
Historical range for Due Diligence: 25th=GBP 15,000, median=GBP 23,000, 75th=GBP 65,000, 90th=GBP 114,000
-> Price this at the 75th-90th percentile given its broad scope.
```

vs.

```text
Item: "Corporate DD on BVI entity"  
Scope: NARROW (single entity, single jurisdiction)
Category: Due Diligence
-> Price this at the 25th percentile.
```

**Better category-relevant context for AI:**

Instead of sending `allHistorical.slice(0, 30)` (arbitrary first 30), for each unmatched item send:
- Top 5 highest-fee items from the same category (so the AI sees the range ceiling)
- 5 lowest-fee items from the same category (so it sees the floor)
- The percentile stats

### Changes to `allocate-target-pricing/index.ts`

Apply the same scope classification and percentile-based pricing to the base price generation step (Phase 2). The deterministic scaling in Phase 3 remains unchanged.

### Implementation Detail

**Percentile helper functions:**

```text
median(values[]) -> number
percentile(values[], p) -> number  // p = 25, 75, 90
```

**Scope classifier:**

```text
function classifyScope(workItem: string, detail: string | null): 'narrow' | 'moderate' | 'broad'

broadIndicators = /\b(report|comprehensive|full|all project|covering|review of all|
  package|suite|multi|portfolio|across|various|range of|complete|
  extensive|wide|broad|overall|summary|overview)\b/i

narrowIndicators = specific country/entity names, short detail, 
  single contract type references

Logic:
  score = 0
  if detail length > 250: score += 2
  if detail length > 150: score += 1  
  if broadIndicators match in workItem or detail: score += 2
  if narrowIndicators match: score -= 2
  if workItem is very generic (< 5 significant words, no proper nouns): score += 1
  
  score >= 3 -> 'broad'
  score <= -1 -> 'narrow'
  else -> 'moderate'
```

**Pricing by scope:**

```text
For Tier 2 (category match, no text match):
  narrow  -> percentile(categoryFees, 25)
  moderate -> percentile(categoryFees, 50)  
  broad   -> percentile(categoryFees, 80)
```

### Files to Modify

1. **`supabase/functions/suggest-pricing/index.ts`** -- Add `classifyScope()`, `median()`, `percentile()` helpers; replace flat category average with scope-aware percentile pricing; improve AI context with category-relevant items and scope guidance
2. **`supabase/functions/allocate-target-pricing/index.ts`** -- Same scope classification and percentile logic for base price generation

### What This Achieves

A "Due diligence report" with a long detail covering many topics will be classified as `broad` and priced at the 80th percentile of DD items (~GBP 80-100k+ depending on data), while "Colombian DD (incl land)" will be classified as `narrow` and priced at the 25th percentile (~GBP 15k). This matches the user's intuitive understanding and requires no additional data -- it uses signals already present in the work item label and detail text.
