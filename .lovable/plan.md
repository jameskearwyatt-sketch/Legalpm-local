

# Show AFA-Discounted Rates in Summary Tab

## Problem
When a `discounted_rates` AFA is enabled, the Summary tab's Rate column still shows full undiscounted hourly rates. The rate column should show the discounted rate (since this is the rate the team actually bills at), clearly labelled as AFA-discounted.

## Changes

### 1. `src/pages/PricingProposalDetail.tsx`

**Compute the active discount multiplier** from `proposalAFAs`:
```typescript
const afaRateDiscount = useMemo(() => {
  const discountAfa = proposalAFAs.find(a => a.afa_type === 'discounted_rates' && a.is_enabled);
  if (!discountAfa) return null;
  const pct = (discountAfa.config as any).discountPercent || 0;
  return pct > 0 ? (100 - pct) / 100 : null;
}, [proposalAFAs]);
```

**In the `summary` useMemo** (line ~970): When `afaRateDiscount` is active, use `m.rate * afaRateDiscount` as the display rate for each member. Revenue calculation stays at `hours * m.rate` (undiscounted — budget unchanged), but the rate shown is the discounted rate.

Actually, wait — the rate column is informational. Revenue = hours × rate, and budget is unchanged. The rate shown should be the AFA rate the team bills at. But revenue should still use the full rate (since budget = undiscounted). So we need a separate `displayRate` field.

**Enrich members** with `displayRate`:
```typescript
const displayRate = afaRateDiscount ? m.rate * afaRateDiscount : m.rate;
return { ...m, hours, revenue: hours * m.rate, displayRate, ... };
```

**Update column header** (line ~2832): When discount is active, change "Rate" to "Rate (AFA)" or append a small badge.

**Pass `displayRate`** to `SummarySliderRow` instead of `rate` for the rate column display.

### 2. `src/components/pricing/SummarySliderRow.tsx`

Add optional `displayRate` prop. Show `displayRate` in the Rate cell when provided (with a subtle visual indicator like a different color or small "AFA" badge). Revenue cell continues using the existing `revenue` prop (which uses full rate × hours = budget).

### 3. Blended rate in totals row

The blended rate shown in the totals row (line ~2855) should also reflect the discounted rate when active: `totalRevenue` stays the same but `blendedRate` should be recalculated using display rates if discount is active. Actually, the blended rate is `totalRevenue / totalHours` which gives the undiscounted blended rate. With AFA discount it should show `blendedRate * afaRateDiscount`.

## Summary of display changes
- **Rate column**: Shows AFA-discounted rate per member (e.g., £450 → £405 at 10% discount)
- **Column header**: "Rate (AFA)" when discount active
- **Revenue column**: Unchanged (still full budget)
- **Blended rate**: Shows discounted blended rate
- **No confirmatory text** — just the visual column header change signals it

