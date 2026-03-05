

# Show Original Settled Budget Amounts During Budget Update

## What it does
When editing the budget (update mode), each work item's fee amount is compared against the **version 1 (original settled)** budget. If the current budgeted amount has changed from the original, the original amount is shown in small italic text beneath or beside the current value — giving instant visibility into budget creep per line item.

## How it works today
- `BudgetSection` already tracks `originalItems` (the values when the current edit session started) for showing "Current → New" comparisons.
- `DraggableBudgetItem` already receives an `originalItem` prop and shows the "Current" column during editing.
- `useBudgetVersions` fetches all versions (sorted descending), so version 1 is the last element of the `versions` array.

## Code changes

### 1. `src/components/matters/BudgetSection.tsx`
- When the component mounts (or versions load), find version 1 from the `versions` array and fetch its line items using the existing `fetchLineItems` function.
- Store these as `settledItems` state.
- Pass a new `settledItem` prop to each `DraggableBudgetItem` (matched by work item name or ID if the item existed in version 1).

### 2. `src/components/matters/DraggableBudgetItem.tsx`
- Add optional `settledItem?: DraftLineItem` prop.
- In **both** the editing view (lines 121–275) and the read-only view (lines 278+):
  - Under the displayed fee amount (Estimate column), if `settledItem` exists and its `fee_amount` differs from the current `fee_amount`, show the original amount in small italic muted text like: *"Originally: £50,000"*.
- This is purely visual — no logic changes, no data model changes.

### 3. `src/components/matters/CategorizedBudgetView.tsx`
- Pass `settledItems` through to `DraggableBudgetItem` where it renders items in the categorized view (if items are rendered there with the same component).

## Visual design
- Small text, italic, muted color beneath the current estimate.
- Format: `Originally £XX,XXX` in `text-xs italic text-muted-foreground`.
- Only shown when the amount differs from the settled version. If no version 1 exists or the item is new (didn't exist in version 1), nothing is shown.

