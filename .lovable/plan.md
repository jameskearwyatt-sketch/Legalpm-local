

# Draggable Bar Resize for Pyramid Member Blocks

## Concept
Replace the separate slider/input editor that appears below a member block with a **drag handle on the right edge of the bar itself**. When the user clicks a member block, three dots (⋮⋮) appear on the right side. The user grabs and drags horizontally — the bar visually grows or shrinks in real-time tracking the mouse. On release, hours are committed.

## How it works

```text
┌──────────────────────⋮⋮  ← drag handle (GripVertical icon rotated 90°)
│   Associate A  120h   │
└───────────────────────┘
       ◄── drag left to shrink, drag right to grow ──►
```

- The bar width maps linearly from 0 hours to `maxHours` (budget cap)
- During drag: bar resizes smoothly via local state, no commit until mouseup/touchend
- Drag left → hours decrease toward 0
- Drag right → hours increase, hard-capped at `maxHours`
- Hours rounded to nearest 0.5 on commit

## Changes to `src/components/pricing/SummaryPyramid.tsx`

### 1. Remove `MemberEditor` component entirely
The slider + numeric input below the block is no longer needed.

### 2. New `DraggableBar` behavior in member blocks
When a member block is clicked (selected), render a drag handle (three dots / `GripVertical`) on the right edge of the block. Add `onMouseDown`/`onTouchStart` listeners on that handle that:
- Record the starting X position and starting hours
- On `mousemove`/`touchmove`: calculate delta pixels, convert to delta hours using a scale factor (container width = maxHours), update local state for hours and bar width
- On `mouseup`/`touchup`: commit the final hours via `onHoursCommit`, clear local drag state

### 3. Bar width during drag
Currently bar widths are driven by the tier-level `widthPct`. During a drag, the **individual member's width within its tier** changes based on dragged hours. The tier container width also updates since it's derived from tier totals vs max tier total.

To keep it simple and performant:
- Each member block gets a `flex-grow` value proportional to its hours (or a minimum)
- During drag, only the dragged member's flex-grow updates via local state
- The rest reflow naturally

### 4. Visual details
- Drag handle: `GripVertical` icon (from lucide), small, semi-transparent, appears only on selected/hovered member
- Cursor changes to `col-resize` when hovering the handle
- Hours label updates in real-time during drag
- A subtle tooltip or inline label shows current hours as user drags

### 5. Keep numeric input as fallback
Add a small clickable hours value on the block — clicking it (not the drag handle) opens a tiny inline number input for precise entry. This is simpler than the old full editor.

## Files to edit
- `src/components/pricing/SummaryPyramid.tsx` — replace MemberEditor with drag-resize behavior on member bars

