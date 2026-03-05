

# Additional Scope Items in Budget

## What it does
Adds an "Additional Scope" toggle to each budget line item. Items marked as Additional Scope appear in a distinct section at the top of the categorized budget view, visually separated from the original scope. Each Additional Scope item still gets a standard category (Due Diligence, Documentation, etc.) but is grouped under an "Additional Scope" banner first, making it easy to track how scope evolved over time.

## Database changes
- Add `is_additional_scope` boolean column (default `false`) to `budget_line_items` table via migration.

## Code changes

### 1. `src/lib/hooks/useBudgetVersions.ts`
- Add `is_additional_scope` to `BudgetLineItem` and `DraftLineItem` interfaces.
- Include the field in the finalize mutation insert and in the data mapping from DB.

### 2. `src/components/matters/DraggableBudgetItem.tsx`
- Add an "Additional Scope" toggle (small switch or checkbox) next to each line item when editing.
- Show a small badge/indicator on Additional Scope items when not editing.

### 3. `src/components/matters/CategorizedBudgetView.tsx`
- Split rendering into two sections:
  1. **Additional Scope** section at the top — items where `is_additional_scope === true`, grouped by their assigned category, with a distinct header/border (e.g. emerald/green accent).
  2. **Original Scope** section below — all other items, rendered as today.
- Category subtotals and summary boxes continue to work across both sections.

### 4. `src/components/matters/BudgetSection.tsx`
- Map `is_additional_scope` through the draft item lifecycle (init from DB, save on finalize).
- Expose update handler for the toggle.

### 5. `src/components/matters/BudgetSummaryBoxes.tsx`
- Optionally show a small "Additional Scope" total alongside existing category totals.

## Visual design
- Additional Scope section: emerald/green left border + "Additional Scope" header badge.
- Items within still show their normal category badge (Due Diligence, etc.).
- When no Additional Scope items exist, the section is hidden.

