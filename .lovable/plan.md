

# Bench Feature for Pyramid Team Members

## What it does
Adds a "Bench" zone below the pyramid where users can drag team members to remove them from the active team (hours set to zero). Benched members remain visible and can be dragged back into any tier to reactivate them.

## Technical approach

### `SummaryPyramid.tsx`
- Add a new prop `benchedMembers?: string[]` (array of member keys currently benched) and `onBenchMember?: (key: string, benched: boolean) => void`.
- In `buildTiers`, filter out members whose key is in the benched set. Collect them separately as benched members.
- Render a "Bench" drop zone below the pyramid tiers — a dashed-border area with a label like "Bench" and a chair/pause icon. Shows benched member chips (using their home-tier color, greyed out slightly).
- The bench zone acts as a drag-and-drop target (same native HTML DnD as tier rows). Dropping a member there calls `onBenchMember(key, true)`.
- Benched member chips are draggable back into tier rows, which calls `onBenchMember(key, false)` + `onMemberLevelOverride` to place them in the target tier.
- Both pyramid columns (Hours and Cost) share the same bench state — benched members disappear from both columns and appear once in the bench area.

### `PricingProposalDetail.tsx`
- Add `summaryBenchedMembers: string[]` to assumptions state (persisted like other summary state).
- Pass `benchedMembers` and `onBenchMember` to `SummaryPyramid`.
- `onBenchMember(key, true)`: adds key to benched array, sets hours to 0.
- `onBenchMember(key, false)`: removes key from benched array (hours remain 0 — user resizes or auto-distributes to re-allocate).
- Auto-distribute presets skip benched members.
- Memory slots also save/restore benched state.

### `usePricingProposals.ts`
- Add `summaryBenchedMembers?: string[]` to the `ProposalAssumptions` interface.
- Add to `SummaryMemorySlot` as well.

### Visual design
- Bench area: subtle dashed border, muted background, "Bench" label with a small icon (e.g., `UserMinus` or `Pause`).
- Benched member chips: home-tier colored but with reduced opacity (50%) and a subtle strikethrough or "benched" badge.
- Drop highlight on the bench zone during drag-over, same ring style as tier rows.

## Files to edit
1. `src/lib/hooks/usePricingProposals.ts` — add `summaryBenchedMembers` to types
2. `src/components/pricing/SummaryPyramid.tsx` — bench zone UI, filter benched from tiers, drag targets
3. `src/pages/PricingProposalDetail.tsx` — bench state management, pass props, update auto-distribute and memory slots

