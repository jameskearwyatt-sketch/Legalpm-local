

# Adjust Preset Weights for Real-World Hour Distribution

## Current Weights
| Preset | Partners | Senior | Associates | Juniors |
|--------|----------|--------|------------|---------|
| Pyramid | 1 | 4 | 3 | 4 |
| Flat | 1 | 1 | 1 | 1 |
| Reverse | 3 | 2 | 2 | 2 |

## Problem
- **Reverse**: Partners (3) vs Associates (2) — correct direction but could be closer
- **Flat**: All equal, but in reality partners should have fewer hours than associates (they're more expensive, so equal effort means fewer hours)
- **Pyramid**: Fine as-is (partners minimal, bulk to juniors/seniors)

## New Weights
| Preset | Partners | Senior | Associates | Juniors |
|--------|----------|--------|------------|---------|
| Pyramid | 1 | 4 | 3 | 4 |
| Flat | 2 | 3 | 3 | 3 |
| Reverse | 5 | 4 | 4 | 3 |

Rationale:
- **Pyramid** (unchanged): Partners get minimal hours, bulk goes to seniors/juniors
- **Flat**: Partners get *some* hours (2) but less than associates (3) — more than pyramid's 1 but clearly fewer than others
- **Reverse**: Partners get the most (5), slightly above associates (4), reflecting partner-heavy matters. Juniors get least (3).

## File Change
**`src/pages/PricingProposalDetail.tsx`** — lines 896-898, update the three weight objects.

