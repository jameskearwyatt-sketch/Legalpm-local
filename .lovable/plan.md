

# Scale Up / Scale Down Wizard

## What It Does

A new "Scale Pricing" button alongside the existing AI pricing buttons. Opens a multi-step wizard dialog where the user:

1. **Selects items** — by ticking individual work items, whole categories, or whole phases
2. **Sees the current aggregate** for the selection (auto-calculated)
3. **Enters a new target price** — the system computes the scaling factor and shows a preview
4. **Confirms** — all selected items are scaled pro-rata, rounded to the nearest 1,000

No AI is involved. This is purely mathematical scaling. Locked categories are respected (excluded from scaling).

## Wizard Steps

### Step 1: Select Items
- Three selection modes via tabs or toggles: **By Phase**, **By Category**, **By Item**
- Phase tab: checkboxes for each phase (selecting a phase selects all its unlocked, included items)
- Category tab: checkboxes for each category across all phases
- Item tab: flat list of all included, unlocked items with checkboxes
- Selecting a phase/category auto-ticks all child items; partial selection shown as indeterminate
- Current aggregate total for selected items displayed prominently and updates live

### Step 2: Set Target & Preview
- Shows: "Current total: £X" and an input for "New target: £___"
- Auto-computes and displays the scaling factor (e.g., "×1.25 — 25% increase")
- Warning badge if factor is extreme (< 0.5 or > 2.0)
- Preview table showing each selected item: current fee → scaled fee (rounded to nearest 1,000)
- Residual reconciliation applied to largest item (same logic as target pricing) so total matches exactly
- "Back" button to adjust selection

### Step 3: Confirm & Apply
- User clicks "Apply Scaling" — fees are updated in `draftItems`, `hasUnsavedChanges` set to true
- Toast confirmation: "Scaled X items by factor Y.YY to hit £Z target"

## Rounding

All scaled fees rounded to nearest 1,000 (as requested). Residual from rounding drift applied to the largest item to ensure exact target match.

## Interaction with Locks

Locked category items are visually greyed out and cannot be selected in the wizard. They are excluded from the current total calculation and from scaling.

## Files to Change

### 1. New: `src/components/pricing/ScalePricingWizard.tsx`
The wizard dialog component containing all three steps. Props:
- `items: DraftProposalItem[]`
- `phases: ProposalPhase[]`
- `currencySymbol: string`
- `lockedCategories: Set<string>`
- `isItemLocked: (item) => boolean`
- `onApply: (scaledItems: { index: number; fee_upper: number; fee_lower: number; fee_amount: number }[]) => void`
- `open / onOpenChange`

Internal state manages step navigation, selection set, and target amount. The scaling math is done client-side — no edge function needed.

### 2. `src/pages/PricingProposalDetail.tsx`
- Import `ScalePricingWizard`
- Add `isScalePricingOpen` state
- Add a "Scale Pricing" button (using `TrendingUp` or `ArrowUpDown` icon) next to the existing AI buttons
- Wire `onApply` callback to update `draftItems` and set `hasUnsavedChanges`
- The callback updates `fee_upper` to the scaled value, then derives `fee_lower` and `fee_amount` using the existing `calculateFeeRange` utility

## No Edge Function Changes

All logic is client-side arithmetic. No backend changes required.

