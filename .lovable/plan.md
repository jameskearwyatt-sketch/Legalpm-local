

# Patch Fix: Bella Budget — USD→GBP Conversion for Settled Items + Tolerance

## Problem
Bella's Version 1 budget was priced in USD. The current budget is in GBP. Every line item shows "Originally: $X" because the raw numbers differ due to FX, masking which items genuinely changed.

## Solution — Two changes

### 1. Convert V1 settled amounts from USD→GBP (Bella-specific patch)

In `src/components/matters/BudgetSection.tsx`, in the `useEffect` that fetches settled items (lines 151–175):

- After fetching V1 line items, detect if the matter is Bella (by `matterId`) and V1 was in USD while current budget is in GBP.
- Apply a hardcoded USD→GBP conversion rate (0.79, matching the fallback rates) to each `fee_amount`.
- This is a display-only patch — no database changes.

### 2. Add tolerance logic (general improvement)

In `src/components/matters/DraggableBudgetItem.tsx`, replace the `> 0.01` absolute threshold with a **percentage-based tolerance of 2%**:

```
// Instead of: Math.abs(displayAmount - settledItem.fee_amount) > 0.01
// Use: Math.abs(displayAmount - settledItem.fee_amount) / settledItem.fee_amount > 0.02
```

This means differences of ≤2% (from FX rounding) won't trigger the "Originally" label. Only genuine budget changes will show.

## Files to edit
- `src/components/matters/BudgetSection.tsx` — USD→GBP conversion for Bella's V1 items
- `src/components/matters/DraggableBudgetItem.tsx` — 2% tolerance threshold (2 locations)

