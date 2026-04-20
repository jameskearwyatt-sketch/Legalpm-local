
Approved with addition: 3M, 6M, and 12M rolling averages.

**1. New tile: "Avg Monthly Burn (Rolling)"**
- Position: directly after "Total Billed".
- Shows three figures: 3M, 6M, 12M avg/month (BM only, USD, excludes LC).
- Calculation in `useDashboard.ts`: for each window, sum (latest snapshot in window − latest snapshot before window) per included matter for WIP+Billed+Paid, divide by N months.
- StatCard: main value = 3M figure, `note` shows 6M and 12M stacked (e.g. "6M: $X / mo · 12M: $Y / mo"), tooltip explains the calculation.

**2. Force row break before Total Paid**
- Row 1 grid: WIP, Total AR, Total Locked Up, Total Billed, Avg Monthly Burn (5 tiles)
- Row 2 grid: Total Paid, Realization Rate, Collection Rate (3 tiles)
- Two separate `<div className="grid ...">` wrappers with `mt-4` between, so the groups never mix regardless of viewport width.

## Files
- `src/lib/hooks/useDashboard.ts` — add `avgMonthlyBurn3M`, `avgMonthlyBurn6M`, `avgMonthlyBurn12M`
- `src/pages/Dashboard.tsx` — split KPI grid; insert new tile after Total Billed
- `mem://features/dashboard/kpi-config` — update layout (5+3) and new tile spec
