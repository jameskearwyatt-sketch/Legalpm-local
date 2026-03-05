# Memory: features/pricing-proposal/summary-pyramids
Updated: now

The Summary tab features interactive 'Seniority Pyramid' visualizations for Hours and Cost Distribution. Members are grouped into **five** discrete levels matching the Teams & Rates dropdown: Partner (indigo), Counsel (violet), Senior Associate (purple), Associate (sky), and Trainee (emerald). Each level row has a left-aligned label in its tier colour.

## Drag-to-Resize (Horizontal)
Member bars have a drag handle (⋮⋮ GripVertical rotated 90°) that appears on hover on the right edge. The bar's edge follows the cursor exactly, with hours expanding/contracting in real-time until the budget cap is reached. For precision, an inline numeric input is available by clicking the hours label.

## Drag-Between-Levels (Vertical)
Members can be dragged vertically between level rows using native HTML drag-and-drop. This reassigns the member's "modelling level" without changing their actual seniority. Members **retain the colour of their home level** so the user always knows their real seniority. The override is stored in `assumptions.summaryLevelOverrides: Record<string, string>` and persisted via auto-save. Dragging a member back to their home tier removes the override.

## Bench Feature
Members can be dragged to a "Bench" zone below the pyramid tiers to temporarily remove them from active allocations (hours set to zero). Benched members appear with reduced opacity and a strikethrough label, retaining their home-tier colour. They can be dragged back into any tier row to reactivate. State is stored in `assumptions.summaryBenchedMembers: string[]`. Auto-distribute presets skip benched members. Memory slots save/restore bench state.

## Three-Tier Player Selection
Users assign player roles via tap-cycle on member chips:
- **Tap 1 → Key** (⭐ amber): 2× hour share
- **Tap 2 → Anchor** (⚡ orange): 4× hour share
- **Tap 3 → Clear**: back to 1× share

State: `assumptions.summaryKeyPlayers: Record<string, number>`

## Auto-Distribute Presets
Three buttons distribute hours to hit `bmUpperTarget` using the member's **effective tier** (overridden or home), skipping benched members:
- **Pyramid (▽)**: Partner 1×, Counsel 3×, Sr. Assoc 4×, Associate 3×, Trainee 4×
- **Flat**: Equal-ish weights
- **Reverse (△)**: Partner 5×, Counsel 4×, Sr. Assoc 4×, Associate 3×, Trainee 2×

## Visual Design
Individual members are rounded blocks with pastel tier-coloured backgrounds based on their **home** level. Relocated members show a subtle ring offset. Drop-zone highlights appear on target level rows during drag. Empty tiers show dashed placeholders. The bench zone uses a dashed border with muted background and a UserMinus icon.
