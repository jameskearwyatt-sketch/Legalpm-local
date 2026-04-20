
I’ll correct both the calculation and the presentation.

1. Fix the metric definition
- The current tile is using cumulative window deltas of WIP+Billed+Paid, which is not what you want.
- I’ll change it to monthly WIP movement only:
  - for each matter, take the latest snapshot at month-end
  - subtract the latest snapshot before that month started
  - that gives the month’s WIP movement for that matter
  - sum across included matters
  - then average the last 3, 6, and 12 months separately
- This will respect the same dashboard matter exclusions and stay BM-only / USD.
- I will remove the current “positive deltas only” behaviour, because that is part of why the numbers can look wrong.

2. Make 3M / 6M / 12M visually equal
- The current card promotes 3M by putting it in the main `value` and pushing 6M/12M into the smaller `note`.
- I’ll redesign this tile so all three periods are shown as equal rows inside the card:
  - 3M — $X / mo
  - 6M — $Y / mo
  - 12M — $Z / mo
- No blue text, no “secondary” styling, no visual hierarchy between them.

3. Update the shared StatCard so the layout is clean
- The existing `StatCard` API is too limited for this use because it expects one main value plus one note.
- I’ll extend it to support a custom metrics block or multi-line value content while preserving the existing look of other KPI tiles.

4. Update the helper text
- I’ll rewrite the question-mark helper to describe the actual logic plainly:
  - “Shows the average monthly WIP movement over the last 3, 6, and 12 months, based on monthly changes in the latest snapshots.”
- This will match the implemented formula rather than the old burn definition.

5. Keep the dashboard row split as-is
- Row 1 stays: WIP, Total AR, Total Lock-up, Total Billed, rolling monthly WIP tile
- Row 2 stays: Total Paid, Realization Rate, Collection Rate
- No mixing between rows at any viewport.

Files to update
- src/lib/hooks/useDashboard.ts — replace the current rolling-burn calculation with monthly WIP-movement averages
- src/pages/Dashboard.tsx — render the new equal-weight 3M/6M/12M card
- src/components/ui/stat-card.tsx — add support for equal multi-line metric display
- mem://features/dashboard/kpi-config — update the dashboard memory to the corrected definition and layout

Important technical note
- With the snapshot data you have, the reliable measure available is net monthly WIP movement from one month-end snapshot to the next. If you meant gross WIP added before billing/write-offs, that would require different source data than the current snapshot table stores.
