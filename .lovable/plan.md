

# Category Lock Feature — Implementation Plan

## What It Does

Adds a **lock icon** to each category tile in the category breakdown. Locked categories protect their work items from any automated pricing changes (AI Price Selected Items, AI Price to Target, Clear Pricing, fee allocation dialogs). Unlike unchecking, locked items **remain included** in totals and targets — the system works around them.

### Answers to the open questions (based on what makes sense for this UX):
- **Lock granularity**: Category-level only (lock icon on the tile locks all items in that category within that phase). Individual item locking is not needed — the checkbox already serves that role.
- **Suggest mode behaviour**: Skip locked items entirely — no suggestion generated. This is cleaner and matches the mental model of "don't touch these".

## Key Behaviour

| Action | Locked items |
|---|---|
| AI Price Selected Items | Skipped (no suggestion generated) |
| AI Price to Target | Fees subtracted from target; only unlocked items receive allocations; target invariant still holds for unlocked subset |
| Category fee allocation (pencil) | Dialog excludes locked items; distributes across unlocked only |
| Phase subtotal edit (pencil) | Same — locked category fees subtracted first |
| Clear Pricing | Skipped |
| Manual cell edits | Still allowed (lock only blocks automated changes) |

## State Model

- **State**: `lockedCategories` — a `Set<string>` of keys like `"phaseId:category"` (or `"global:category"` for single-phase proposals), stored in React state in `PricingProposalDetail.tsx`.
- **Persistence**: Add `locked_categories` (JSON string array) to the proposal's saved payload so locks survive navigation/reload.
- **No DB schema change needed** — the existing `pricing_proposals` table stores items/phases as JSON; `locked_categories` will be added alongside.

## Files to Change

### 1. `src/lib/hooks/usePricingProposals.ts`
- Add `locked_categories?: string[]` to the proposal data shape (parsed from JSON column or stored in the existing JSON metadata).

### 2. `src/pages/PricingProposalDetail.tsx`
- Add `lockedCategories` state (`Set<string>`), initialised from saved proposal data.
- **`generateAiPricing`**: Filter out items whose `phaseId:category` key is in `lockedCategories`.
- **`generateTargetPricing`**: Separate locked vs unlocked items. Subtract locked fees from target. Send only unlocked items to the edge function. Apply results only to unlocked items.
- **Clear Pricing button**: Skip locked items.
- Pass `lockedCategories` and `onToggleLock` callback down to `CategorizedProposalView`.
- Persist `lockedCategories` in the save payload.

### 3. `src/components/pricing/CategorizedProposalView.tsx`
- Accept new props: `lockedCategories: Set<string>`, `onToggleLock: (key: string) => void`.
- In `renderCategoryBreakdown` for phase tiles (not aggregate): add a **lock/unlock icon** button next to the pencil icon.
- When locked: tile gets a subtle visual indicator (e.g., `opacity-75` + lock icon always visible, not just on hover).
- **Fee allocation dialog**: `getItemsForPhaseCategory` filters out items belonging to locked categories; `handleEditClick` / `handleSubtotalEditClick` subtract locked totals.

### 4. `src/components/pricing/CategoryFeeAllocationDialog.tsx`
- No changes needed if parent already filters `affectedItems` to exclude locked items. The dialog just works on what it receives.

## UI Design

On each phase category tile (not aggregate):
```text
┌─────────────────────┐
│ Due Diligence    🔒 │  ← lock icon (always visible when locked)
│ £85,000         ✏️  │  ← pencil hidden when locked
└─────────────────────┘
```

- Unlocked: lock icon appears on hover (like the pencil), as an open padlock.
- Locked: closed padlock icon always visible; tile has a subtle locked styling (slight opacity or dashed border); pencil icon hidden.
- Clicking the lock toggles the state.

## Edge Function Changes

**None.** The lock is enforced entirely client-side by filtering which items are sent to the pricing functions. The edge functions remain unchanged.

