

# Revised Auto-Distribute: Key Players Selection + Updated Distribution Logic

## What Changes

### 1. Key Players Selection Prompt
Before the auto-distribute buttons work, users must first select "key players" — the team members expected to do the most work. A small inline UI (not a dialog) appears above the preset buttons:

- Each team member shown as a toggleable chip/badge grouped by tier
- Clicking a chip marks that person as a "key player" (highlighted state)
- Users can select any number across any tiers
- Key players within a tier receive a **2× hour multiplier** compared to non-key members in the same tier
- State stored in `assumptions.summaryKeyPlayers: Record<string, boolean>`
- If no key players are selected, the preset buttons show a tooltip "Select key players first" and are disabled

### 2. Updated Distribution Weights

The user clarified that the pyramid exists **between partners and senior associates**, and juniors/trainees get roughly the same hours as senior associates:

| Preset | Partners | Senior Assoc | Associates | Juniors/Trainees |
|--------|----------|-------------|------------|-----------------|
| **Pyramid** (▽) | 1× | 4× | 3× | 4× |
| **Flat** | 1× | 1× | 1× | 1× |
| **Reverse** (△) | 3× | 2× | 2× | 2× |

Within each tier, key players get 2× the hours of non-key players.

### 3. Pyramid Icon Update
- "Pyramid" button: inverted triangle icon (▽, sitting on its point — most hours at junior end)
- "Reverse" button: upright triangle (△)

## Files to Change

### `src/components/pricing/SummaryPyramid.tsx`
- Add a **Key Players** selection section above the preset buttons: render team members as small toggleable chips grouped by tier
- Accept new props: `keyPlayers: Record<string, boolean>`, `onToggleKeyPlayer: (key: string) => void`
- Disable preset buttons when no key players selected
- Update pyramid icon to `rotate-180` for the inverted look
- Reverse icon gets upright triangle

### `src/pages/PricingProposalDetail.tsx`
- Add `summaryKeyPlayers` to assumptions state
- Add `toggleKeyPlayer` handler
- Update `handleAutoDistribute` weights to new table above
- Apply 2× multiplier to key players within their tier when computing `rawWeight`
- Pass `keyPlayers` and `onToggleKeyPlayer` to `SummaryPyramid`

### `memory/features/pricing-proposal/summary-pyramids.md`
- Update with key players concept and revised weights

