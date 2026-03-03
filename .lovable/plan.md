

# Three Changes: Align Rounding, Exclude Zero-Fee from Pencil, Lock Override Prompt

## 1. Align Scale Wizard Rounding to Largest Remainder Method

**Current**: `ScalePricingWizard.tsx` uses simple `roundTo1000()` with residual added to the largest item.

**Change**: Replace the scaling math in `ScalePricingWizard.tsx` with the same `distributeProRata` logic from `CategoryFeeAllocationDialog.tsx` — which uses smart rounding (nearest 100 for < 10k, nearest 1,000 for >= 10k) and the Largest Remainder Method for exact reconciliation.

Concretely: import `smartRound` (or the shared util) and rewrite the `previewItems` memo to use pro-rata distribution with the target, rather than multiplying each item by a factor and rounding independently.

**File**: `src/components/pricing/ScalePricingWizard.tsx`

## 2. Exclude Zero-Fee Items from Pencil (Category Fee Allocation)

**Current**: `CategorizedProposalView.tsx` builds `affectedItems` for the allocation dialog by filtering out locked items, but includes zero-fee items. The dialog's `distributeProRata` then distributes equally among zero-fee items — which can produce unexpected results.

**Change**: Add `&& getFeeUpper(item) > 0` to the filter in `affectedItems` and `subtotalAffectedItems` memos in `CategorizedProposalView.tsx`. Zero-fee items are excluded from redistribution (consistent with Scale Wizard behaviour).

**File**: `src/components/pricing/CategorizedProposalView.tsx`

## 3. Lock Override Prompt for Scale Pricing & Pencil Adjust

Both the Scale Pricing Wizard and the Category Fee Allocation (pencil) currently exclude locked items silently. Instead, when either feature detects locked items exist within the scope, show an alert dialog asking:

> "Some items belong to locked categories. Would you like to include locked items in this adjustment?"
> [Yes, include locked items] [No, skip locked items]

**Implementation**:
- In `ScalePricingWizard.tsx`: When the wizard opens, check if any included items are locked. If so, show a prompt at the top of Step 1 (or as a pre-step). Based on the user's choice, include or exclude locked items from `selectableItems`.
- In `CategorizedProposalView.tsx`: When `handleEditClick` or `handleSubtotalEditClick` is triggered and locked items exist in the target scope, show an `AlertDialog` before opening the allocation dialog. The user's choice determines whether locked items are included in `affectedItems`.

**State**: Add `includeLocked` boolean state to both components. Default: `false` (current behaviour preserved). When user chooses "Yes", re-compute selectable/affected items to include locked ones.

**Files**:
- `src/components/pricing/ScalePricingWizard.tsx`
- `src/components/pricing/CategorizedProposalView.tsx`

