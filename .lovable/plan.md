

# Persistent Toggle-Based Scale Pricing

## Problem
Currently, scaling is a one-shot destructive operation — it overwrites the original fees. The user wants scaling to be a non-destructive layer: toggle it on/off, adjust the factor, and always preserve the underlying baseline figures.

## Concept
Store **baseline fees** (the pre-scale originals) alongside a **scaling state** (on/off + factor + selected indices). When scaling is active, displayed/exported fees = baseline × factor (with LRM rounding). When toggled off, original baseline fees are restored instantly.

## Data Model

Add to proposal state in `PricingProposalDetail.tsx`:
```typescript
interface ScaleState {
  active: boolean;
  factor: number;            // e.g. 1.15 = +15%
  selectedIndices: Set<number>;
  baselineFees: Map<number, { fee_upper: number; fee_lower: number; fee_amount: number }>;
}
```

## Implementation

### 1. `PricingProposalDetail.tsx` — Add scale state & derived items
- New state: `scaleState: ScaleState | null`
- When scaling is applied from the wizard, instead of mutating `draftItems` directly:
  - Snapshot the current fees of selected items into `baselineFees`
  - Store `factor` and `selectedIndices`
  - Set `active: true`
- Compute `effectiveDraftItems` via `useMemo`: if scaling active, apply factor + LRM rounding to baseline fees for selected indices; otherwise use raw `draftItems`
- All downstream consumers (summary, AFA, export, category views) use `effectiveDraftItems` instead of `draftItems`
- Direct edits to a scaled item update its baseline and re-apply the scale factor

### 2. Scale Pricing Controls (inline, not wizard)
- Below the existing "Scale Pricing" button area, when `scaleState?.active`:
  - **Toggle switch**: "Scaling Active" — turns scaling on/off instantly
  - **Slider + input**: Adjust the scaling factor (0.5× to 2.0×) — changes re-apply LRM rounding live
  - **"Clear Scaling" button**: Removes scale state entirely, reverts to baselines permanently
- The existing wizard dialog remains for initial setup (selecting items + setting first target). After first apply, inline controls take over.

### 3. `ScalePricingWizard.tsx` — Adjust onApply signature
- Change `onApply` to return `{ selectedIndices, factor, scaledItems }` so the parent can store the full scale context, not just the result.

### 4. LRM Rounding on Factor Changes
- When the user adjusts the factor via slider, recompute: `targetTotal = sum(baselines) × newFactor`, then run `distributeProRataLRM` across baseline fees to get properly rounded scaled values.
- This ensures every factor change produces clean rounded-to-1000 figures that sum exactly to the target.

### 5. Visual Indicators
- Scaled items get a subtle badge or background tint in the work items table so users know which items are under scaling
- The scale factor and affected count shown in a compact bar above the items list

## Files Changed
- **`src/pages/PricingProposalDetail.tsx`** — Scale state management, `effectiveDraftItems` memo, inline scale controls UI, updated wizard callback
- **`src/components/pricing/ScalePricingWizard.tsx`** — Adjusted `onApply` return shape to include factor and indices

