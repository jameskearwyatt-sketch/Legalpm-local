
The bug: deleting snapshots only invalidates `['snapshots', matterId]` and removes some chart caches, but the dashboard's main data hook (`useDashboard`) keys its query differently — and snapshot deletes don't invalidate it. When viewing Sweden alone, the matter-level snapshot query refetches fresh. When other matters are added, the dashboard re-renders from stale cached aggregate data that still contains the deleted snapshot points.

Let me verify by checking `useDashboard` and `useSnapshots` query keys.
