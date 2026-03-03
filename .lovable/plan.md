

# Fix: Suppress All UI Updates During Slider Drag

## Problem
The delta alert (above/below estimate message) flashes during slider interaction because commits still trigger full state updates. The user wants **zero visual change** until the mouse button is released.

## Changes

### 1. `SummarySliderRow.tsx` — Simplify to pure local-only during drag
- Remove the `isDragging` ref logic — it's fragile with event ordering
- During drag (`onMouseDown` to `onMouseUp`), only update local state
- The `onChange` handler should **always** set local state, never commit
- Only `onMouseUp`/`onTouchEnd` calls `onHoursCommit`

### 2. `PricingProposalDetail.tsx` — Hide alert during any active drag
- Add a `isDraggingSummary` state (or ref) that is set `true` when any slider starts dragging and `false` on commit
- Pass this as a prop or use it directly to force the alert to `opacity-0` during drag, so it never flashes
- Alternative (simpler): since `SummarySliderRow` now only commits on release, the alert won't flash mid-drag — but we should also ensure the `Input` number field debounces rather than committing on every keystroke

### Simplest approach
Since `SummarySliderRow` already uses local state during drag, the alert *shouldn't* be updating. The likely culprit is that `onChange` on the range input sometimes fires with `isDragging.current === false` (race condition). Fix: **always use local state in onChange, never call commitValue from onChange**.

## Files
- `src/components/pricing/SummarySliderRow.tsx` — Fix onChange to always use local state only

