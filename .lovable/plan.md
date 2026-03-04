

# Fix: AFA Rate Discount Not Flowing Into Summary Hour Calculations

## Problem

When a rate discount (e.g. 10%) is enabled in the AFA section, everyone's effective hourly rate drops — meaning the same budget should buy **more hours**. But the Summary section ignores the discount entirely because all hour-distribution logic uses `m.rate` (the full, undiscounted rate).

There are four places that calculate hours from revenue using the full rate:

1. **Auto-distribute presets** (line 910, 924, 928) — locked revenue and the scaling factor `K` both use `m.rate`
2. **Manual rebalance** (`handleSummaryHoursChange`, line 850, 862) — uses `m.rate`
3. **Budget scaling** (line 824-836) — ratio-based so unaffected, but initial distribution (line 770) uses `m.rate`
4. **Summary aggregates** (line 978) — `revenue: hours * m.rate` ignores discount

## Fix

Introduce an `effectiveRate(m)` helper that applies the AFA discount:

```typescript
const effectiveRate = useCallback((m: { rate: number }) => {
  return afaRateDiscount ? m.rate * afaRateDiscount : m.rate;
}, [afaRateDiscount]);
```

Then replace `m.rate` with `effectiveRate(m)` in these four locations:

1. **`handleAutoDistribute`** — locked revenue calculation and the `K` scaling denominator use `effectiveRate` so hours expand when rates are discounted
2. **`handleSummaryHoursChange`** — rebalancing uses `effectiveRate` for revenue allocation
3. **Initial distribution** — uses `effectiveRate` when converting revenue-per-member to hours
4. **Summary aggregates** — `revenue: hours * effectiveRate(m)` so totals reflect actual billing

Additionally, add `afaRateDiscount` to the dependency arrays of `handleAutoDistribute` and `handleSummaryHoursChange`.

## Effect

When the user sets a 10% rate discount, the same budget target now produces ~11% more hours across the team, correctly reflecting that cheaper rates = more available time within the same fee.

## File Changed
- `src/pages/PricingProposalDetail.tsx`

