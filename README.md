# Legal Practice Manager — Local-Only Edition

A legal practice management application for tracking matters, billing, pricing,
contacts, business-development pipeline, and deal credentials. This is the
**local-only edition**: it runs entirely in your browser with **no cloud
backend and no outbound network calls at runtime**.

Because the app handles attorney-client privileged data, keeping everything
local is the central privacy guarantee. Nothing you enter ever leaves your
machine.

## How it works

- **Frontend:** React 18 + TypeScript + Vite, shadcn/ui + Tailwind CSS.
- **Data store:** [PGlite](https://github.com/electric-sql/pglite) — PostgreSQL
  compiled to WebAssembly — running in the browser and persisted to IndexedDB.
- **Files:** uploads and attachments are stored in IndexedDB.
- **Auth:** local-only. The app is auto-logged-in as a single admin user; there
  is no sign-in server.
- **State/data:** TanStack Query over a Supabase-compatible adapter that
  translates queries into SQL against PGlite.

The app is a pure static single-page application. `npm run build` produces a
static bundle you can host anywhere or open locally — it works fully offline.

## ⚠️ Your data lives only in this browser

All data is stored in **this browser profile's** IndexedDB. That means:

- Clearing site data, uninstalling the browser, or switching to a different
  browser, device, or profile **will lose everything**.
- There is no server-side copy and no automatic cloud backup.

**Back up regularly.** Go to **Settings → Data Management** to download a
`.legalpm` backup file, restore from one, or clear all data. Do this often and
keep your backup files somewhere safe.

## Getting started

Requires Node.js and npm.

```sh
# Install dependencies
npm install

# Start the dev server (http://localhost:8080)
npm run dev

# Produce a production build (static, no backend required)
npm run build

# Preview the production build locally
npm run preview

# Lint
npm run lint
```

## Project layout

```
src/
├── pages/                 # Page components (Dashboard, Matters, Contacts, Pricing, Settings, ...)
├── components/            # Feature components + shadcn/ui primitives
├── lib/
│   ├── db/                # Local data layer: PGlite instance, query adapter, schema, file storage, backup
│   ├── hooks/             # TanStack Query data hooks (the data layer)
│   └── auth.tsx           # Local-only auth context (auto admin)
└── integrations/supabase/ # Re-export shim: `supabase` resolves to the local PGlite adapter
```

See [`CLAUDE.md`](./CLAUDE.md) for a detailed architecture reference.

## Notes

- Do not introduce cloud SDKs, telemetry, or external `fetch()` calls — doing so
  would break the offline privacy guarantee.
- A strict Content-Security-Policy (`connect-src 'self'`) is injected at build
  time to prevent the app from making network connections.
- Some AI-assisted features in the UI depend on server-side functions that do
  not exist in this edition; invoking them returns a local "not available"
  message rather than calling out to any service.
