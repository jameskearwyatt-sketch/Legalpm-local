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
| 5 | Learning quality controls (conflict detection, golden-set regression) | **Done** (Apr 2026) — conflict detection + regression harness |
| 6 | Structured output (JSON schema / tool use) | Pending |
| 7 | Observability & telemetry | **Done** (Apr 2026) |
| 8 | Cross-analyst reuse / shared component refactor | Pending |
| 9 | PII redaction + LLM call audit log | **Done** (Apr 2026) |
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

### Learning Conflict Detection (#5, phase 1) — Shipped

- Migration `20260417000001_add_learning_conflict_detection.sql` adds 5 `find_similar_{ppa,tolling,carbon,it_supply,cloud_compute}_learnings` RPC functions. Each accepts a query embedding + a required `filter_category` parameter + a similarity threshold (default 0.55, deliberately stricter than the 0.30 used for prompt-context retrieval) and returns the top-K existing learnings in that category with their cosine similarity scores. `SECURITY INVOKER` preserves RLS.
- `src/lib/analyst/semanticRetrieval.ts` exposes `findSimilarLearnings(analyst, category, text, k?, threshold?)` returning `SimilarLearning[] | null`; null signals the embedding backend is unavailable so callers can silently skip the warning UI.
- Shared UI `src/components/shared/LearningConflictWarning.tsx` is an inline amber banner that debounces (600ms) a similarity search while the user types a new correction, and shows up to 5 existing learnings in the same category with their similarity percentage, active/inactive state, and age. It's collapsible and fully silent until conflicts pass the threshold.
- All 5 `XxxTeachFeedbackDialog` components (PPA, Tolling, Carbon, IT Supply, Cloud Compute) render the warning below the feedback textarea. The warning does not block submission — the intent is to inform the user so they can choose to merge/override the existing learning manually, rather than silently layering contradictory instructions.
- Next phase (pending): golden-set regression harness — a curated set of contract snippets with expected outputs that can be re-run after learnings change, to detect when a new learning breaks previously-correct behaviour.

### Regression Harness (#5 phase 2) — Shipped

- Migration `20260419000001_add_analyst_regression_harness.sql` adds two tables. `analyst_regression_cases` stores curated golden cases: `name`, `description`, `contract_snippet` (the text the LLM will see), `expected_positions jsonb` (array of `{category, summary_contains?, summary_regex?, confidence?, market_position?}`), `analysis_config jsonb` (per-analyst body params e.g. perspective / project metadata), `source_analysis_id` (optional pointer to the analysis the case was seeded from), `is_active`, and standard audit fields. `analyst_regression_runs` is an append-only log of each case execution grouped by a shared `run_id uuid`, recording `status ∈ {passed, partial, failed, error}`, `match_count`, `total_expected`, `missed_expectations jsonb`, `unexpected_positions jsonb`, `duration_ms`, `error_message`, and `model_used`. Both tables use `SECURITY INVOKER` RLS: owner-or-admin SELECT, owner-only writes on cases, owner-only INSERT on runs (no UPDATE/DELETE — append-only). Partial index `(analyst_type, is_active) WHERE is_active` keeps suite-run listing fast.
- Client helper `src/lib/analyst/regressionHarness.ts` exposes CRUD (`listRegressionCases`, `createRegressionCase`, `updateRegressionCase`, `deleteRegressionCase`), run execution (`runRegressionSuite({ analyst, cases?, onProgress? })` executes sequentially to avoid hammering the LLM gateway, persists each result, groups by a freshly-minted `crypto.randomUUID()` `runId`), case-seeding (`seedExpectationsFromPositions` converts an existing analysis's positions into expectations using the first 8 words of the summary), and history (`listRegressionRuns`). The `ANALYZE_ENDPOINT` + `CONTRACT_TEXT_KEY` maps paper over the fact that each analyst's edge function takes contract text under a differently-named body key (`ppaText`, `tollingText`, `documentText`, `contractText`). Scoring: each expected expectation must match at least one actual position (case-insensitive bidirectional category `includes`, optional `summary_contains` / `summary_regex`, optional `confidence` / `market_position` equality); unexpected actuals are informational only and never fail a case. Status is `passed` if all expectations match, `partial` if ≥1 but not all, `failed` if 0, `error` if the analyze-* call itself threw.
- Shared UI `src/components/shared/AnalystRegressionHarness.tsx` is a self-contained tab surface that takes `{ analyst, analystLabel }`. Header card shows the suite summary and a "Run Suite (N)" button with a progress bar during execution. Each `RegressionCaseCard` renders the latest status badge, match counts, duration, a compact view of missed expectations, an active/inactive switch, a delete button, and a collapsible run-history (last 20 runs). `AddCaseDialog` lets users enter name/description/contract snippet + a dynamic list of expected positions (category, summary_contains, confidence, market_position) and an `analysis_config` JSON textarea pre-filled with sensible per-analyst defaults.
- All 5 analyst pages (`PPAAnalyst`, `TollingAnalyst`, `CarbonCreditAnalyst`, `ITSupplyAnalyst`, `CloudComputeAnalyst`) gained a "Regression" tab that mounts `<AnalystRegressionHarness analyst={...} analystLabel={...} />`. This gives each analyst tool its own isolated golden-set suite that can be run after learnings change to detect regressions before they reach live analyses.

### Observability & Telemetry (#7) — Shipped

- Migration `20260418000001_add_analyst_llm_call_log.sql` adds an append-only `analyst_llm_call_log` table that records every LLM invocation (analyze-contract, embed-text, feedback processing, compare drafts, etc.). Unlike the per-analysis telemetry on the `*_analyses` tables, this log captures FAILURES too — the analyses tables cannot, because no row is created on failure. The table stores only metadata (analyst type, function name, status, error_type, error_message truncated to 500 chars, input_chars, token counts, model, duration_ms, optional metadata jsonb). No prompt or response content is stored so attorney-client privilege is preserved.
- RLS: owners read their own rows; admins read all; only owner can insert. There is no UPDATE/DELETE policy — the log is append-only. Three indexes: `(user_id, created_at DESC)`, `(analyst_type, status, created_at DESC)`, and a partial index on `analysis_id`.
- Client helper `src/lib/analyst/llmCallLog.ts` exposes `logLlmCall(entry)` (fire-and-forget) and `classifyLlmError(err)` which maps any error to one of `timeout | auth | server_error | parse_error | network | rate_limit | not_configured | unknown`.
- All 5 upload components log both the success and failure paths of their analyze-contract call with input size, token counts, duration, model, and a small metadata object (analysis_type, perspective, contract sub-type). Logging never blocks the user flow — failures in the logger are swallowed.
- Future extensions (not in this ship): logging embed-text and feedback calls; an admin dashboard that aggregates this table into success-rate / p95-latency / error-breakdown charts per analyst tool.

### PII Redaction (#9) — Shipped

- Client-side regex helper `src/lib/analyst/piiRedaction.ts` exposes `redactPII(text)` which masks six PII classes with typed placeholders (`[EMAIL_REDACTED]`, `[PHONE_REDACTED]`, `[SSN_REDACTED]`, `[EIN_REDACTED]`, `[IBAN_REDACTED]`, `[CARD_REDACTED]`) and returns per-class counts plus a `totalRedactions` tally. Patterns are deliberately conservative (precision-over-recall): emails require dot-in-domain, phones require a separator between digit groups to avoid eating clause numbers, SSN rejects invalid area codes (000/666/9xx), EIN is 2-7, IBAN is 2 letters + 2 check digits + 11-30 alphanumerics, card runs through a Luhn check before redaction. Phone regex runs last so it can't swallow SSN-like sequences. Party names, addresses, and contract terms are never touched.
- Shared UI `src/components/shared/PIIRedactionToggle.tsx` — opt-in checkbox with ShieldCheck icon, inline explainer and a tooltip listing exactly what is masked and what is not. OFF by default (contract analysis usually benefits from seeing incidental notice emails). Rendered in all 5 upload components immediately above the Start Analysis button (Tolling, IT Supply, Cloud Compute) or next to the existing action button (PPA, Carbon).
- All 5 upload components (`PPAUploadAnalysis`, `TollingUploadAnalysis`, `CarbonUploadAnalysis`, `ITSupplyUploadAnalysis`, `CloudComputeUploadAnalysis`) now apply `redactPII` to the extracted contract text (and comparison text where applicable) BEFORE any of it leaves the browser — including before embedding for top-K retrieval. The redacted text is what's passed to the analyze-* edge function and what's counted into `inputChars`. The original document upload is never modified.
- Redaction counts + total are written into the LLM call log metadata (`pii_redacted`, `pii_redaction_counts`, `pii_total_redactions`) on both success and failure paths, so admins can see how often the toggle is used and what classes of PII are being masked. A toast also surfaces the per-run summary (e.g. "3 emails, 1 phone redacted") to the user.
- No server-side work required — redaction happens entirely client-side. No migration. No new edge function. Fails closed in the sense that if `redactPII` itself throws, the catch block already logs the failure and aborts analysis before any text is sent.

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
