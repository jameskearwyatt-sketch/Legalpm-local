

# Three-Tier Player Selection: Background → Key → Anchor

## Concept

Replace the boolean `summaryKeyPlayers` toggle with a three-state cycle per member:
- **0 (Background)**: Default — normal hour allocation (1× share)
- **1 (Key)**: First tap — busy player (2× share)
- **2 (Anchor)**: Second tap — very busy player (4× share)
- Third tap → back to 0

## Changes

### 1. `src/lib/hooks/usePricingProposals.ts`
- Change `summaryKeyPlayers` type from `Record<string, boolean>` to `Record<string, number>` (values 0/1/2)

### 2. `src/pages/PricingProposalDetail.tsx`
- **`toggleKeyPlayer`**: Cycle `0 → 1 → 2 → 0` instead of boolean toggle
- **`handleAutoDistribute`**: Replace `kp[m.key] ? 2 : 1` with multiplier lookup: `{0: 1, 1: 2, 2: 4}[kp[m.key] || 0]`
- **`hasKeyPlayers`** check: `Object.values(kp).some(v => v > 0)`
- Pass updated types to `SummaryPyramid`

### 3. `src/components/pricing/SummaryPyramid.tsx`
- Update `KeyPlayersSelection` component:
  - Props: `keyPlayers: Record<string, number>`
  - Badge styling: default (no highlight) → Key (amber/star) → Anchor (orange/double-star or bolt icon)
  - Show label: "Key" or "Anchor" on the badge
- Update `hasKeyPlayers` check to `Object.values(keyPlayers).some(v => v > 0)`
- Update pyramid block styling: key players show star, anchor players show filled star or bolt with stronger highlight

### 4. `memory/features/pricing-proposal/summary-pyramids.md`
- Document the three-tier system

## Multiplier Summary

| Status | Tap Count | Share Multiplier | Visual |
|--------|-----------|-----------------|--------|
| Background | 0 (default) | 1× | No highlight |
| Key | 1 tap | 2× | Amber + star |
| Anchor | 2 taps | 4× | Orange + bolt/double-star |

