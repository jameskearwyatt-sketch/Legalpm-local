

# Download WIP Chart as Image

## What it does
Adds a small download button to the detailed burn sparkline hover tooltip. Clicking it captures the entire tooltip content — chart, metrics, and an appended data-point table showing date-by-date WIP buildup — as a downloadable PNG image.

## Approach

### `BurnSparklineDetailedTooltip.tsx`
1. **Add a data-point history table** at the bottom of the tooltip: a compact list of all `dataPoints` (filtered to real snapshots only), showing date and cumulative burn value, plus budget remaining. Styled as a small two-column table with alternating row shading.

2. **Add a download button** (small `Download` icon from lucide) in the tooltip header row. On click:
   - Use `html-to-image` (or manual canvas approach using the existing SVG + DOM) to render the tooltip container to a PNG.
   - Specifically: wrap the tooltip content in a `ref`'d div, use a lightweight DOM-to-canvas library (`html2canvas` pattern) or build a dedicated "export" SVG/canvas that composites the chart SVG + the data table text.
   - Since adding a new dependency may be undesirable, I'll use the **native Canvas API**: clone the SVG to a canvas, then draw the data table text below it programmatically. This avoids new dependencies.

3. **Canvas export approach** (no new deps):
   - Create an offscreen canvas sized to fit chart + data table.
   - Draw the SVG chart by serializing it to a blob URL and drawing via `Image`.
   - Draw the metrics and data-point rows as canvas text below the chart.
   - Trigger download via `a.click()` with `canvas.toDataURL()`.

4. The data table will show columns: **Date** | **Cumulative Burn** | **Budget Used %** for each real snapshot.

### Files to edit
1. `src/components/matters/BurnSparklineDetailedTooltip.tsx` — add download button, data table section, and canvas export logic.

