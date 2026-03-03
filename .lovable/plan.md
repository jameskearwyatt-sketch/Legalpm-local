

# Dual Pyramid Visualization: Hours & Cost Side-by-Side

## Concept

Two pyramids placed side by side inside a Card:
- **Left: Hours Pyramid** — each person's block width proportional to their hours
- **Right: Cost Pyramid** — each person's block width proportional to their revenue (hours × rate)

This immediately reveals where two associates have similar hours but vastly different cost contributions (e.g., London vs Warsaw).

## Tier Classification

Group `summary.teamMembers` by key into 4 tiers:
- **Partners**: key contains `partner`
- **Counsel / Senior Associates**: key contains `counsel` or `seniorAssociate`
- **Associates**: key contains `associate` (not senior)
- **Trainees / Juniors**: everything else (`trainee`, `junior`, `paralegal`, unmatched)

## Visual Design

Each pyramid is a vertical stack of 4 tier rows, centered horizontally. Within each tier row, individual members are shown as soft rounded blocks (`rounded-xl`) side by side.

- **Hours pyramid**: each block's width ∝ person's hours / total hours. Tier row width = sum of its blocks.
- **Cost pyramid**: each block's width ∝ person's revenue / total revenue. Same structure.
- Pastel color per tier: indigo (partners), violet (counsel/sr), sky (associates), emerald (trainees)
- Empty tiers: dashed-border placeholder with "No [role]" label — makes gaps obvious
- Block content: name (truncated) + value (hours or currency)
- Min block width so small allocations remain visible
- CSS `transition-all` on widths for smooth animation when sliders change
- Responsive: stack vertically on narrow screens

## Layout

```text
┌─ Card ──────────────────────────────────────────────┐
│  Hours Distribution          Cost Distribution      │
│                                                     │
│    ┌──P1──┬──P2──┐          ┌────P1────┬──P2──┐     │
│  ┌──SA1──┬──SA2──┐        ┌───SA1───┬───SA2───┐     │
│ ┌─A1─┬─A2─┬─A3─┬─A4┐    ┌─A1─┬──A2──┬─A3─┬─A4─┐   │
│ ┌──T1──┬──T2──┐          ┌──T1──┬──T2──┐            │
└─────────────────────────────────────────────────────┘
```

The cost pyramid may look dramatically different from hours — e.g., a partner with few hours still dominates cost.

## Files

- **New: `src/components/pricing/SummaryPyramid.tsx`** — Memoized component. Props: `teamMembers`, `formatCurrency`, `formatHours`. Renders both pyramids side by side.
- **Edit: `src/pages/PricingProposalDetail.tsx`** — Import and render `SummaryPyramid` between the stat cards and delta alert, passing `summary.teamMembers`, `formatCurrency`, `formatHours`.

