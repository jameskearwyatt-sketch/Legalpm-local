/**
 * Fire-and-forget LLM call logging for observability.
 *
 * Writes an append-only row to the `analyst_llm_call_log` table every time
 * we invoke an LLM-backed edge function (analyze-*-contract, embed-text,
 * process-*-feedback, compare-*-drafts). This captures failures too — the
 * `*_analyses` tables cannot record failed runs because no analysis row is
 * created when the call fails.
 *
 * IMPORTANT: only metadata is logged, never prompt or response content.
 * Attorney-client privilege must be preserved. The `input_chars` field
 * records payload size, not text.
 *
 * All functions are fire-and-forget: logging failures never bubble up.
 */
import { supabase } from '@/integrations/supabase/client';
import type { AnalystType } from './semanticRetrieval';

export type LlmCallStatus = 'success' | 'failure' | 'partial';
export type LlmCallErrorType =
  | 'timeout'
  | 'auth'
  | 'server_error'
  | 'parse_error'
  | 'network'
  | 'rate_limit'
  | 'not_configured'
  | 'unknown';

export interface LlmCallLogEntry {
  analystType: AnalystType;
  functionName: string;
  analysisId?: string | null;
  status: LlmCallStatus;
  errorType?: LlmCallErrorType;
  errorMessage?: string;
  inputChars?: number;
  inputTokenCount?: number | null;
  outputTokenCount?: number | null;
  modelUsed?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}

export async function logLlmCall(entry: LlmCallLogEntry): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return; // anonymous calls aren't logged
    await supabase.from('analyst_llm_call_log' as never).insert({
      user_id: userId,
      analyst_type: entry.analystType,
      function_name: entry.functionName,
      analysis_id: entry.analysisId ?? null,
      status: entry.status,
      error_type: entry.errorType ?? null,
      error_message: entry.errorMessage ?? null,
      input_chars: entry.inputChars ?? null,
      input_token_count: entry.inputTokenCount ?? null,
      output_token_count: entry.outputTokenCount ?? null,
      model_used: entry.modelUsed ?? null,
      duration_ms: entry.durationMs ?? null,
      metadata: entry.metadata ? (entry.metadata as never) : null,
    } as never);
  } catch (err) {
    // Never surface logging failures
    console.warn('logLlmCall failed:', err);
  }
}

/**
 * Classify an error into one of the predefined error_type values. Best
 * effort; defaults to 'unknown'.
 */
export function classifyLlmError(err: unknown): LlmCallErrorType {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  if (!msg) return 'unknown';
  if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
  if (msg.includes('401') || msg.includes('403') || msg.includes('unauth')) return 'auth';
  if (msg.includes('429') || msg.includes('rate limit')) return 'rate_limit';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnreset')) return 'network';
  if (msg.includes('parse') || msg.includes('json')) return 'parse_error';
  if (msg.includes('not configured') || msg.includes('501')) return 'not_configured';
  if (msg.includes('500') || msg.includes('server')) return 'server_error';
  return 'unknown';
}
