# Ledger · Verdigris — Production Theme Spec

Final direction for **Legal PM Local**. Scholarly, analytical; deep pine green with
aged-copper verdigris accents over faintly green-tinted paper. Tabular figures,
tight rhythm, strong gridlines. This file is the source of truth for the Phase 2
rollout — apply via theme tokens first, polish components second.

---

## 1. Typography (self-hosted — satisfies CSP `font-src 'self'`)

Install build-time only (no CDN, no runtime fetch):

```bash
npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
```

In `src/main.tsx` (or `src/index.css` top — and **delete the existing Google Fonts
`@import` on line 1**):

```ts
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
```

| Role            | Family            | Notes                                            |
|-----------------|-------------------|--------------------------------------------------|
| UI / headings   | IBM Plex Sans     | 600 for headings & labels, 400/500 body          |
| Figures / data  | IBM Plex Mono     | KPI values, table $ amounts, IDs, counts, code   |

`tailwind.config.ts`:

```ts
fontFamily: {
  sans: ['"IBM Plex Sans"', ...defaultTheme.fontFamily.sans],
  mono: ['"IBM Plex Mono"', ...defaultTheme.fontFamily.mono],
}
```

Type scale (rem): 0.6875 / 0.75 / 0.8125 / 0.875 / 0.9375 / 1.0625 / 1.25 / 1.5.
Uppercase labels: 0.6875rem, `letter-spacing: 0.06em`, weight 600, muted-foreground.

---

## 2. Shape, spacing, elevation

- `--radius: 0.25rem` (4px). Cards use `calc(var(--radius) * 1.5)` = 6px; pills `9999px`.
- Borders are structural — 1px, always visible. Tables lean on row borders + a tinted
  header (`muted` @ 45% over `card`), not zebra striping.
- Elevation is restrained: cards are flat with a border; only overlays (dialog, toast,
  dropdown) get shadow — `0 18px 50px -16px rgba(0,0,0,.35)` light / `.5` dark.
- Density: table rows ~13px tall padding, 13.5px text. KPI value 29px mono.

---

## 3. Color tokens

> Bare HSL channel format (`H S% L%`, space-separated, no commas, no `hsl()`, no hex) to
> match the existing shadcn tokens in `src/index.css`. Consume as `hsl(var(--token))` in
> `tailwind.config.ts` — and for any alpha use `hsl(var(--token) / <alpha>)`.

### `:root` (Light)

```css
:root {
  --background: 120 10% 96%;
  --foreground: 156 16% 12%;
  --card: 0 0% 100%;
  --card-foreground: 156 16% 12%;
  --popover: 0 0% 100%;
  --popover-foreground: 156 16% 12%;
  --primary: 168 43% 21%;            /* deep pine */
  --primary-foreground: 120 10% 96%;
  --secondary: 146 15% 91%;
  --secondary-foreground: 168 43% 21%;
  --muted: 120 10% 94%;
  --muted-foreground: 156 7% 39%;
  --accent: 165 33% 37%;             /* verdigris */
  --accent-foreground: 0 0% 100%;
  --destructive: 4 50% 46%;          /* muted brick */
  --destructive-foreground: 0 0% 100%;
  --success: 165 33% 37%;
  --border: 150 11% 86%;
  --input: 150 11% 86%;
  --ring: 168 43% 21%;

  --chart-1: 168 43% 21%;            /* pine */
  --chart-2: 165 33% 37%;            /* verdigris */
  --chart-3: 104 18% 52%;            /* sage */
  --chart-4: 36 38% 50%;             /* aged brass */
  --chart-5: 198 24% 38%;            /* slate blue */
  --radius: 0.25rem;
}
```

### `.dark`

```css
.dark {
  --background: 165 22% 7%;
  --foreground: 150 17% 89%;
  --card: 164 21% 10%;
  --card-foreground: 150 17% 89%;
  --popover: 155 20% 12%;
  --popover-foreground: 150 17% 89%;
  --primary: 166 33% 53%;            /* bright verdigris reads as primary on dark */
  --primary-foreground: 163 23% 6%;
  --secondary: 163 19% 15%;
  --secondary-foreground: 150 17% 89%;
  --muted: 164 19% 12%;
  --muted-foreground: 148 8% 56%;
  --accent: 166 33% 53%;
  --accent-foreground: 163 23% 6%;
  --destructive: 3 54% 62%;
  --destructive-foreground: 4 49% 7%;
  --success: 162 39% 59%;
  --border: 159 16% 17%;
  --input: 159 16% 17%;
  --ring: 166 33% 53%;

  --chart-1: 166 33% 53%;
  --chart-2: 146 33% 64%;
  --chart-3: 83 29% 63%;
  --chart-4: 38 48% 61%;
  --chart-5: 198 25% 55%;
}
```

Contrast: all foreground/background and primary/primary-foreground pairs clear WCAG AA
(≥4.5:1 body, ≥3:1 large). Keep status text on tinted pills, not tint-on-tint.

---

## 4. Component language

- **Buttons** — primary: solid `primary` / `primary-foreground`. secondary: `secondary`.
  outline: transparent + `border`. ghost: transparent, hover `muted`. destructive:
  solid `destructive`. All `radius`, 600 weight, 8–9px ×14–15px padding.
- **Cards / KPIs** — `card` bg, 1px `border`, 6px radius, flat. Uppercase muted label,
  mono value, delta in `success` (up) or `destructive` (down) + muted note. Sparkline
  uses the matching `chart-*` series color.
- **Tables** — tinted header row (`muted` 45% over `card`), 1px row borders, hover
  `muted` 40%, selected `accent` 10% + left `accent` rule. `$` and counts in mono.
- **Badges / status pills** — `999px`, tinted: bg = series color @ 14% (light) / 20%
  (dark), text = series color, 1px border @ 28%. Map: Active→success, In Review→chart-1,
  Pending→chart-4 (brass), On Hold→muted-foreground, Closed→muted-foreground, Urgent→destructive.
- **Inputs / select / textarea** — `background` fill, 1px `input` border, `radius`,
  focus ring = `ring` (2px). Switch track `primary` on / `muted` off. Slider track
  `muted`, fill `primary`, thumb `card` + 2px `primary` border.
- **Overlays** (dialog, alert-dialog, sheet, dropdown, tooltip, popover) — `popover` bg,
  1px `border`, larger radius (`calc(radius*1.8)` for dialog), the overlay shadow above.
- **Toasts** (sonner + shadcn) — `popover` surface, success glyph in `success` @ 16% tint.
- **Charts (Recharts)** — series in `--chart-1..5` order; grid lines `--border`; axis
  text `--muted-foreground`; area fill = `chart-1` gradient 28%→2%. Sparklines: 2.4px
  stroke, round caps, no fill.
- **Auto-backup banner** — `primary` @ 7% bg, `primary` @ 22% border, `primary` dot.

---

## 5. Phase 2 rollout order (suggested)

1. Tokens + fonts in `src/index.css` / `tailwind.config.ts` → cascades to all shadcn ui.
2. App shell: sidebar (expanded/collapsed) + mobile drawer/header.
3. Dashboard KPIs + charts → Matters table (sort, filter, column toggle, row states).
4. Forms & dialogs across `/matters/new`, `/pricing`, `/settings`, `/auth`.
5. Remaining routes + every state: toasts, empty/loading/skeleton, error boundary,
   QuickToDo FAB, badges. Spot-check light/dark toggle after each batch.

**Single theme — no switcher.** Ship Verdigris only: one `:root` + `.dark` token set.
Drop the exploration directions and any theme-picker UI from the app. `next-themes`
stays for light/dark **mode** only (no third "theme" axis). The exploration files
(`Palette Preview`, `Ledger Studies`) remain here as design reference, not shipped code.
