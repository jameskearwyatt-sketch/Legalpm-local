

## Plan: Add `detail` (narrative description) to budget items + AI paste-to-import for additional scope

### What this does
Two linked changes:
1. **Add a `detail` column to `budget_line_items`** — a longer narrative description field, mirroring the `detail` field that already exists on `pricing_proposal_items`. Existing items will have `NULL` detail (no backfill needed).
2. **Add an "AI Paste Additional Scope" button** to the budget editing UI — when a user is editing a live budget, they can paste a chunk of text describing additional scope work. The AI (via the existing `parse-engagement-letter` edge function) parses it into structured budget items with short titles, narrative details, categories, and fee estimates. These are appended as `is_additional_scope: true` items.

### Technical approach

#### 1. Database migration
- Add `detail TEXT` column (nullable, default `NULL`) to `budget_line_items` table.

#### 2. Update `DraftLineItem` interface (`src/lib/hooks/useBudgetVersions.ts`)
- Add `detail?: string | null` to the `DraftLineItem` interface.
- Update `finalizeBudget` mutation to include `detail` when inserting line items.
- Update `latestLineItems` mapping to include `detail`.

#### 3. Update `BudgetSection.tsx` — AI paste for additional scope
- The existing "Paste Information" button and import dialog already call `parse-engagement-letter`. Update `handleImportFromEngagementLetter` to:
  - Capture `detail` and `category` from AI response (already returned by the edge function).
  - Set `is_additional_scope: true` on imported items when there's already an existing budget.
  - Include `detail` in the created `DraftLineItem` objects.

#### 4. Update `DraggableBudgetItem.tsx` — show/edit detail field
- Add an expandable/collapsible detail textarea below the work item title.
- In view mode: show detail as muted text if present.
- In edit mode: show an editable textarea for the detail field.

#### 5. Update `CategorizedBudgetView.tsx`
- Pass `detail` through to `DraggableBudgetItem`.
- Ensure the `onItemEdit` handler supports `detail` as a field.

#### 6. Update `cancelEditing` in `BudgetSection.tsx`
- Include `detail` when restoring items from `latestLineItems`.

#### 7. Update budget Excel export (`exportBudgetToExcel.ts`)
- Add a "Description" column to the exported spreadsheet showing the `detail` field.

### What does NOT change
- The `parse-engagement-letter` edge function already returns `detail` and `category` — no backend changes needed.
- Existing budgets keep working — `detail` is nullable and defaults to `NULL`.
- The "Paste correspondence to auto-generate rationale" feature (the existing `pastedText` area) remains unchanged; it serves a different purpose (amendment rationale + fee updates).

