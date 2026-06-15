# CLAUDE.md — Legal Practice Manager (Local-Only Edition)

## Project Overview

Legal Practice Management application built with React 18, TypeScript, Vite, **PGlite (PostgreSQL compiled to WebAssembly)**, TanStack Query, shadcn/ui, and Tailwind CSS. Handles confidential legal and client data including matters, billing, pricing, and contacts.

This is the **local-only** edition: there is **no cloud backend**. All data lives in the user's browser (PGlite persisted to IndexedDB), all uploaded files live in IndexedDB, and there are no network calls to any external service at runtime. The app runs entirely client-side as a static SPA and works fully offline.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS + Radix primitives
- **Data store**: PGlite (`@electric-sql/pglite`) — an in-browser PostgreSQL, persisted to IndexedDB
- **State/Data**: TanStack React Query (5min staleTime, 1 retry), React Context (auth)
- **Validation**: Zod + react-hook-form
- **Charts**: Recharts
- **Excel**: ExcelJS + xlsx
- **Sanitization**: DOMPurify for any `dangerouslySetInnerHTML`

There are **no cloud dependencies**. `@supabase/supabase-js` and `@simplewebauthn/browser` have been removed; nothing in the dependency tree makes outbound network requests.

## Project Structure

```
src/
├── App.tsx                          # Root: routing, auth guard, providers
├── main.tsx                         # ReactDOM entry
├── pages/                           # 22 page components (Auth, Dashboard, Matters, Contacts, Growth, Pricing, Settings, Reports, Credentials, etc.)
├── components/
│   ├── ui/                          # ~60 shadcn/ui primitives
│   ├── matters/                     # Matter management (budget, WIP, billing, snapshots)
│   ├── pricing/                     # Pricing engine, proposals, AFA, rate cards
│   ├── contacts/                    # Distribution contacts CRM
│   ├── credentials/                 # Deal credentials (CRUD, import, Word export)
│   ├── growth/                      # BD pipeline tracking
│   ├── forms/                       # ClientForm, InvoiceForm, SnapshotForm
│   ├── dashboard/, reports/, time-recording/, bm-contacts/
│   ├── layout/AppLayout.tsx         # Sidebar nav + mobile menu
│   ├── ErrorBoundary.tsx
│   └── QuickToDo/                   # Floating action button
├── lib/
│   ├── auth.tsx                     # AuthContext — local-only, auto-logged-in
│   ├── db/                          # ★ Local data layer (see below)
│   │   ├── pglite.ts                # PGlite instance + schema versioning + export/import/reset
│   │   ├── client.ts                # Supabase-compatible QueryBuilder adapter over PGlite
│   │   ├── schema.sql               # Full DB schema (62 tables) applied on first run
│   │   ├── schema.ts                # SCHEMA_VERSION + runMigrations()
│   │   ├── fileStorage.ts           # IndexedDB file storage + Supabase-Storage-compatible adapter
│   │   └── backup.ts                # Backup / restore / clear-all-data helpers
│   ├── hooks/                       # ~55 custom data hooks (entire data layer)
│   │   └── useUserRole.ts           # Always returns { role: 'admin', isAdmin: true }
│   ├── utils.ts                     # cn() utility
│   └── *Utils.ts, *Categories.ts   # Domain helpers
└── integrations/supabase/
    ├── client.ts                    # Re-export shim: `export const supabase = db` (see "Adapter pattern")
    └── types.ts                     # DB row types (retained for typing only)
```

> Note: the `src/integrations/supabase/` path and the `supabase` export name are kept **only** so that the ~57 files that import `from '@/integrations/supabase/client'` need zero changes. There is no Supabase at runtime — the import resolves to the local PGlite adapter.

## Data Layer — How Local Storage Works

### PGlite (`src/lib/db/pglite.ts`)

- A single `PGlite` instance is created lazily and memoised. Data is persisted to IndexedDB at `idb://legalpm-local` with `relaxedDurability: true`.
- On startup, `getDb()` checks a `schema_version` table. If the DB is new (or below `SCHEMA_VERSION`), `runMigrations()` (in `schema.ts`) executes the bundled `schema.sql` (imported via `?raw`) and records the version.
- `requestPersistentStorage()` asks the browser to mark the origin's storage as persistent so the data isn't evicted under storage pressure.
- Exposes `exportDatabase()` / `importDatabase()` / `resetDb()` used by the backup/restore/clear features.

### The Supabase-compatible adapter (`src/lib/db/client.ts`)

This is the core of the "zero import changes" design. It exports `db`, an object that mimics the shape of a Supabase client so the existing ~55 data hooks work unchanged:

- **`db.from(table)`** returns a chainable QueryBuilder that translates the Supabase query DSL into SQL against PGlite: `select` (including embedded/`!inner` joins), `insert`, `update`, `upsert`, `delete`, filter ops (`eq`, `neq`, `gt`/`gte`/`lt`/`lte`, `in`, `contains`, `overlaps`, `ilike`/`like`, `is`, `not`), `or(...)`, `order`, `range`, `limit`, `single`/`maybeSingle`, and `count`. It returns `{ data, error, count }` just like Supabase.
- **`db.auth`** — local stub: `getSession`, `onAuthStateChange`, `signInWithPassword`, `signUp`, `signOut`. Always resolves to a single hard-coded local user (`LOCAL_USER_ID`). New rows default `user_id` to `LOCAL_USER_ID` when not supplied.
- **`db.storage`** — delegates to the IndexedDB file store (see below).

### File storage (`src/lib/db/fileStorage.ts`)

- Files (uploads, attachments) are stored as `ArrayBuffer` records in a dedicated IndexedDB database (`legalpm-files`), keyed by path.
- Exposes a `localStorage.from(bucket)` adapter mirroring the Supabase Storage API: `upload`, `createSignedUrl` (returns an object URL), `remove`, `download`. This is wired into `db.storage` so existing storage calls work unchanged.

### Backup / restore / clear (`src/lib/db/backup.ts`)

- `downloadBackup()` — dumps the whole PGlite database to a `.legalpm` file (`LegalPM-backup-YYYY-MM-DD-HHmm.legalpm`).
- `restoreFromBackup(file)` — re-imports a `.legalpm` dump.
- `clearAllData()` — resets the database and clears file storage, then reloads.
- `getStorageEstimate()` / `formatBytes()` — surface IndexedDB quota usage.
- These are exposed in the UI on the **Settings** page (Data Management section).

## Auth (`src/lib/auth.tsx`)

- Local-only. There is no real sign-in: the app is **auto-logged-in** as a single local user and that user is **always an admin** (`useUserRole()` returns `{ role: 'admin', isAdmin: true }`).
- `AuthProvider` still exposes `signIn` / `signUp` / `signOut` so existing call sites compile, but they are no-ops backed by the local auth stub.
- WebAuthn has been removed entirely.

## Architecture Decisions

- All data access goes through custom hooks in `src/lib/hooks/` using TanStack Query, exactly as before.
- The **adapter pattern** (`src/integrations/supabase/client.ts` re-exporting the local `db`) means the migration from cloud to local touched the data layer only — the ~57 consuming files keep their original `import { supabase } from '@/integrations/supabase/client'` lines.
- Route protection via `ProtectedRoute` in `App.tsx`. Because auth is always-on/admin, guards never block.
- No server-side rendering — pure SPA. `npm run build` produces a static bundle that can be hosted anywhere (or opened locally) with no backend.
- HTML rendered via `dangerouslySetInnerHTML` is sanitized with DOMPurify.
- `vite.config.ts` injects a strict Content-Security-Policy (`connect-src 'self'`, `script-src 'self'`, `object-src 'none'`, etc.) plus `X-Content-Type-Options: nosniff` via a small `transformIndexHtml` plugin. No hardcoded credentials anywhere.

## Database

- 62 PostgreSQL tables, defined in `src/lib/db/schema.sql` and applied to PGlite on first run.
- Schema changes are made by editing `schema.sql` and bumping `SCHEMA_VERSION` in `schema.ts` (add forward migration steps in `runMigrations` for existing local databases).
- Because everything is single-user and local, RLS is not relevant; the adapter scopes rows to `LOCAL_USER_ID`.

## Migration History (Cloud → Local)

This edition was produced by stripping the original Supabase-backed app down to a fully local one. The five steps were:

1. **Stripped all 5 analyst modules** (PPA, Tolling, Carbon, IT Supply, Cloud Compute) — they required AI/cloud edge functions.
2. **Added PGlite** with IndexedDB persistence, the Supabase-compatible QueryBuilder adapter, and the re-export shim so consuming files needed no import changes.
3. **Simplified auth to local-only** (auto-logged-in, always admin) and added backup / restore / clear-data UI.
4. **Replaced Supabase Storage with IndexedDB file storage**; removed WebAuthn; removed `@supabase/supabase-js` and `@simplewebauthn/browser`.
5. **Removed hardcoded Supabase credentials** from `vite.config.ts` and converted the remaining direct `fetch()` calls to the adapter pattern.

> The legacy `supabase/` directory (old SQL migrations + edge functions) is retained for historical reference only. Nothing in it is used at build time or runtime; it can be deleted without affecting the app.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:8080)
npm run build        # Production build (static, no backend required)
npm run lint         # ESLint
npm run preview      # Preview production build
```

## Conventions

- Components use PascalCase filenames
- Hooks use camelCase with `use` prefix
- All database access goes through hooks in `src/lib/hooks/` (which call the local `db` adapter)
- UI primitives live in `src/components/ui/` (shadcn — do not edit manually)
- Pages are in `src/pages/` and wrapped with `AppLayout` internally
- Tailwind for styling, no CSS modules
- Zod for form validation
- Toast notifications via sonner (`toast()`) and shadcn toast (`useToast()`)

## Important Notes

- This app handles attorney-client privileged data. Keeping it **fully local** (no outbound network calls) is the central privacy guarantee — do not introduce cloud SDKs, telemetry, or external `fetch()` calls.
- All persistence is browser-local. **Data lives only in this browser profile.** Users should use the Settings → Data Management backup feature regularly; clearing site data or using a different browser/device loses everything.
- To change the schema, edit `src/lib/db/schema.sql`, bump `SCHEMA_VERSION`, and add a forward-migration branch in `runMigrations` so existing local databases upgrade cleanly.
- When adding new data access, reuse the `supabase`/`db` adapter via the existing hook pattern rather than touching PGlite directly, so behaviour stays consistent.
