# Handoff: Legal PM Local — "Verdigris" Aesthetic Reskin

## Overview
A soup-to-nuts **aesthetic redesign** of *Legal PM Local*, a local-only legal practice
management web app. The goal is a premium, modern, cohesive, trustworthy look for lawyers
handling confidential data — **without changing any behavior, data, or functionality.**
This is a visual/skin redesign, not a refactor.

The chosen direction is **Ledger · Verdigris**: scholarly and analytical — deep pine green
with aged-copper verdigris accents over faintly green-tinted paper, IBM Plex Sans UI with
tabular IBM Plex Mono figures, a tight 4px radius, strong gridlines, and flat bordered cards.

> **Read the existing repo's `CLAUDE.md` first** to understand the architecture before
> touching anything.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the
intended look and component behavior, **not** production code to copy directly. The target is
an **existing React 18 + TypeScript + Vite + Tailwind + shadcn/ui (Radix) codebase** with
`next-themes` (light/dark) and Recharts. Theme tokens are CSS variables in `src/index.css`
(`:root` and `.dark`), consumed via `tailwind.config.ts`; all shadcn components in
`src/components/ui` read from those tokens.

**Your task: apply this theme to the real codebase using its established patterns** — primarily
by swapping the CSS-variable token set + fonts (which cascades to every shadcn component
automatically), then doing targeted layout/markup polish on the screens flagged for it. Do
**not** port the HTML in this bundle into the app. It is the spec and the visual QA target.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, elevation, and component states
are all specified exactly. `Verdigris-Spec.md` carries the production token values
(bare HSL channels, matching the existing shadcn `src/index.css` format). Recreate to this
standard using the codebase's existing shadcn components and Tailwind config — don't invent
new values.

---

## ⛔ Hard constraints (do not break functionality)
- **Do NOT modify** the data layer or app logic: `src/lib/db/**`, `src/lib/hooks/**`,
  `src/integrations/supabase/**`, auth (`src/lib/auth.tsx`), routing in `App.tsx`, React Query
  keys/mutations, schema, import/export, or the auto-backup feature.
- **Do NOT change** component props, exports, file names, or function signatures. Do NOT remove
  or rename any `data-*`, `id`, `aria-*`, `role`, or test attributes.
- **Prefer theme-token changes** (`src/index.css` + `tailwind.config.ts`) so the look cascades
  automatically. Only touch individual components for layout/spacing/structure polish, and when
  you do, change `className`/markup only — never behavior, state, handlers, or query logic.
- Keep **both light and dark** themes fully working (next-themes).
- Keep it fully **offline and private**: no telemetry/analytics/trackers, no runtime network
  calls, no external CDNs.
- **CRITICAL — fonts.** The app has a strict CSP (`font-src 'self' data:`,
  `style-src 'self' 'unsafe-inline'`, `connect-src 'self'`). All fonts must be **self-hosted**
  (bundle via `@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono`, or local woff2). **Remove
  the existing Google Fonts `@import` at the top of `src/index.css` (line 1)** and replace it with
  the self-hosted imports — that `@import` currently violates the CSP/offline guarantee.
- Any new dependency must be build-time/bundled only (no runtime phone-home).
- Maintain WCAG AA contrast, full keyboard accessibility, and responsiveness (desktop sidebar
  collapsed + expanded, and the mobile drawer/header).
- After every change set, run **`npm run build`** and **`npm run lint`** and ensure both pass.

## Working method
- Work on a new branch (e.g. `redesign/verdigris`). Commit in small, reviewable steps with clear
  messages. Open a PR; **do not merge**. Keep diffs focused — no drive-by refactors.
- **Single theme.** Ship Verdigris only — one `:root` + `.dark` token set; no theme-picker UI.
  `next-themes` stays for the light/dark **mode** toggle only.

---

## Step-by-step implementation

### 1. Fonts (self-hosted) — do first
```bash
npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
```
Remove the Google-Fonts `@import` on line 1 of `src/index.css`. Add the `@fontsource` imports
(in `src/main.tsx` or top of `src/index.css`) — exact weights in **`Verdigris-Spec.md` §1** —
and confirm `tailwind.config.ts` maps `font-sans` → IBM Plex Sans, `font-mono` → IBM Plex Mono.

### 2. Tokens
Paste the Verdigris `:root` and `.dark` blocks from **`Verdigris-Spec.md` §3** into
`src/index.css`. They're bare HSL channels (`H S% L%`) to match the existing shadcn tokens;
consume as `hsl(var(--token))`, and `hsl(var(--token) / <alpha>)` for any opacity. Add
`--success` and `--chart-1..5` to `tailwind.config.ts` if not already mapped.

### 3. Component & layout polish
Work in the **four batches** below. Each maps to a view in `Verdigris Gallery.dc.html` (the
visual QA target) and to the rollout plan in **`Verdigris-Rollout-Checklist.md`**.

---

## Screens / batches
Full detail (layout, exact component styling, states, copy) lives in **`Verdigris-Spec.md` §4**
and is shown live in **`Verdigris Gallery.dc.html`**. Summary:

1. **Shell & navigation** — sidebar (expanded 228px / collapsed 66px) + mobile drawer + header,
   auto-backup banner (primary tint, calm), QuickToDo FAB + open panel. Active nav = solid
   primary; rest muted with hover fill.
2. **Forms & inputs** — buttons (primary/secondary/outline/ghost/destructive × default/hover/
   disabled/icon/loading + sizes), inputs (default/focus-ring/error/disabled/icon/textarea/
   select), switches/checkboxes/radios/sliders, composed New Matter form with error state.
3. **Overlays & feedback** — dialog, alert-dialog, sheet, dropdown menu, tooltip, sonner +
   shadcn toasts, empty / loading-skeleton / error-boundary states.
4. **Data & viz** — KPI/stat cards (mono values + matching sparkline), Recharts area/bar/donut
   on `--chart-1..5`, status badges/pills, the dense Matters table (toolbar with search + filter
   chips + column toggle, sortable header, multi-line WIP/AR/Paid cell, sparkline column, row
   hover + selected).

## Route plan (where to think vs. where tokens flow)
See **`Verdigris-Rollout-Checklist.md`** for the full checklist. Headlines:
- 🟥 **Deep layout attention:** `/matters` (hardest — dense table + mobile), `/` Dashboard,
  `/matters/:id`, `/pricing/proposal/:id` (most complex), `/reports`, `/contacts`, `/bm-expertise`.
- 🟦 **Reskin-only (token cascade):** `/settings`, `/flags`, `/help`, `/admin/activity`, `/auth`,
  `NotFound`, `/time-recording`, `/growth(/:id)`, `/credentials`, `/matters/new`,
  `/matters/:id/edit`, `/pricing`.
- 💀 **Dead/inert in this local edition (recolor only, lowest priority):** `/excel-analyzer` and
  `/pricing/adapt` depended on removed cloud functions; their buttons are inert stubs. Scattered
  "summarize/parse/enrich" buttons elsewhere also do nothing — style them as normal buttons, don't
  build affordances around them.

## Design tokens
Complete set (light + dark, bare HSL channels) in **`Verdigris-Spec.md` §3**. Radius `0.25rem`
(cards `calc(radius*1.5)`); type scale + weights in §1; elevation language (flat cards, shadow
only on overlays) in §2.

## Assets
No external/raster assets required. Icons in the gallery are inline SVG placeholders standing in
for the codebase's existing icon set (e.g. `lucide-react`) — **use the app's existing icons**, do
not copy the prototype's inline SVGs. Fonts are self-hosted via `@fontsource` (see step 1).

## Files in this bundle
- `Verdigris-Spec.md` — production tokens (HSL), fonts, radius/elevation, full component language.
- `Verdigris-Rollout-Checklist.md` — route-by-route work plan + per-batch build/lint QA gate.
- `Verdigris Gallery.dc.html` — the visual QA target (open in a browser; four batched views,
  light/dark toggle). `support.js` must sit beside it for it to render.
- `support.js` — runtime for the gallery prototype (design reference only; not for the app).

## QA gate (after each batch)
1. `npm run build` + `npm run lint` green.
2. Toggle light ⇄ dark on touched routes — both polished.
3. Spot-check interactions still work (nav, dialogs, table filter/sort, form submit, charts).
4. Diff the route against its Gallery batch view.

**Deliverable:** the restyled app on the PR branch — build + lint green, every route and state
visually consistent, light and dark polished, fonts self-hosted, zero functional regressions, no
new network calls. Provide before/after screenshots of the key screens.
