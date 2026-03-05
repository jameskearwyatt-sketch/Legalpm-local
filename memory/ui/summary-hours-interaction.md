# Memory: ui/summary-hours-interaction
Updated: now

The summary hours sliders utilize local state and debounced commits to prevent layout instability during interaction. Thumb positions update immediately in the UI, but clamping logic and global state updates only occur on mouse/touch release (onMouseUp/onTouchEnd).

The Budget Buffer Model replaces the previous auto-rebalancing approach:
- Each member's slider max is set to their actual max allowed hours (budget remaining from other members / member's rate), rather than a static 500.
- Hours are clamped server-side to prevent exceeding the budget cap.
- No lock/unlock mechanism exists — all members are always editable.
- The budget buffer indicator uses a fixed-height container (min-h-[52px]) and shows one of three states: "Unallocated: $X remaining" (blue), "Fully allocated" (green), or nothing (delta > 0, which shouldn't occur due to clamping).
- Tabular numbers are used across all summaries to prevent horizontal jitter.
