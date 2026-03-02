

# Intelligent AI Pricing Overhaul

## Problems Identified

### 1. Negative Pricing Bug (Price to Target)
The `allocate-target-pricing` edge function asks the AI to allocate exactly the target amount. When the AI's total overshoots (e.g. AI allocated 1,228,000 but target was 1,000,000), the code forces the difference onto the single largest item: `allocations[largestIndex].fee_amount += difference`. With a -228,000 adjustment, that item ends up negative. This is the direct cause of the -183,000 due diligence report.

### 2. No Currency Awareness
Historical data is fetched without any currency context. A GBP 50,000 item and a USD 50,000 item are treated identically. Neither function fetches the currency of the source proposal/matter, so the AI sees misleading price comparisons.

### 3. Shallow Historical Data
- Only `fee_amount` is fetched, not the proposal's currency -- so no FX conversion is possible
- No `detail` text is included -- the AI can't semantically match "Drafting and negotiation of lender direct agreement" to a historical item with similar detail
- Limited to 300-500 items without deduplication, so the same proposal version's items may dominate

### 4. AI-Only Allocation for Target Pricing
The entire allocation decision is delegated to one AI call with a hard constraint ("must sum to exactly X"). The AI frequently fails this arithmetic, and the code's correction mechanism (dump the difference on the largest item) produces absurd results.

---

## Proposed Solution: Two-Phase Deterministic + AI Approach

### Architecture

Both functions will follow a similar improved pattern:

```text
Phase 1: DATA PREPARATION (server-side, deterministic)
  - Fetch historical items WITH their source currency
  - Convert all historical fees to the target currency using exchange rates
  - Deduplicate by taking the most recent version of each proposal
  - Build a "precedent lookup" keyed by normalized work item text
  - For each item to price, find the best historical match(es)

Phase 2: AI INTELLIGENCE (for items without good matches + rationale)
  - Send only items that lack a strong precedent match
  - AI receives currency-normalized historical context
  - AI returns suggestions with a MINIMUM of 0 (enforced in schema)
  - No hard arithmetic constraint on the AI

Phase 3: TARGET ADJUSTMENT (deterministic, Price to Target only)
  - After all items have base prices (from precedent or AI), 
    calculate the ratio: target / sum_of_base_prices
  - Scale ALL items by that ratio uniformly
  - Apply smart rounding
  - Distribute any rounding remainder across items (never on one item)
```

### Detailed Changes

#### 1. Edge Function: `suggest-pricing/index.ts` (AI Price Selected Items)

**Data fetch improvements:**
- Join `pricing_proposal_items` to `pricing_proposals` to get the source currency
- Join `budget_line_items` to `matters` to get the source currency
- Fetch the current exchange rates from the `exchange_rates` table
- Convert all historical fees to the target currency before presenting to AI
- Include `detail` text (truncated to 200 chars) for better semantic matching
- Deduplicate: group by proposal, take only the latest version's items

**Precedent matching (server-side):**
- Normalize work item text (lowercase, strip punctuation)
- For each item needing pricing, search historical items for text similarity
- If a strong match is found (same category + similar text), use the historical price directly
- Only send unmatched items to the AI

**Validation:**
- Enforce `fee_amount >= 0` on every returned price (reject negatives)
- Add a `minimum` constraint in the tool schema: `{ type: 'number', minimum: 0 }`

#### 2. Edge Function: `allocate-target-pricing/index.ts` (AI Price to Target)

**Fundamental approach change -- two-step process:**

Step A: Get "intelligent base prices" for all items (reuse suggest-pricing logic internally, or call the same data-fetch + precedent-match code). This gives each item an unconstrained best-guess price.

Step B: Deterministic scaling to hit the target:
- Calculate `totalBasePrice = sum of all base prices`
- Calculate `scaleFactor = targetAmount / totalBasePrice`
- For each item: `scaledFee = smartRound(baseFee * scaleFactor)`
- Calculate `roundingError = targetAmount - sum(scaledFees)`
- Distribute rounding error across items in small increments (max 100-500 per item), never dumping the entire difference on one item
- Enforce minimum per item (e.g. 500) -- no item goes to zero or negative

**This eliminates the AI arithmetic problem entirely.** The AI's job is just to suggest reasonable relative prices; the code handles the exact arithmetic.

**Data fetch improvements:** Same as suggest-pricing (currency-aware, detail-inclusive, deduplicated).

#### 3. Frontend: `PricingProposalDetail.tsx`

**For Target Pricing result handling:**
- Remove the client-side "adjust largest item" fallback (no longer needed)
- Add validation: if any returned `fee_amount < 0`, reject the entire result and show an error
- Show a toast with scaling info: "Base estimate was X, scaled to target Y (ratio Z%)"

**For both functions:**
- Pass the proposal's `detail` field for each item to the edge function (currently only `work_item`, `provider`, `category` are sent)
- This gives the AI/matching much richer context

### Technical Details

**Exchange rate handling:**
- The app already has an `exchange_rates` table and a `fetch-exchange-rates` edge function
- The edge functions will query `exchange_rates` for the latest rates
- Conversion formula: `convertedFee = originalFee * (targetRate / sourceRate)` where rates are relative to a common base (USD)

**Precedent matching algorithm (server-side in edge function):**
- Normalize: lowercase, remove articles (a/an/the), collapse whitespace
- For each unpriced item, score against historical items using:
  - Category match (must match)
  - Provider match (bonus weight)
  - Text overlap (count of shared significant words / total words)
- Take the top match if score > threshold (e.g. 0.6)
- Use its currency-converted fee as the base price

**Scaling distribution for rounding errors:**
- Sort items by fee descending
- Distribute error in increments of 100 (or 1000 for large deals)
- Cycle through items until error is zero
- This ensures no single item absorbs more than one rounding increment

### Files to Modify

1. `supabase/functions/suggest-pricing/index.ts` -- Major rewrite: add currency-aware data fetch, precedent matching, negative-fee guards
2. `supabase/functions/allocate-target-pricing/index.ts` -- Major rewrite: two-step approach (get base prices then scale deterministically)
3. `src/pages/PricingProposalDetail.tsx` -- Pass `detail` to both functions; remove client-side negative-adjustment logic; add validation guards

### Files Unchanged
- `src/lib/feeSpreadUtils.ts` -- Already correct; the spread calculation works fine once the base fee is sensible

