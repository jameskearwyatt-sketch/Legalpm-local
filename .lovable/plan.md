

# Replace Auto-Rebalancing with Budget Buffer Model

## What changes

Currently, editing any member's hours triggers automatic redistribution of remaining hours across all unlocked members. This is replaced with a simpler model: each member's hours are edited independently, with a visible "hours/budget buffer" showing unallocated capacity, and a hard cap preventing anyone from exceeding what the remaining budget allows.

## Files to change

### 1. `src/pages/PricingProposalDetail.tsx`

**Replace `handleSummaryHoursChange` (lines 841-873):**
- Remove all rebalancing logic (the unlocked-member redistribution)
- New logic: calculate max allowed hours for the edited member = (budget remaining from all *other* members) / member's effective rate
- Clamp `newHours` to `Math.min(newHours, maxAllowed)`, rounded to nearest 0.5
- Simply set `hours[memberKey] = clampedValue` — no touching anyone else's hours

**Replace delta alert (lines 2820-2836):**
- Instead of "exceeds/below" messaging, show a **buffer indicator**: "Unallocated: X hours / $Y remaining" when `summary.delta < 0` (i.e. revenue is below target)
- When buffer is zero (fully allocated), show a subtle "Fully allocated" confirmation
- Remove references to "unlock team members to rebalance"

**Remove lock-related code:**
- Remove `toggleSummaryLock` callback (lines 876-882)
- Remove `summaryLocks` from the summary memo and auto-save
- Remove lock column header from the table (line 2850)
- Remove `lockedMembers` and `onToggleLock` props from `SummaryPyramid` and `SummarySliderRow`

**Update helper text (line 2842):**
- Change from "Lock members to prevent auto-rebalancing" to "Unallocated budget shown below"

### 2. `src/components/pricing/SummarySliderRow.tsx`
- Remove `isLocked` prop, lock button column, and amber styling
- Keep the hours input and slider — slider max should ideally reflect the member's max allowed hours (passed as a new `maxHours` prop) rather than a static 500
- Add new `maxHours` prop to cap the slider and input

### 3. `src/components/pricing/SummaryPyramid.tsx`
- Remove `lockedMembers`, `onToggleLock` props from the component and `PyramidColumn`
- Remove `MemberEditor`'s lock button and locked styling (amber ring, lock icon overlay)
- The inline hour editor remains but without lock toggle

### 4. Memory files
- Update `memory/features/pricing-proposal/team-summary-sync.md` and `memory/ui/summary-hours-interaction.md` to reflect the new buffer model

## How the buffer works

```text
Budget target:  $650,000
Member A:       200h × $1,200 = $240,000
Member B:       150h × $900  = $135,000
Member C:       100h × $750  = $75,000
                ─────────────────────────
Allocated:                     $450,000
Buffer:                        $200,000  ← shown to user

If user tries to give Member C 400h ($300,000):
  Max allowed = ($650,000 - $240,000 - $135,000) / $750 = 366.7h
  → Snaps to 366.5h (rounded to 0.5)
```

## What stays the same
- Auto-distribute presets (Pyramid/Flat/Reverse) still work — they set everyone's hours in one go
- Key player / anchor player designation stays
- The pyramid visualizations stay interactive (click to expand editor)
- Budget scaling when work items change still ratably adjusts all members

