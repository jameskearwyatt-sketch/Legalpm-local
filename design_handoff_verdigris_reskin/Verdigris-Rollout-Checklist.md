# Verdigris Rollout — Per-Route Checklist

Companion to `Verdigris-Spec.md` (tokens/fonts/components) and `Verdigris Gallery.dc.html`
(the visual QA target, four batched views). This file is the **route-by-route work plan**:
where to think structurally vs. where to just let the tokens flow.

## Legend
- 🟥 **Deep** — needs real layout/structure attention, not just a recolor.
- 🟦 **Reskin** — token cascade does ~all the work; verify spacing/light+dark only.
- 💀 **Dead/stub** — inert in this local edition (cloud functions removed). Recolor only,
  lowest priority. Style any inert buttons normally; just know they do nothing.

## Global (do first — unblocks everything)
- [ ] Replace the Google-Fonts `@import` on line 1 of `src/index.css` with self-hosted
      `@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono` imports (see spec §1).
      **Required** — the CDN `@import` breaks the app's CSP (`font-src 'self' data:`) and
      the offline guarantee.
- [ ] Paste Verdigris `:root` + `.dark` token blocks (bare HSL channels) into `src/index.css`.
- [ ] Confirm `tailwind.config.ts` maps `--chart-1..5`, `--success`, `--ring` and the
      `font-sans` / `font-mono` families. Add `--success` if the repo doesn't already have it.
- [ ] Light/dark toggle (next-themes) still flips cleanly after the token swap.

---

## Routes

### 🟥 Deep attention (layout + structure)

**`/matters` — Matters list** · *hardest screen.*
Dense multi-column table: column toggles, filter chips, multi-line WIP/AR/Paid financial
cell, sparkline column, sortable headers, row hover + selected, the mobile collapse story.
→ Mirror Gallery **Batch 04 · Dense data table** exactly: mono figures, tinted header row,
selected = `primary` 7% fill + 3px inset `primary` rule, financial sub-values in
chart-4 / chart-5 / success. Verify the mobile card fallback.

**`/` — Dashboard.**
KPI grid + charts + burn sparkline + alerts/trend. → Gallery **Batch 04 · KPI cards + Charts**.
Watch chart sizing/aspect at breakpoints; keep KPI value in mono. Recolor alerts to the
banner pattern (Batch 01).

**`/matters/:id` — Matter detail.**
Large tabbed view (budget, WIP, billing, snapshots). → Tabs underline = `primary`; cards flat
with border; snapshot list uses the dialog/list language. Check dense sub-tables reuse the
table spec.

**`/pricing/proposal/:id` — Pricing proposal detail** · *most complex screen.*
Pricing pyramids, sliders, allocation dialogs. → Sliders/dialogs from Batches 02 + 03.
Give the pyramid/allocation viz the chart-1..5 ramp. Most custom markup in the app — budget
real time here.

**`/reports` — Reports.**
Multiple report types, charts + tables. → Reuse chart palette + table spec per report. Verify
every Recharts series maps to `--chart-*` and axis/grid use `--border`/`--muted-foreground`.

**`/contacts` — Contacts** & **`/bm-expertise` — BM Expertise Map.**
Large CRM table / custom visualization. → Contacts: table spec + avatar treatment. Expertise
map: recolor nodes/links to chart ramp; check legibility of the custom viz in dark.

### 🟦 Reskin-only (let tokens flow)

- [ ] `/settings` — forms + switches (Batch 02). Theme/appearance section if present.
- [ ] `/flags` — list + badges.
- [ ] `/help` — typography/prose pass; check link color = `primary`.
- [ ] `/admin/activity` — activity log table (light table spec).
- [ ] `/auth` — centered card; primary button; logo lockup. Quick win.
- [ ] `NotFound` — empty-state pattern (Batch 03).
- [ ] `/time-recording` — timer + entries table; verify mono durations.
- [ ] `/growth`, `/growth/:projectId` — cards + progress; chart ramp if charted.
- [ ] `/credentials` — list/table + badges.
- [ ] `/matters/new`, `/matters/:id/edit` — the New Matter form (Batch 02, incl. error state).
- [ ] `/pricing` — pricing list/cards entry.

### 💀 Dead / inert in local edition (recolor only, lowest priority)

- [ ] `/excel-analyzer` — depended on a removed cloud function; buttons inert. Recolor, no layout effort.
- [ ] `/pricing/adapt` — Adapt Pricing Wizard; effectively dead. Recolor only.
- [ ] Scattered "summarize / parse / enrich" buttons on other pages — style as normal buttons;
      they don't do anything. Don't build affordances around them.

---

## Per-batch QA gate (after each implementation batch)
1. `npm run build` + `npm run lint` green.
2. Toggle light ⇄ dark on the touched routes — both polished.
3. Spot-check interactions still work (nav, open dialogs, table filter/sort, form submit,
      charts render). **Styling/markup only — never touch logic, handlers, query keys, props.**
4. Diff the route against its Gallery batch view.

## Component coverage map (Gallery view → where it appears)
- **01 Shell** → sidebar, mobile drawer, header, auto-backup banner, QuickToDo FAB (global chrome).
- **02 Forms** → every form route + Settings; button variants used app-wide.
- **03 Overlays** → dialogs/alert-dialogs/sheets/dropdowns/tooltips/toasts + empty/loading/error
      (every route; error-boundary is global).
- **04 Data** → Dashboard, Matters, Reports, Contacts, Matter detail sub-tables.
