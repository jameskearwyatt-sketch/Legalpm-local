
The user is right. The `refreshAllChartAndListCaches` only fires on snapshot create/update/delete mutations. Since they've already deleted the Sweden datapoints, the dashboard's stale cache (built before my fix shipped) is sitting there permanently — no mutation will trigger the new invalidation logic.

Also visible in the network requests: `write_off_events` table returns 404 ("Could not find the table 'public.write_off_events'") — the delete logic in `useSnapshots.ts` references a table that doesn't exist. This is unrelated to the current bug but worth noting.

The fix: force a one-time global cache purge so the user can recover without manual browser refresh, and harden the dashboard so stale caches can't silently persist across sessions.

## Plan

**1. Add a manual "Refresh data" button on the Dashboard**
- Small refresh icon button in the dashboard header (next to the existing controls).
- On click: calls `queryClient.removeQueries()` for `['dashboard']`, `['snapshots']`, `['matters']`, `['matter']`, `['report-*']`, then `invalidateQueries({ refetchType: 'all' })` for the same. Toasts "Refreshed".
- This gives the user an escape hatch any time they suspect stale data — not just for this Sweden case.

**2. Reduce dashboard query staleness**
- In `useDashboard.ts`, set `staleTime: 0` and `refetchOnMount: 'always'` (matching what `useSnapshots` already does).
- Effect: every time the user navigates to the dashboard, it refetches from the database. No more session-long stale cache.
- Trade-off: one extra fetch per dashboard visit. Acceptable given how often this bug bites.

**3. One-time auto-purge on app load**
- In `App.tsx` (or `main.tsx`), on first mount after this deploy, call `queryClient.clear()` once (gated by a localStorage flag like `cache-purge-v2026-04-20`).
- Guarantees every existing user gets a clean slate the next time they load the app — no need for them to know about the new button.

## Files

- `src/pages/Dashboard.tsx` — add refresh button in header
- `src/lib/hooks/useDashboard.ts` — `staleTime: 0`, `refetchOnMount: 'always'`
- `src/App.tsx` — one-time `queryClient.clear()` gated by localStorage flag
