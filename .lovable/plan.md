

# Interactive Hour Distribution Controls for Summary Pyramids

## Overview

Add three "Auto-Distribute Hours" preset buttons (Pyramid, Flat, Reverse Pyramid) above the seniority pyramids, plus a fine-tune layer where clicking a member block expands an inline slider to adjust that member's hours, with locked members excluded from rebalancing.

## Distribution Presets

Three toggle buttons above the pyramid visualization:

- **Pyramid**: Juniors get the most hours, partners the least. Weight ratios by tier: Partners 1×, Senior 2×, Associates 3×, Juniors 4×. Within a tier, hours split equally among members. Total revenue = `bmUpperTarget`.
- **Reverse Pyramid**: Partners and juniors get roughly equal hours, seniors/associates in between. Weight ratios: Partners 3×, Senior 2.5×, Associates 2×, Juniors 3×.
- **Flat**: Equal revenue share across all members (current rebalance logic but applied to everyone). Weight ratios: Partners 1×, Senior 1×, Associates 1×, Juniors 1×.

**Calculation**: For each unlocked member, compute `weight / rate`, then normalize so `Σ(hours × rate) = bmUpperTarget`. Locked members' revenue is subtracted from the target first; only unlocked members are redistributed.

## Fine-Tune Layer (Click-to-Expand on Pyramid Blocks)

- Clicking a member block in the **Hours Distribution** pyramid toggles an expanded state showing a small horizontal slider + numeric input below that block.
- Adjusting the slider sets local state; on release (mouseUp/touchEnd), the rebalancing fires — identical to the existing `handleSummaryHoursChange` logic.
- Locked members show a lock icon overlay on their block and are excluded from rebalancing.
- Clicking a locked member's block still allows viewing but the slider is disabled.

## Files to Change

### 1. `src/components/pricing/SummaryPyramid.tsx`
- Add props: `onDistribute: (preset: 'pyramid' | 'flat' | 'reverse') => void`, `onMemberHoursCommit: (key: string, hours: number) => void`, `lockedMembers: Record<string, boolean>`, `onToggleLock: (key: string) => void`
- Render a `ToggleGroup` with three buttons ("Pyramid", "Flat", "Reverse Pyramid") above the pyramids
- Make member blocks clickable — on click, expand an inline slider panel below that block
- Show lock icon on locked members; lock/unlock on right-click or via a small lock toggle in the expanded panel

### 2. `src/pages/PricingProposalDetail.tsx`
- Add `handleAutoDistribute(preset)` callback that computes tier-weighted hours for all unlocked members to hit `bmUpperTarget`, updates `summaryHours` in assumptions state
- Pass `onDistribute`, `onMemberHoursCommit` (reuse `handleSummaryHoursChange`), `lockedMembers` (from `summaryLocks`), and `onToggleLock` (reuse `toggleSummaryLock`) to `SummaryPyramid`

### 3. Memory file update
- Update `memory/features/pricing-proposal/summary-pyramids` with the new interactive capabilities

## Interaction Flow

1. User clicks "Pyramid" → all unlocked members get tier-weighted hours → pyramids animate to new shape → fee breakdown table below updates simultaneously
2. User clicks a member block in the hours pyramid → block expands to show slider + input + lock toggle
3. User drags slider → local display updates immediately → on release, rebalance fires for unlocked members
4. User locks a member → that member's hours become fixed for all future distributions and rebalances

