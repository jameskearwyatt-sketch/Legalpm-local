

# Fix Summary Hours Slider Instability

## Root Cause Analysis

The page jerking has multiple compounding causes:

1. **Every slider pixel fires a full state update**: The native `<input type="range">` fires `onChange` on every mouse movement. Each call hits `handleSummaryHoursChange`, which runs `setAssumptions()` — triggering a re-render of the **entire 3400-line PricingProposalDetail component** including all tabs, stat cards, the delta alert, and the table itself.

2. **Controlled input value fights the slider**: The slider's `value={Math.min(member.hours || 0, 500)}` is recalculated from state on every render. During rapid dragging, React re-renders between mouse events, snapping the thumb back to the just-computed (rebalanced) value before the next drag event arrives — causing visible jitter.

3. **Delta alert layout shift**: The alert toggles between `h-0 overflow-hidden` and normal height. During dragging, the delta crosses the threshold repeatedly, causing the alert to expand/collapse and push the table up and down.

4. **Stat cards re-render with changing numbers**: The "Total Hours" and "Blended Rate" cards change width/height subtly as formatted numbers change length, adding micro-shifts.

## Plan

### 1. Extract a memoized `SummaryTeamTable` component
- Move the entire summary tab content (stat cards + alert + table) into a new `React.memo`-wrapped component
- Props: `summary`, `handleSummaryHoursChange`, `toggleSummaryLock`, `formatCurrency`, `formatHours`, `currencySymbol`
- This isolates re-renders to just this component instead of the full page

### 2. Use local state for slider dragging
- Inside each row, track a `localSliderValue` via `useState` that updates immediately on drag
- Only call `handleSummaryHoursChange` on `onMouseUp` / `onTouchEnd` (commit) or via a debounced callback (~150ms)
- This prevents the rebalancing algorithm from running on every pixel and fighting the thumb position

### 3. Fix the delta alert to never shift layout
- Change from `h-0 overflow-hidden` toggle to a **fixed-height container** with `visibility` and `opacity` transitions only — no height change at all
- Use `min-h-[52px]` (or similar) so the space is always reserved

### 4. Stabilize stat card widths
- Set `min-w` on stat card value elements so changing numbers don't resize the cards

## Files to Change

- **`src/pages/PricingProposalDetail.tsx`**: Extract summary content, fix delta alert height, stabilize stat cards
- **New: `src/components/pricing/SummarySliderRow.tsx`**: Self-contained row component with local slider state and debounced commit

