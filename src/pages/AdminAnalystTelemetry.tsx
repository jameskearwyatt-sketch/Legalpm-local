/**
 * Admin-only page: Analyst Telemetry Dashboard
 *
 * Aggregates `analyst_llm_call_log` — the append-only log of every LLM
 * invocation from the 5 analyst upload flows (and embed-text / feedback /
 * compare-drafts sub-flows). Unlike the per-analysis telemetry persisted
 * on *_analyses rows, this log captures FAILURES too, so the error-type
 * breakdown here is the only place to see things like "how often does
 * Gemini return a parse-error on Tolling?" or "what's the p95 latency on
 * Cloud Compute's analyze call?".
 *
 * All aggregates are computed client-side from a rolling window (default
 * 7 days, togglable to 30). The table has an admin-only read policy, so
 * a non-admin hitting this page would see an empty list.
 */
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Loader2, RefreshCw, AlertCircle, CheckCircle2, TrendingUp, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface LlmLogRow {
  id: string;
  user_id: string;
  analyst_type: string;
  function_name: string;
  analysis_id: string | null;
  status: 'success' | 'failure' | 'partial';
  error_type: string | null;
  error_message: string | null;
  input_chars: number | null;
  input_token_count: number | null;
  output_token_count: number | null;
  model_used: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type WindowDays = 1 | 7 | 30;

const ANALYST_LABELS: Record<string, string> = {
  ppa: 'PPA',
  tolling: 'Tolling',
  carbon: 'Carbon',
  it_supply: 'IT Supply',
  cloud_compute: 'Cloud Compute',
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function AdminAnalystTelemetry() {
  const [rows, setRows] = useState<LlmLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [windowDays, setWindowDays] = useState<WindowDays>(7);

  const load = async () => {
    setIsLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    const { data, error } = await supabase
      .from('analyst_llm_call_log' as never)
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(10000);
    if (error) {
      console.error('load telemetry failed', error);
      setRows([]);
    } else {
      setRows((data as unknown as LlmLogRow[]) || []);
    }
    setIsLoading(false);
  };

  useEffect(() => { void load(); }, [windowDays]);

  const stats = useMemo(() => {
    const total = rows.length;
    const successes = rows.filter(r => r.status === 'success').length;
    const failures = rows.filter(r => r.status === 'failure').length;
    const partial = rows.filter(r => r.status === 'partial').length;
    const successRate = total > 0 ? (successes / total) * 100 : 0;

    const durations = rows.map(r => r.duration_ms).filter((v): v is number => typeof v === 'number');
    const p50 = percentile(durations, 0.5);
    const p95 = percentile(durations, 0.95);

    const inputTokens = rows.reduce((s, r) => s + (r.input_token_count || 0), 0);
    const outputTokens = rows.reduce((s, r) => s + (r.output_token_count || 0), 0);

    // Per-analyst breakdown
    const perAnalyst = new Map<string, { total: number; success: number; failure: number; durations: number[]; inputTokens: number; outputTokens: number }>();
    for (const r of rows) {
      const key = r.analyst_type;
      if (!perAnalyst.has(key)) {
        perAnalyst.set(key, { total: 0, success: 0, failure: 0, durations: [], inputTokens: 0, outputTokens: 0 });
      }
      const bucket = perAnalyst.get(key)!;
      bucket.total += 1;
      if (r.status === 'success') bucket.success += 1;
      if (r.status === 'failure') bucket.failure += 1;
      if (typeof r.duration_ms === 'number') bucket.durations.push(r.duration_ms);
      bucket.inputTokens += r.input_token_count || 0;
      bucket.outputTokens += r.output_token_count || 0;
    }

    // Error type breakdown
    const errorTypes = new Map<string, number>();
    for (const r of rows) {
      if (r.status === 'failure' && r.error_type) {
        errorTypes.set(r.error_type, (errorTypes.get(r.error_type) || 0) + 1);
      }
    }

    // Model distribution
    const models = new Map<string, number>();
    for (const r of rows) {
      if (r.model_used) {
        models.set(r.model_used, (models.get(r.model_used) || 0) + 1);
      }
    }

    // Function distribution
    const functions = new Map<string, number>();
    for (const r of rows) {
      functions.set(r.function_name, (functions.get(r.function_name) || 0) + 1);
    }

    return {
      total,
      successes,
      failures,
      partial,
      successRate,
      p50,
      p95,
      inputTokens,
      outputTokens,
      perAnalyst,
      errorTypes,
      models,
      functions,
    };
  }, [rows]);

  const recentFailures = useMemo(
    () => rows.filter(r => r.status === 'failure').slice(0, 20),
    [rows],
  );

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="h-6 w-6" /> Analyst Telemetry
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Aggregated from <code>analyst_llm_call_log</code>. Includes failures, so this is the
              only place to see things like parse-error rates or p95 latency by analyst.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={windowDays === 1 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setWindowDays(1)}
            >
              24h
            </Button>
            <Button
              variant={windowDays === 7 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setWindowDays(7)}
            >
              7d
            </Button>
            <Button
              variant={windowDays === 30 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setWindowDays(30)}
            >
              30d
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {isLoading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                  <p className="text-2xl font-semibold">{formatNumber(stats.total)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Success Rate
                  </p>
                  <p className="text-2xl font-semibold">
                    {stats.successRate.toFixed(1)}<span className="text-base">%</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.successes} ok · {stats.failures} failed
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> p50 Latency
                  </p>
                  <p className="text-2xl font-semibold">{formatMs(stats.p50)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> p95 Latency
                  </p>
                  <p className="text-2xl font-semibold">{formatMs(stats.p95)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Tokens
                  </p>
                  <p className="text-2xl font-semibold">
                    {formatNumber(stats.inputTokens + stats.outputTokens)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(stats.inputTokens)} in · {formatNumber(stats.outputTokens)} out
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="per-analyst">
              <TabsList>
                <TabsTrigger value="per-analyst">Per Analyst</TabsTrigger>
                <TabsTrigger value="errors">Error Breakdown</TabsTrigger>
                <TabsTrigger value="models">Models & Functions</TabsTrigger>
                <TabsTrigger value="recent-failures">Recent Failures</TabsTrigger>
              </TabsList>

              <TabsContent value="per-analyst">
                <Card>
                  <CardHeader>
                    <CardTitle>Success rate + latency by analyst</CardTitle>
                    <CardDescription>p50/p95 latency on actually-completed calls; failed calls are counted but their duration-to-error isn't always meaningful.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-6 gap-2 text-xs font-medium text-muted-foreground px-2 py-1 border-b">
                        <span>Analyst</span>
                        <span className="text-right">Total</span>
                        <span className="text-right">Success</span>
                        <span className="text-right">p50</span>
                        <span className="text-right">p95</span>
                        <span className="text-right">Tokens</span>
                      </div>
                      {Array.from(stats.perAnalyst.entries()).sort((a, b) => b[1].total - a[1].total).map(([analyst, b]) => {
                        const rate = b.total > 0 ? (b.success / b.total) * 100 : 0;
                        return (
                          <div key={analyst} className="grid grid-cols-6 gap-2 text-sm px-2 py-1.5 hover:bg-muted/50 rounded">
                            <span className="font-medium">{ANALYST_LABELS[analyst] || analyst}</span>
                            <span className="text-right">{formatNumber(b.total)}</span>
                            <span className="text-right">
                              <Badge variant={rate >= 95 ? 'default' : rate >= 80 ? 'secondary' : 'destructive'} className="text-xs">
                                {rate.toFixed(1)}%
                              </Badge>
                            </span>
                            <span className="text-right text-muted-foreground">{formatMs(percentile(b.durations, 0.5))}</span>
                            <span className="text-right text-muted-foreground">{formatMs(percentile(b.durations, 0.95))}</span>
                            <span className="text-right text-muted-foreground">{formatNumber(b.inputTokens + b.outputTokens)}</span>
                          </div>
                        );
                      })}
                      {stats.perAnalyst.size === 0 && (
                        <p className="text-sm text-muted-foreground py-6 text-center">No analyst calls in this window.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="errors">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" /> Error type distribution
                    </CardTitle>
                    <CardDescription>Out of {stats.failures} failures in this window.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Array.from(stats.errorTypes.entries()).sort((a, b) => b[1] - a[1]).map(([et, count]) => {
                        const pct = stats.failures > 0 ? (count / stats.failures) * 100 : 0;
                        return (
                          <div key={et} className="flex items-center gap-3">
                            <span className="text-sm font-medium w-32">{et}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-destructive/70" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-sm text-muted-foreground w-20 text-right">
                              {count} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        );
                      })}
                      {stats.errorTypes.size === 0 && (
                        <p className="text-sm text-muted-foreground py-6 text-center">No failures in this window.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="models">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Model distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {Array.from(stats.models.entries()).sort((a, b) => b[1] - a[1]).map(([m, count]) => (
                        <div key={m} className="flex items-center justify-between text-sm py-0.5">
                          <span className="font-mono text-xs">{m}</span>
                          <Badge variant="outline" className="text-xs">{count}</Badge>
                        </div>
                      ))}
                      {stats.models.size === 0 && (
                        <p className="text-sm text-muted-foreground py-2 text-center">No model data captured.</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Function call counts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {Array.from(stats.functions.entries()).sort((a, b) => b[1] - a[1]).map(([fn, count]) => (
                        <div key={fn} className="flex items-center justify-between text-sm py-0.5">
                          <span className="font-mono text-xs">{fn}</span>
                          <Badge variant="outline" className="text-xs">{count}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="recent-failures">
                <Card>
                  <CardHeader>
                    <CardTitle>Most recent failures</CardTitle>
                    <CardDescription>Top 20 by recency. Error message is truncated to 500 chars at write time.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recentFailures.map(r => (
                        <div key={r.id} className="p-2 border rounded text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="destructive" className="text-xs">{r.error_type || 'unknown'}</Badge>
                              <Badge variant="outline" className="text-xs">{ANALYST_LABELS[r.analyst_type] || r.analyst_type}</Badge>
                              <span className="font-mono text-[10px] text-muted-foreground">{r.function_name}</span>
                            </div>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          {r.error_message && (
                            <p className="text-muted-foreground font-mono text-[11px] break-words">
                              {r.error_message}
                            </p>
                          )}
                        </div>
                      ))}
                      {recentFailures.length === 0 && (
                        <p className="text-sm text-muted-foreground py-6 text-center">No failures in this window.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}
