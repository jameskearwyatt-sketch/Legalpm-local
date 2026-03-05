# Memory: features/pricing-proposal/summary-pyramids
Updated: now

The Summary tab features dual "Seniority Pyramid" visualizations that compare Hours Distribution vs. Cost Distribution side-by-side. Team members are grouped into four tiers: Partners, Counsel / Senior Associates, Associates, and Trainees / Juniors.

## Drag-to-Resize Interaction
Member blocks in the Hours Distribution pyramid are directly resizable:
- Click a member to select them → a drag handle (⋮⋮ GripVertical icon rotated 90°) appears on the right edge
- Grab the handle and drag horizontally: bar width and hours update in real-time via local state
- On mouse/touch release: hours are rounded to nearest 0.5 and committed
- Drag right → hours increase (hard-capped at `maxHours` from budget buffer)
- Drag left → hours decrease toward 0
- Click the hours value directly to open an inline numeric input for precise entry

The Cost Distribution pyramid is read-only (no drag handles or editing).

## Three-Tier Player Selection
Before auto-distribute presets can be used, users must assign player roles via a tap-cycle on member chips:
- **Tap 1 → Key** (⭐ amber): 2× hour share within their tier
- **Tap 2 → Anchor** (⚡ orange): 4× hour share within their tier
- **Tap 3 → Clear**: back to background (1× share)

State: `assumptions.summaryKeyPlayers: Record<string, number>` (0=background, 1=key, 2=anchor)

Preset buttons are disabled until at least one member has level > 0.

## Auto-Distribute Presets
Three buttons allow one-click hour distribution to hit `bmUpperTarget`:
- **Pyramid (▽ inverted triangle)**: Partners 1×, Senior 4×, Associates 3×, Juniors 4×
- **Flat**: Equal weights across all tiers
- **Reverse (△ upright triangle)**: Partners 3×, Senior 2×, Associates 2×, Juniors 2×

Within each tier, anchor players get 4× shares, key players get 2×, background players get 1×.

## Visual Design
Individual members are represented as soft, rounded blocks with pastel tier-colored backgrounds. The selected member shows a primary ring. During drag, the block gets a shadow elevation. Empty tiers display dashed-border placeholders. All values use tabular numbers. Key players show a filled star icon and amber highlight. Anchor players show a bolt icon and orange highlight.
