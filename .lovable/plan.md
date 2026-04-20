
The user is right to question this. Let me think through it properly.

**User's mental model:** trailing-12M total burn ≈ $2.63M. So 12M avg/mo × 12 should ≈ $2.63M, i.e. ~$219K/mo. We're showing ~$190K/mo → ~$2.28M, a ~$350K shortfall.

**Where the gap comes from**

The current calculation in `useDashboard.ts` walks 13 month-end anchors and for each matter does `endVal − startVal` per month using `wipAtAnchor`-style helpers. The anchor logic uses the **latest snapshot on or before the anchor date**. This drops burn whenever:

1. **A matter has no snapshot before the 12M start anchor.** A matter onboarded 9 months ago will have `startVal = 0` for its first month-in-window, but its earliest snapshot already contains accumulated WIP/Billed/Paid from before that anchor — so that pre-existing balance is treated as month-1 burn, OR (depending on how the helper handles "no row found") is silently zeroed. Either way, months where `endVal.found === false` are skipped entirely → real burn dropped.
2. **Months with no snapshot get zero delta**, but the *next* month with a snapshot only captures movement vs the last anchor that *did* find a row — so the missing months' burn collapses into one delta, which is fine in isolation, but combined with (1) and the "skip if not found" guard, multi-month gaps lose burn.
3. **The trailing-12M total the user is comparing against** is almost certainly computed differently elsewhere (single delta: latest snapshot − snapshot ~12 months ago, per matter). That's a cleaner, gap-tolerant measurement. The monthly-anchor sum will *always* be ≤ that figure when matters have sparse snapshots.

**The fix: make the 12M figure equal `trailing-12M total / 12` by construction**

Stop summing 12 monthly deltas. Instead, for each window N ∈ {3, 6, 12}:

- For each included matter, take **latest snapshot today** and **latest snapshot on-or-before (today − N months)**.
  - If no pre-window snapshot exists, use the **earliest snapshot in-window** as baseline (matches the previous fix for new matters).
- Compute `burn = ΔWIP + ΔBilled + ΔWriteOff` (gross, same formula as now — this part is correct).
- Sum across matters → `windowTotalBurn`.
- `avg = windowTotalBurn / N`.

This guarantees `12M avg × 12 ≡ trailing-12M total burn` (modulo new-matter baseline truncation, which is unavoidable and small). It also matches the user's intuition exactly.

**Trade-off the user should know:** this loses month-by-month granularity (we no longer compute per-month figures), but since the tile only ever shows averages, that granularity wasn't being used. The simpler formula is also more robust to sparse snapshots.

**Plan**

1. Replace the 13-anchor monthly-loop in `src/lib/hooks/useDashboard.ts` with a 2-anchor window-delta calc per N ∈ {3, 6, 12}. Keep gross formula (`ΔWIP + ΔBilled + ΔWriteOff`), keep BM-only / USD / matter-exclusion respect, keep the new-matter earliest-in-window baseline fallback.
2. Update the tile's helper popover text to: "Total WIP burn over the last N months (gross — adds back billings and write-offs), divided by N."
3. Update `mem://features/dashboard/kpi-config` to record the corrected formula.

**Files**
- `src/lib/hooks/useDashboard.ts`
- `src/pages/Dashboard.tsx` (helper text only)
- `mem://features/dashboard/kpi-config`

No UI structure changes. No StatCard changes. The figures will go up — 12M should land at ~$219K/mo if the user's $2.63M reference is accurate.
