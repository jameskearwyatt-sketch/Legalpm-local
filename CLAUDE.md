# CLAUDE.md — Legal Practice Manager

## Project Overview

Legal Practice Management application built with React 18, TypeScript, Vite, Supabase (auth + PostgreSQL + edge functions), TanStack Query, shadcn/ui, and Tailwind CSS. Handles confidential legal and client data including matters, billing, pricing, contacts, and contract analysis.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS + Radix primitives
- **Backend**: Supabase (auth, PostgreSQL, edge functions, RLS)
- **State/Data**: TanStack React Query, React Context (auth)
- **Validation**: Zod + react-hook-form
- **Charts**: Recharts
- **Excel**: ExcelJS + xlsx

## Project Structure

```
src/
├── App.tsx                          # Root: routing, auth guard, providers
├── main.tsx                         # ReactDOM entry
├── pages/                           # 23 page components (Auth, Dashboard, Matters, Contacts, Growth, Pricing, 5x Analyst, Settings, Flags, etc.)
├── components/
│   ├── ui/                          # ~60 shadcn/ui primitives
│   ├── matters/                     # Matter management (budget, WIP, billing, snapshots)
│   ├── pricing/                     # Pricing engine, proposals, AFA, rate cards
│   ├── contacts/                    # Distribution contacts CRM
│   ├── growth/                      # BD pipeline tracking
│   ├── forms/                       # ClientForm, InvoiceForm, SnapshotForm
│   ├── *-analyst/                   # 5 contract analyst modules (PPA, Tolling, Carbon, IT Supply, Cloud Compute)
│   ├── layout/AppLayout.tsx         # Sidebar nav + mobile menu
│   └── AskAI/, QuickToDo/          # Floating action buttons
├── lib/
│   ├── auth.tsx                     # AuthContext + Supabase auth
│   ├── hooks/                       # ~55 custom data hooks (entire data layer)
│   ├── utils.ts                     # cn() utility
│   └── *Utils.ts, *Categories.ts   # Domain helpers
└── integrations/supabase/
    ├── client.ts                    # Supabase client init
    └── types.ts                     # Auto-generated DB types (78 tables)
supabase/
└── migrations/                      # 20+ SQL migration files
```

## Database

- 78 PostgreSQL tables via Supabase
- RLS enabled on all tables with user-based policies
- RBAC framework: `user_roles` table with admin/user enum + `has_role()` function
- All tables have `created_at` / `updated_at` timestamps

## Architecture Decisions

- All data access goes through custom hooks in `src/lib/hooks/` using TanStack Query
- Auth is React Context-based (`AuthProvider` in `src/lib/auth.tsx`)
- Route protection via `ProtectedRoute` wrapper in `App.tsx`
- Supabase anon key is used client-side (standard Supabase pattern); RLS enforces data isolation
- No server-side rendering — pure SPA

## Known Issues (Audit: March 2025)

### CRITICAL — Must Fix Before Production

1. **`.env` not gitignored** — Supabase credentials are committed to git history. Must add `.env` to `.gitignore`, remove from history, and rotate keys.
2. **XSS via unsanitized `dangerouslySetInnerHTML`** — `EmailOutreachView.tsx:205` and `sticky-table-header.tsx:180` render raw HTML without DOMPurify. Combined with localStorage session storage, this allows full session hijack.
3. **6-character password minimum** — `Auth.tsx:17` allows weak passwords. Must increase to 12+ for legal data.
4. **`useMemo` used for side effects** — `Matters.tsx:107-113` and `Matters.tsx:411-415` use `useMemo` to call `setState`, which violates React rules and causes unpredictable state sync. Must change to `useEffect`.

### HIGH — Should Fix Soon

5. **Form errors silently swallowed** — `ClientForm.tsx`, `InvoiceForm.tsx`, `SnapshotForm.tsx` catch Zod errors but silently discard network/API errors. Users get no feedback on server failures.
6. **WebAuthn debug logs in production** — `useWebAuthn.ts:46,99` logs auth options to console. Remove or guard with `import.meta.env.DEV`.
7. **Settings.tsx query with undefined user_id** — `Settings.tsx:93` queries passkeys with `user?.id` which can be undefined.
8. **Race condition in snapshot upsert** — `useSnapshots.ts:89-118` uses check-then-insert pattern. Should use database-level upsert.
9. **localStorage for session tokens** — `client.ts:13` stores auth tokens in localStorage, vulnerable to XSS theft.

### MEDIUM — Plan to Address

10. **No RBAC enforcement in UI** — Database has roles but frontend doesn't gate any pages/features by role.
11. **23+ tables missing `user_id` FK constraints** — Have `user_id UUID NOT NULL` but no `REFERENCES auth.users(id) ON DELETE CASCADE`.
12. **No audit trail** — No `created_by` / `updated_by` fields on any table. Critical gap for legal compliance.
13. **Full table scans** — `useMatters.ts` loads ALL snapshots into memory then filters in JS. Won't scale past ~1000 matters.
14. **Client-side contact filtering** — `useDistributionContacts.ts` loads all contacts then filters in JS. Should use SQL filters.
15. **Multi-step mutations without transactions** — `usePricingProposals.ts` (markAsAgreed), `useMasterWipUpdates.ts` (revertMasterUpdate) do 3-5 sequential DB operations with no rollback on partial failure.

### LOW — Cleanup

16. **QueryClient has no default config** — No staleTime, no retry limits configured.
17. **Unused variables** — `AppLayout.tsx:56-59` has unused `analystChildren` array.
18. **`as any` type casts** — `AppLayout.tsx:81` casts nav children to `any`.

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run preview      # Preview production build
```

## Conventions

- Components use PascalCase filenames
- Hooks use camelCase with `use` prefix
- All database access goes through hooks in `src/lib/hooks/`
- UI primitives live in `src/components/ui/` (shadcn — do not edit manually)
- Pages are in `src/pages/` and wrapped with `AppLayout` internally
- Supabase types are auto-generated in `src/integrations/supabase/types.ts` — do not edit manually
- Tailwind for styling, no CSS modules
- Zod for form validation
- Toast notifications via sonner (`toast()`) and shadcn toast (`useToast()`)

## Important Notes

- This app handles attorney-client privileged data. Security fixes take priority over features.
- The Supabase types file (`types.ts`) is auto-generated by Lovable/Supabase. Schema changes should be done via migrations.
- After each task step, commit progress to GitHub before moving to the next step.
