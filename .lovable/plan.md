

# Fix: Hours Distribution Must Be Rate-Independent

## Problem

Current logic (line 943-946):
```
memberRevenue = (share / totalShares) × tierRevenue
hours = memberRevenue / rate
```

This gives a cheaper member MORE hours from the same revenue share. James (anchor, 4 shares, rate $1200) gets fewer hours than Mohamed (key, 2 shares, rate $600) because the revenue→hours conversion undoes the share multiplier.

## Fix

Replace the two-phase revenue-then-convert approach with a single-pass **hours-proportional** method:

1. Assign each unlocked member a raw hour weight: `tierWeight × playerMultiplier` (no rate involved)
2. Compute scale factor `K = targetRevenue / Σ(rawWeight_i × rate_i)` so total revenue hits target
3. Final `hours[i] = rawWeight_i × K`, rounded to 0.5h, min 0.5h

This ensures James (anchor, 4×) always gets exactly 2× the hours of Mohamed (key, 2×) in the same tier, regardless of their rates. Revenue target is still met because K adjusts for the rate mix.

## File Change

**`src/pages/PricingProposalDetail.tsx`** — lines 917-948, replace the two-phase tier grouping with:

```typescript
// Assign raw hour weights (rate-independent)
const memberWeights = unlocked.map(m => {
  const tier = classifyTier(m);
  const tierWeight = weights[tier] || 1;
  const level = kp[m.key] || 0;
  const playerMult = level === 2 ? 4 : level === 1 ? 2 : 1;
  return { key: m.key, rate: m.rate, rawWeight: tierWeight * playerMult };
});

// Scale factor so Σ(hours × rate) = targetRevenue
const denom = memberWeights.reduce((s, mw) => s + mw.rawWeight * mw.rate, 0);
if (denom <= 0) return prev;
const K = targetRevenue / denom;

// Assign hours proportional to weight, independent of rate
memberWeights.forEach(mw => {
  hours[mw.key] = Math.max(0.5, Math.round(mw.rawWeight * K * 2) / 2);
});
```

Result: Within the same tier, an anchor (4×) always gets 2× the hours of a key player (2×) and 4× a background player, no matter what their rates are.

