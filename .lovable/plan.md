

# Enable Pencil Editing on Aggregate Total Tiles

## Current State

Aggregate category tiles and the aggregate total box are purely visual — no pencil icon, no click handler. Only phase-level tiles support fee adjustment.

## Proposed Change

Make aggregate tiles interactive, matching the phase tile UX:

### Aggregate Category Tile (e.g., "Due Diligence" in aggregate row)
- Pencil icon appears on hover → opens `CategoryFeeAllocationDialog`
- `affectedItems` = all items matching that category **across all phases** (excluding zero-fee, respecting lock override prompt)
- Lock/unlock icons also shown (toggling locks the category in **all phases** simultaneously)

### Aggregate Total Box
- Pencil icon on hover → opens dialog for the **entire proposal** total
- `affectedItems` = all included items across all phases/categories (excluding zero-fee, lock-aware)
- Uses the existing two-tier distribution (pro-rata across categories, then within each category)

## Files to Change

### `src/components/pricing/CategorizedProposalView.tsx`
1. **Aggregate category tiles** (line ~409-427): Replace the static `<div>` with the same interactive tile used for phase rows — add hover pencil, lock icon, click-to-navigate. Pass `phaseId=null` to `handleEditClick` to signal "all phases".
2. **Aggregate total box** (line ~507-537): Remove the `isPhaseRow` guard on the pencil button so it also renders when `isAggregate` is true. Wire to a new `handleAggregateTotalEdit` (or reuse `handleSubtotalEditClick` with `phaseId=null`).
3. **`getItemsForPhaseCategory` helper**: Ensure it returns items across all phases when `phaseId=null` and `category=null` (for aggregate total) or `phaseId=null` and `category=X` (for aggregate category).
4. **Lock toggle on aggregate**: When `onToggleLock` is called with key `null:Category`, toggle locks for that category in every phase (iterate `phases` and toggle each `phaseId:category` key).

### `src/pages/PricingProposalDetail.tsx`
- Ensure `onToggleLock` callback handles the "all phases" case if aggregate lock keys use a different format.

