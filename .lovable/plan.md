
# Multiplier Feature for Work Items

## Overview
Add a "Mult." (multiplier) toggle to each work item row, allowing users to specify a quantity when the number of identical documents/agreements is uncertain. The multiplied fees flow through to all totals and the Excel export includes an explanatory narrative.

## How It Works (User Perspective)
1. Next to the Duplicate and Delete buttons on each work item row, a small "Mult." checkbox appears
2. When checked, a small numeric input appears inline (defaulting to 1) where the user enters the assumed quantity (e.g., 5 security documents)
3. All fee displays (lower, upper, midpoint) are multiplied by this quantity throughout the app -- in the work items table, category totals, grand totals, and AFA calculations
4. In the Excel export, the work item's "Detail" or narrative includes a statement like: *"For the purposes of this estimate, we have assumed [X] instances of this item."*
5. The multiplied total is what appears in fee columns

## Technical Plan

### 1. Data Model Update -- `DraftProposalItem` interface
Add two new fields to the `DraftProposalItem` interface in `src/lib/hooks/usePricingProposals.ts`:
- `is_multiplied?: boolean` -- whether the multiplier is active
- `multiplier_qty?: number` -- the assumed quantity (default 1)

Also add these to the DB insert mapping and the memo comparison in relevant components.

### 2. Database Migration
Add two nullable columns to `pricing_proposal_items`:
- `is_multiplied boolean default false`
- `multiplier_qty integer default 1`

### 3. UI -- PhasedItemCells (main work items table)
In `src/components/pricing/PhasedWorkItemsView.tsx`, add to the Delete/Duplicate buttons area (around line 1061-1084):
- A small "Mult." checkbox
- When checked, show a compact numeric input (width ~50px) for the quantity

### 4. Fee Display Adjustments
Wherever fees are displayed per-item, multiply by `item.multiplier_qty || 1` when `item.is_multiplied` is true:
- **PhasedItemCells** (lines 1212-1258): Lower and Upper estimate display values
- **CategorizedProposalView** `calculateCategoryTotals`: multiply item fees by quantity
- **Version totals calculation** in `usePricingProposals.ts` (line 486-492): include multiplier in sum

### 5. Excel Export
In `src/lib/exportAFAProposalToExcel.ts`:
- When building each item row, multiply `feeAmount` by the quantity
- Append to the Detail cell (or as a separate narrative line below the item): *"For the purposes of this estimate, we have assumed [X] instances of this item."*
- The multiplied fee appears in fee columns as normal

### 6. AddWorkItemDialog
Add `is_multiplied` and `multiplier_qty` fields to `src/components/pricing/AddWorkItemDialog.tsx` so new items can be created with a multiplier from the start.

### 7. Memo Comparisons
Update the custom `arePropsEqual` functions in both `DraggableProposalItem` and `PhasedItemCells` to include `is_multiplied` and `multiplier_qty` in their comparison checks.

### Files to Change
- `src/lib/hooks/usePricingProposals.ts` -- interface + total calculations
- `src/components/pricing/PhasedWorkItemsView.tsx` -- UI checkbox + input + fee display
- `src/components/pricing/CategorizedProposalView.tsx` -- category total calculations
- `src/lib/exportAFAProposalToExcel.ts` -- multiplied fees + narrative in export
- `src/components/pricing/AddWorkItemDialog.tsx` -- optional multiplier on new items
- `src/components/pricing/DraggableProposalItem.tsx` -- if this older view is still used, update similarly
- Database migration for the two new columns
