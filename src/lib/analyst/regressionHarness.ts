/**
 * Golden-set regression harness for analyst outputs (Upgrade #5 phase 2).
 *
 * The harness lets a user seed "known-good" contract snippets with expected
 * positions and then replay them whenever learnings or banked precedents
 * change. Drift shows up as a drop in match-rate over time.
 *
 * Scoping decisions:
 *   - Scoring is client-side so the harness doesn't need to know each
 *     analyst's schema. The DB just stores cases and results.
 *   - The contract snippet is sent to the normal analyze-* edge function so
 *     we're testing the full production path (retrieval + prompt + LLM +
 *     parsing) and not some mocked pipeline.
 *   - A regression run persists one row per case in `analyst_regression_runs`,
 *     grouped by a shared `run_id`. Append-only — no UPDATE/DELETE policy.
 *   - All runs issue through the user's session, so RLS still filters which
 *     learnings/precedents get retrieved. Cross-user golden sets aren't
 *     supported in this phase.
 */
import { supabase } from '@/integrations/supabase/client';
import type { AnalystType } from './semanticRetrieval';

const ANALYZE_ENDPOINT: Record<AnalystType, string> = {
  ppa: 'analyze-ppa',
  tolling: 'analyze-tolling',
  carbon: 'analyze-carbon-credit',
  it_supply: 'analyze-it-supply',
  cloud_compute: 'analyze-cloud-compute',
};

// Each analyst's edge function reads the contract text from a differently-named
// key on the POST body. We normalise that here so callers just pass one
// `contractText` and we map it into the right slot.
const CONTRACT_TEXT_KEY: Record<AnalystType, string> = {
  ppa: 'ppaText',
  tolling: 'tollingText',
  carbon: 'documentText',
  it_supply: 'contractText',
  cloud_compute: 'contractText',
};

export interface ExpectedPosition {
  /** Expected category string. Matched case-insensitively with contains semantics. */
  category: string;
  /** Case-insensitive substring the actual position_summary must contain. */
  summary_contains?: string;
  /** Alternative: regex pattern (JS syntax) the actual position_summary must match. */
  summary_regex?: string;
  /** Optional: the actual confidence must equal this. */
  confidence?: 'high' | 'medium' | 'review_required';
  /** Optional: the actual variance_notes must contain [<ON MARKET|OFF MARKET|WAY OFF MARKET>]. */
  market_position?: 'on_market' | 'off_market' | 'way_off_market';
  /** Optional: human label for easy reading in the UI. */
  label?: string;
}

export interface RegressionCase {
  id: string;
  user_id: string;
  analyst_type: AnalystType;
  name: string;
  description: string | null;
  contract_snippet: string;
  expected_positions: ExpectedPosition[];
  analysis_config: Record<string, unknown>;
  source_analysis_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActualPositionShape {
  category?: string;
  position_summary?: string;
  confidence?: string;
  variance_notes?: string | null;
  market_position?: string | null;
  // Edge-function shapes vary — we keep index access flexible.
  [k: string]: unknown;
}

export type RegressionCaseStatus = 'passed' | 'failed' | 'partial' | 'error';

export interface RegressionScoreResult {
  status: RegressionCaseStatus;
  matchCount: number;
  totalExpected: number;
  missedExpectations: ExpectedPosition[];
  unexpectedPositions: ActualPositionShape[];
}

export interface RegressionRunRow {
  id: string;
  run_id: string;
  case_id: string;
  analyst_type: AnalystType;
  status: RegressionCaseStatus;
  match_count: number;
  total_expected: number;
  missed_expectations: ExpectedPosition[] | null;
  unexpected_positions: ActualPositionShape[] | null;
  duration_ms: number | null;
  error_message: string | null;
  model_used: string | null;
  created_at: string;
}

// ---------- Scoring ----------------------------------------------------------

function normalise(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase();
}

function marketPositionFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/\[(ON MARKET|OFF MARKET|WAY OFF MARKET)\]/i);
  if (!m) return null;
  return m[1].toLowerCase().replace(/ /g, '_');
}

function expectationMatchesPosition(exp: ExpectedPosition, act: ActualPositionShape): boolean {
  // Category: case-insensitive contains in either direction so "Termination"
  // and "Term and Termination" match.
  const aCat = normalise(act.category as string | undefined);
  const eCat = normalise(exp.category);
  if (!aCat || !eCat) return false;
  if (!(aCat.includes(eCat) || eCat.includes(aCat))) return false;

  const summary = (act.position_summary as string | undefined) || '';
  if (exp.summary_contains) {
    if (!normalise(summary).includes(normalise(exp.summary_contains))) return false;
  }
  if (exp.summary_regex) {
    try {
      const re = new RegExp(exp.summary_regex, 'i');
      if (!re.test(summary)) return false;
    } catch {
      // Malformed regex: treat as non-matching. The case author should fix it.
      return false;
    }
  }
  if (exp.confidence && act.confidence !== exp.confidence) return false;
  if (exp.market_position) {
    const mp = (act.market_position as string | null | undefined)
      || marketPositionFromNotes(act.variance_notes as string | null | undefined);
    if (mp !== exp.market_position) return false;
  }
  return true;
}

/**
 * Score an actual set of positions against a case's expectations. Each
 * expectation must be satisfied by at least one actual position. Actual
 * positions with no matching expectation are returned as "unexpected"
 * (informational — they don't fail the case, because golden-set cases
 * typically cover a subset of categories).
 */
export function scoreRegression(
  expected: ExpectedPosition[],
  actual: ActualPositionShape[]
): RegressionScoreResult {
  const matched = new Set<number>(); // indices of actual positions we matched
  const missed: ExpectedPosition[] = [];
  let matchCount = 0;
  for (const exp of expected) {
    let hit = false;
    for (let i = 0; i < actual.length; i++) {
      if (expectationMatchesPosition(exp, actual[i])) {
        matched.add(i);
        hit = true;
        break;
      }
    }
    if (hit) matchCount += 1;
    else missed.push(exp);
  }
  const unexpected = actual.filter((_, i) => !matched.has(i));
  const totalExpected = expected.length;
  let status: RegressionCaseStatus;
  if (totalExpected === 0) status = 'passed'; // a case with no expectations is trivially passing
  else if (matchCount === totalExpected) status = 'passed';
  else if (matchCount === 0) status = 'failed';
  else status = 'partial';
  return { status, matchCount, totalExpected, missedExpectations: missed, unexpectedPositions: unexpected };
}

// ---------- DB helpers -------------------------------------------------------

export async function listRegressionCases(analyst: AnalystType): Promise<RegressionCase[]> {
  const { data, error } = await supabase
    .from('analyst_regression_cases' as never)
    .select('*')
    .eq('analyst_type', analyst)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('listRegressionCases failed:', error);
    return [];
  }
  return (data as unknown as RegressionCase[]) || [];
}

export async function createRegressionCase(args: {
  analyst: AnalystType;
  name: string;
  description?: string;
  contractSnippet: string;
  expectedPositions: ExpectedPosition[];
  analysisConfig: Record<string, unknown>;
  sourceAnalysisId?: string;
}): Promise<RegressionCase | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from('analyst_regression_cases' as never)
    .insert({
      user_id: userId,
      analyst_type: args.analyst,
      name: args.name,
      description: args.description ?? null,
      contract_snippet: args.contractSnippet,
      expected_positions: args.expectedPositions,
      analysis_config: args.analysisConfig,
      source_analysis_id: args.sourceAnalysisId ?? null,
      is_active: true,
    } as never)
    .select()
    .single();
  if (error) {
    console.warn('createRegressionCase failed:', error);
    return null;
  }
  return data as unknown as RegressionCase;
}

export async function updateRegressionCase(
  id: string,
  patch: Partial<Pick<RegressionCase, 'name' | 'description' | 'is_active' | 'expected_positions' | 'analysis_config' | 'contract_snippet'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('analyst_regression_cases' as never)
    .update(patch as never)
    .eq('id', id);
  if (error) {
    console.warn('updateRegressionCase failed:', error);
    return false;
  }
  return true;
}

export async function deleteRegressionCase(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('analyst_regression_cases' as never)
    .delete()
    .eq('id', id);
  if (error) {
    console.warn('deleteRegressionCase failed:', error);
    return false;
  }
  return true;
}

export async function listRegressionRuns(caseId: string, limit = 20): Promise<RegressionRunRow[]> {
  const { data, error } = await supabase
    .from('analyst_regression_runs' as never)
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as unknown as RegressionRunRow[]) || [];
}

// ---------- Running the harness ---------------------------------------------

/** Invoke the analyze-* edge function for one case and return the positions. */
async function runCaseAgainstAnalyzer(
  kase: RegressionCase
): Promise<{ positions: ActualPositionShape[]; durationMs: number; modelUsed: string | null; error?: string }> {
  const started = Date.now();
  try {
    const { data: sd } = await supabase.auth.getSession();
    const token = sd?.session?.access_token;
    const endpoint = ANALYZE_ENDPOINT[kase.analyst_type];
    const textKey = CONTRACT_TEXT_KEY[kase.analyst_type];
    const body: Record<string, unknown> = {
      [textKey]: kase.contract_snippet,
      ...kase.analysis_config,
    };
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 600_000);
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(tid);
    const durationMs = Date.now() - started;
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.error) msg = String(j.error).slice(0, 500); } catch { /* ignore */ }
      return { positions: [], durationMs, modelUsed: null, error: msg };
    }
    const json = await res.json();
    const positions = Array.isArray(json?.positions) ? (json.positions as ActualPositionShape[]) : [];
    return { positions, durationMs, modelUsed: (json?.model_used as string | undefined) ?? null };
  } catch (err) {
    return {
      positions: [],
      durationMs: Date.now() - started,
      modelUsed: null,
      error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    };
  }
}

export interface CaseRunResult extends RegressionScoreResult {
  caseId: string;
  durationMs: number;
  modelUsed: string | null;
  error?: string;
}

/**
 * Run all active cases for one analyst. Each case's result is scored and
 * persisted to `analyst_regression_runs` under a single shared `run_id`.
 * Returns the in-memory results so the UI can render them immediately.
 *
 * The cases are run sequentially — parallelism would hammer the LLM
 * gateway and cost more in a pattern users rarely need (golden sets should
 * be small, focused).
 */
export async function runRegressionSuite(args: {
  analyst: AnalystType;
  cases?: RegressionCase[]; // pre-filtered list; if omitted we load active cases
  onProgress?: (idx: number, total: number, result: CaseRunResult) => void;
}): Promise<{ runId: string; results: CaseRunResult[] }> {
  const cases = args.cases ?? (await listRegressionCases(args.analyst)).filter(c => c.is_active);
  const { data: sd } = await supabase.auth.getSession();
  const userId = sd?.session?.user?.id;
  const runId = crypto.randomUUID();
  const results: CaseRunResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const kase = cases[i];
    const { positions, durationMs, modelUsed, error } = await runCaseAgainstAnalyzer(kase);
    let score: RegressionScoreResult;
    let status: RegressionCaseStatus;
    if (error) {
      score = {
        status: 'error',
        matchCount: 0,
        totalExpected: kase.expected_positions.length,
        missedExpectations: kase.expected_positions,
        unexpectedPositions: [],
      };
      status = 'error';
    } else {
      score = scoreRegression(kase.expected_positions, positions);
      status = score.status;
    }
    const result: CaseRunResult = {
      caseId: kase.id,
      durationMs,
      modelUsed,
      error,
      ...score,
    };
    results.push(result);
    args.onProgress?.(i, cases.length, result);

    if (userId) {
      try {
        await supabase.from('analyst_regression_runs' as never).insert({
          user_id: userId,
          run_id: runId,
          case_id: kase.id,
          analyst_type: kase.analyst_type,
          status,
          match_count: score.matchCount,
          total_expected: score.totalExpected,
          missed_expectations: score.missedExpectations as never,
          unexpected_positions: score.unexpectedPositions as never,
          duration_ms: durationMs,
          error_message: error ?? null,
          model_used: modelUsed,
        } as never);
      } catch (err) {
        console.warn('failed to persist regression run row:', err);
      }
    }
  }

  return { runId, results };
}

/**
 * Seed a case from an existing analysis by pulling its positions and turning
 * each one into an expectation of `category + summary_contains:(first 50 chars
 * of the summary) + confidence + market_position`. Returns the populated
 * expected-positions array; the caller can edit before saving.
 */
export function seedExpectationsFromPositions(positions: ActualPositionShape[]): ExpectedPosition[] {
  return positions.map(p => {
    const summary = (p.position_summary as string | undefined) || '';
    const firstWords = summary.split(/\s+/).slice(0, 8).join(' ').trim();
    const mp = marketPositionFromNotes(p.variance_notes as string | null | undefined);
    return {
      category: (p.category as string | undefined) || '',
      summary_contains: firstWords || undefined,
      confidence: (p.confidence as ExpectedPosition['confidence']) || undefined,
      market_position: (mp as ExpectedPosition['market_position'] | null) ?? undefined,
    } as ExpectedPosition;
  });
}
