# Memory: features/pricing-proposal/summary-pyramids
Updated: now

The Summary tab features dual "Seniority Pyramid" visualizations that compare Hours Distribution vs. Cost Distribution side-by-side. Team members are grouped into four tiers: Partners, Counsel / Senior Associates, Associates, and Trainees / Juniors.

## Interactive Controls

### Auto-Distribute Presets
Three buttons above the pyramids allow one-click hour distribution to hit `bmUpperTarget`:
- **Pyramid**: Weight ratios Partners 1×, Senior 2×, Associates 3×, Juniors 4× (most hours to juniors)
- **Flat**: Equal weights across all tiers (equal revenue share)
- **Reverse Pyramid**: Partners 3×, Senior 2.5×, Associates 2×, Juniors 3× (partners ≈ juniors)

Locked members are excluded from redistribution; their revenue is subtracted from the target first. Hours are rounded to nearest 0.5.

### Click-to-Expand Fine-Tuning
Clicking any member block in the Hours Distribution pyramid expands an inline editor with:
- Lock/unlock toggle button
- Numeric hour input
- Range slider (0–500, step 0.5)

On slider release, the existing rebalancing logic (`handleSummaryHoursChange`) fires to adjust unlocked members. The Cost Distribution pyramid is read-only (no inline editors).

## Visual Design
Individual members are represented as soft, rounded blocks with pastel tier-colored backgrounds. Locked members show a lock icon overlay and amber ring. The active/expanded member shows a primary ring. Empty tiers display dashed-border placeholders. All values use tabular numbers.
