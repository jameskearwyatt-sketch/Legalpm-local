# Memory: features/pricing-proposal/summary-pyramids
Updated: now

The Summary tab features dual "Seniority Pyramid" visualizations that compare Hours Distribution vs. Cost Distribution side-by-side. Team members are grouped into four tiers: Partners, Counsel / Senior Associates, Associates, and Trainees / Juniors.

## Key Players Selection
Before auto-distribute presets can be used, users must select "key players" — the team members expected to do the most work. An inline UI above the preset buttons shows each member as a toggleable chip grouped by tier. Key players receive a **2× hour multiplier** within their tier during redistribution. Preset buttons are disabled until at least one key player is selected.

State: `assumptions.summaryKeyPlayers: Record<string, boolean>`

## Auto-Distribute Presets
Three buttons allow one-click hour distribution to hit `bmUpperTarget`:
- **Pyramid (▽ inverted triangle)**: Partners 1×, Senior 4×, Associates 3×, Juniors 4× (bulk of hours to seniors & juniors)
- **Flat**: Equal weights across all tiers
- **Reverse (△ upright triangle)**: Partners 3×, Senior 2×, Associates 2×, Juniors 2× (partners-heavy)

Within each tier, key players get 2× hours of non-key players. Locked members are excluded from redistribution; their revenue is subtracted from the target first. Hours are rounded to nearest 0.5.

## Click-to-Expand Fine-Tuning
Clicking any member block in the Hours Distribution pyramid expands an inline editor with:
- Lock/unlock toggle button
- Numeric hour input
- Range slider (0–500, step 0.5)

On slider release, the existing rebalancing logic (`handleSummaryHoursChange`) fires to adjust unlocked members. The Cost Distribution pyramid is read-only (no inline editors).

## Visual Design
Individual members are represented as soft, rounded blocks with pastel tier-colored backgrounds. Locked members show a lock icon overlay and amber ring. The active/expanded member shows a primary ring. Empty tiers display dashed-border placeholders. All values use tabular numbers. Key players show a filled star icon and amber highlight.
