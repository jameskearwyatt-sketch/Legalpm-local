# CLAUDE.md — Legal Practice Manager

## Project Overview

Legal Practice Management application built with React 18, TypeScript, Vite, Supabase (auth + PostgreSQL + edge functions), TanStack Query, shadcn/ui, and Tailwind CSS. Handles confidential legal and client data including matters, billing, pricing, contacts, and contract analysis.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS + Radix primitives
- **Backend**: Supabase (auth, PostgreSQL, edge functions, RLS)
- **State/Data**: TanStack React Query (5min staleTime, 1 retry), React Context (auth)
- **Validation**: Zod + react-hook-form
- **Charts**: Recharts
- **Excel**: ExcelJS + xlsx

## Project Structure

```
src/
├── App.tsx                          # Root: routing, auth guard, AdminRoute, providers
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
│   │   └── useUserRole.ts           # RBAC hook for admin/user role checking
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
- All tables now have proper `user_id` FK constraints to `auth.users(id) ON DELETE CASCADE`
- Key tables have `created_by` / `updated_by` audit fields (matters, financial_snapshots, budget_amendments, budget_versions, pricing_proposals, invoices, growth_projects)
- Unique constraint on `financial_snapshots(matter_id, as_of_date)` prevents duplicate daily snapshots

## Architecture Decisions

- All data access goes through custom hooks in `src/lib/hooks/` using TanStack Query
- Auth is React Context-based (`AuthProvider` in `src/lib/auth.tsx`)
- Route protection via `ProtectedRoute` wrapper in `App.tsx`; `AdminRoute` for admin-only pages
- Supabase anon key is used client-side (standard Supabase pattern); RLS enforces data isolation
- No server-side rendering — pure SPA
- HTML rendered via `dangerouslySetInnerHTML` is sanitized with DOMPurify
- Contact filtering uses SQL-level queries where possible (countries, owners, dates, sectors, EMI focus areas); only NAICS-derived sectors use JS filtering

## Completed Fixes (March 2025 Audit)

All 18 issues from the original audit have been resolved:

| # | Issue | Fix | Commit |
|---|-------|-----|--------|
| 1 | `.env` committed to git | Added to `.gitignore`, removed from tracking | CRITICAL |
| 2 | XSS via `dangerouslySetInnerHTML` | DOMPurify sanitization added | CRITICAL |
| 3 | 6-char password minimum | Increased to 12 characters | CRITICAL |
| 4 | `useMemo` for side effects | Changed to `useEffect` | CRITICAL |
| 5 | Form errors silently swallowed | Added non-Zod error handling | HIGH |
| 6 | WebAuthn debug logs | Removed `console.log` statements | HIGH |
| 7 | Undefined `user_id` in Settings | Added null guard | HIGH |
| 8 | Snapshot upsert race condition | Update-first pattern with retry | HIGH |
| 9 | localStorage session tokens | XSS vectors fixed (DOMPurify); CSP recommended | HIGH |
| 10 | No RBAC in UI | `AdminRoute` + `useUserRole` hook added | MEDIUM |
| 11 | 63 tables missing FK constraints | Migration adds all FK constraints | MEDIUM |
| 12 | No audit trail | `created_by`/`updated_by` on key tables | MEDIUM |
| 13 | Unbounded snapshot loading | 6-month window with fallback for latest | MEDIUM |
| 14 | Client-side contact filtering | Moved to SQL (overlaps, in, gte) | MEDIUM |
| 15 | Multi-step mutations no error handling | Error tracking added to all loops | MEDIUM |
| 16 | QueryClient no defaults | 5min staleTime, retry config | LOW |
| 17 | Unused `analystChildren` variable | Removed | LOW |
| 18 | `as any` type cast | Fixed `NavGroup` type definition | LOW |

## Analyst Suite — April 2026 Upgrade Track

Cross-analyst improvements are being delivered coherently across PPA, Tolling, Carbon, IT Supply, and Cloud Compute. Status:

| # | Upgrade | Status |
|---|---------|--------|
| 2 | Applied-learnings trace (audit / provenance per analysis) | **Done** (Apr 2026) |
| 1 | Embedding-based retrieval of relevant learnings/precedents | **Done** (Apr 2026) |
| 3 | Prompt caching | Blocked (codebase uses Lovable AI Gateway → Gemini, not Anthropic Messages API) |
| 4 | Postgres transactions for multi-step analyst mutations | **Done** (Apr 2026) |
| 5 | Learning quality controls (conflict detection, golden-set regression) | Pending |
| 6 | Structured output (JSON schema / tool use) | Pending |
| 7 | Observability & telemetry | Partial (duration + token counts captured) |
| 8 | Cross-analyst reuse / shared component refactor | Pending |
| 9 | PII redaction + LLM call audit log | Pending |
| 10 | Streaming / batch / Word export | Pending |

### Applied-Learnings Trace (#2) — Shipped

- Migration `20260414000001_add_analyst_applied_context_tracking.sql` adds `applied_learning_ids`, `applied_precedent_ids`, `applied_gold_standard_ids`, `model_used`, `analysis_duration_ms`, `input_token_count`, `output_token_count` to all 5 `*_analyses` tables, with GIN indexes on the ID arrays for future "which analyses used learning X" queries.
- All 5 upload components capture the IDs of every learning / raw precedent / gold-standard template passed to the LLM and persist them on the analysis row along with wall-clock duration.
- Shared UI `src/components/shared/AnalystAppliedContextBadge.tsx` renders an "Informed by N corrections, M gold-standards, K precedents" pill on each analysis report. Clicking opens a dialog listing exactly which items shaped the analysis, with timestamps.
- Edge functions may optionally return `model_used`, `input_token_count`, `output_token_count`; these are persisted if returned, otherwise stored as `null` (edge function updates are a small follow-up).

### Embedding-Based Semantic Retrieval (#1) — Shipped

- Migration `20260415000001_add_embedding_vector_retrieval.sql` enables `pgvector` and adds `embedding vector(1536)`, `embedding_model`, `embedded_at` columns plus IVFFlat cosine indexes to all 10 tables (5 `*_learnings` + 5 `*_precedent_bank`). Ships 10 `match_*` RPC functions (one per analyst × {learnings, precedents}) that return top-K rows by cosine similarity, respecting RLS via `SECURITY INVOKER`. Precedent RPCs also support `only_gold_standard` filtering.
- New Supabase edge function `embed-text` calls OpenAI `text-embedding-3-small` (1536 dims), supports single + batch requests, and returns HTTP 501 when `OPENAI_API_KEY` is not configured so callers fall back cleanly.
- Shared client helper `src/lib/analyst/semanticRetrieval.ts` exposes `embedText`, `embedTexts`, `matchLearnings`, `matchPrecedents`, and `embedAndStore`. All functions fail soft: when embeddings are unavailable, they return `null`/empty and the caller reverts to the previous all-active behaviour.
- All 5 learnings hooks (`usePPALearnings`, `useTollingLearnings`, `useCarbonLearnings`, `useITSupplyLearnings`, `useCloudComputeLearnings`) now fire-and-forget embed on `createLearning` and expose `getRelevantLearnings(queryText, k)`. `formatLearningsForPrompt` accepts an optional override list so callers can format only the retrieved top-K.
- All 5 precedent-bank hooks (inside `useXxxAnalyses.ts`) embed on `bankPositions` and expose `getRelevantPrecedents(queryText, k, onlyGoldStandard)`.
- All 5 upload components (`PPAUploadAnalysis`, `TollingUploadAnalysis`, `CarbonUploadAnalysis`, `ITSupplyUploadAnalysis`, `CloudComputeUploadAnalysis`) now issue a top-K semantic query against the extracted contract text (first 15k chars) in parallel for learnings, regular precedents, and gold-standard precedents, and pass only those to the LLM. The applied-IDs audit trail (#2) automatically captures the narrower set.
- Backfill path for pre-existing learnings/precedents: rows with `embedding IS NULL` are simply excluded from `match_*` RPC results, so until re-embedded they contribute nothing to semantic retrieval but the all-active fallback still covers them when OpenAI isn't configured. A follow-up script can backfill by streaming rows through `embed-text` and updating the row.

### Atomic Analysis + Positions Inserts (#4) — Shipped

- Migration `20260416000001_add_analyst_transactional_inserts.sql` adds 5 `SECURITY INVOKER` PL/pgSQL RPC functions (`create_{ppa,tolling,carbon,it_supply,cloud_compute}_analysis_with_positions`). Each function accepts `analysis_data jsonb` + `positions_data jsonb`, force-sets `user_id := auth.uid()` on every row (prevents impersonation), uses `jsonb_populate_record(set)` so new columns Just Work without function changes, and runs the analysis INSERT + positions INSERT inside a single implicit transaction. If either INSERT fails, the whole operation rolls back — no orphan analysis rows without positions, no orphan positions without an analysis.
- All 5 `useXxxAnalyses` hooks expose `createAnalysisWithPositions` which calls the RPC and invalidates both the analyses and positions query keys. The legacy `createAnalysis` / `createPositions` mutations are retained for backwards compatibility.
- All 5 upload components (`PPAUploadAnalysis`, `TollingUploadAnalysis`, `CarbonUploadAnalysis`, `ITSupplyUploadAnalysis`, `CloudComputeUploadAnalysis`) plus `PPACompareUpload` now issue a single transactional call instead of the previous 2-step `createAnalysis → createPositions` pattern. RLS is still enforced because `SECURITY INVOKER` means the function runs with the caller's role.

## Remaining Recommendations

- **Rotate Supabase credentials** — The anon key was previously committed to git history. Rotate in Supabase dashboard.
- **Content Security Policy** — Add CSP headers via hosting config to further mitigate XSS risk.
- **Multi-step mutations** — Consider moving `markAsAgreed` (usePricingProposals) and `revertMasterUpdate` (useMasterWipUpdates) to Supabase Edge Functions with PostgreSQL transactions for true atomicity.
- **Populate audit fields** — The `created_by`/`updated_by` columns exist but need to be populated in the mutation hooks.

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
- After each task step, commit progress to GitHub before moving to the next step

## Important Notes

- This app handles attorney-client privileged data. Security fixes take priority over features.
- The Supabase types file (`types.ts`) is auto-generated by Lovable/Supabase. Schema changes should be done via migrations.
- Admin-only routes use `AdminRoute` wrapper; regular auth uses `ProtectedRoute`.
- The migration `20260319000001_add_missing_fk_constraints_and_audit_fields.sql` must be applied to the database before the audit fields and FK constraints take effect.
