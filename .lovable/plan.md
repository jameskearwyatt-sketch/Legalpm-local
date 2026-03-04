

# Fix: Rate Discounts Should Not Reduce Budget Line Items

## Analysis

After tracing the full code path, here is the current situation:

- **`DraggableProposalItem.tsx`**: Has `afaDiscountMultiplier` prop but it is **never passed** by any parent — it defaults to `1`. So the Work Items tab display is already correct. The prop and its logic are dead code that should be cleaned up.
- **`afaFilterUtils.ts`**: The `discounted_rates` AFA type (both as primary AFA at line 474 and as secondary discount at line 300) multiplies every BM line item fee by the discount factor. This is the core bug — it reduces the budget when it should not.
- **`exportAFAProposalToExcel.ts`**: Calls `applyAFAFilters`, so the Excel export gets reduced line items.
- **`usePricingProposals.ts`**: Also calls `applyAFAFilters` when syncing to a matter, so the matter budget gets the reduced figure.
- **`EditableRateCard.tsx`**: Shows discounted hourly rates in an "AFA Rate" column — this is **correct** and stays as-is.

## Changes

### 1. `afaFilterUtils.ts` — Stop reducing line item fees for discounted rates

**Primary AFA case (line 474, `discounted_rates`)**: Instead of multiplying each BM item fee by the discount factor, pass through items at their original fees. The `appliedAFAs` array will still record the discount info for display purposes, but line item `fee_amount` values remain unchanged.

**Secondary discount case (line 300, discount + another primary AFA)**: Same fix — stop multiplying BM item fees by the discount factor. Just pass through originals with reconciliation rounding.

The `clientPrice` in `appliedAFAs` should still reflect the discounted total for informational display on the AFA tab (showing what the effective hourly cost would be), but the budget line items themselves stay at baseline values.

### 2. `DraggableProposalItem.tsx` — Remove dead `afaDiscountMultiplier` code

Remove the `afaDiscountMultiplier` prop, its usage in fee display/edit calculations (lines 401, 408, 413-415, 436, 443, 448-450), and the memo comparison (line 548). This is dead code cleanup — no functional change since it was always `1`.

### 3. `usePricingProposals.ts` — No code change needed

Once `applyAFAFilters` stops reducing line items, the matter sync automatically gets the correct full budget values.

### 4. `exportAFAProposalToExcel.ts` — No code change needed

Same as above — the Excel export will automatically show undiscounted budget line items once `applyAFAFilters` is fixed.

## What stays the same

- **EditableRateCard.tsx** "AFA Rate" column showing discounted hourly rates — correct behavior, unchanged.
- **AFATab.tsx** discount configuration and display — unchanged.
- **Summary tab** totals — these are calculated from `draftItems` directly, not from AFA-filtered items, so they are already correct.

## Net result

- Budget = what the deal costs (unchanged by rate discount)
- Discounted rates = team members' effective hourly rate is lower, meaning they can record more hours before blowing the budget
- Excel export and matter sync reflect the true budget, not a discounted version

