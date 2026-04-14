/**
 * Admin-only page: Analyst Embedding Backfill
 *
 * Walks through all 10 analyst embedding-bearing tables (5 learnings + 5
 * precedent banks) and embeds rows that still have `embedding IS NULL`.
 * Pre-existing rows from before the pgvector migration
 * (20260415000001) contribute nothing to semantic retrieval until they
 * are backfilled — this page is how they get picked up.
 *
 * Access: wrapped in AdminRoute (admin role required). RLS still applies
 * per SELECT/UPDATE, so the admin needs policies allowing read+update
 * across all users' rows. Those policies were added by the RBAC migration
 * that introduced `has_role('admin')`.
 */
import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Play, Square, Database, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  BACKFILL_TARGETS,
  countMissingEmbeddings,
  backfillOne,
  type BackfillProgress,
  type BackfillResult,
  type BackfillTarget,
} from '@/lib/analyst/embeddingBackfill';

export default function AdminAnalystBackfill() {
  const [missingCounts, setMissingCounts] = useState<Record<string, number> | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTable, setCurrentTable] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, BackfillProgress>>({});
  const [results, setResults] = useState<BackfillResult[]>([]);
  const [abortFlag, setAbortFlag] = useState(false);
  const [abortReason, setAbortReason] = useState<string | null>(null);

  const loadCounts = async () => {
    setIsCounting(true);
    try {
      const counts = await countMissingEmbeddings();
      setMissingCounts(counts);
    } catch (err) {
      console.error('count missing embeddings failed', err);
      toast.error('Failed to count rows needing backfill');
    } finally {
      setIsCounting(false);
    }
  };

  useEffect(() => { void loadCounts(); }, []);

  const totalMissing = missingCounts
    ? Object.values(missingCounts).reduce((s, n) => s + n, 0)
    : 0;

  const handleRunAll = async () => {
    if (!missingCounts) return;
    setAbortFlag(false);
    setAbortReason(null);
    setResults([]);
    setProgress({});
    setIsRunning(true);
    const targetsToRun = BACKFILL_TARGETS.filter(t => (missingCounts[t.table] ?? 0) > 0);
    const allResults: BackfillResult[] = [];
    for (const target of targetsToRun) {
      if (abortFlag) break;
      setCurrentTable(target.table);
      const result = await backfillOne(
        target,
        p => setProgress(prev => ({ ...prev, [target.table]: p })),
        () => abortFlag,
      );
      allResults.push(result);
      setResults(prev => [...prev, result]);
      if (result.aborted && result.abortReason?.includes('unavailable')) {
        setAbortReason(result.abortReason);
        toast.error(result.abortReason);
        break;
      }
    }
    setCurrentTable(null);
    setIsRunning(false);
    await loadCounts();
    if (!abortFlag && allResults.every(r => !r.aborted)) {
      toast.success('Embedding backfill complete');
    }
  };

  const handleRunOne = async (target: BackfillTarget) => {
    setAbortFlag(false);
    setAbortReason(null);
    setResults([]);
    setProgress({});
    setIsRunning(true);
    setCurrentTable(target.table);
    const result = await backfillOne(
      target,
      p => setProgress(prev => ({ ...prev, [target.table]: p })),
      () => abortFlag,
    );
    setResults([result]);
    setCurrentTable(null);
    setIsRunning(false);
    if (result.aborted && result.abortReason) {
      setAbortReason(result.abortReason);
      toast.error(result.abortReason);
    } else {
      toast.success(`${target.label}: ${result.succeeded} embedded, ${result.failed} failed, ${result.skipped} skipped`);
    }
    await loadCounts();
  };

  return (
    <AppLayout>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Database className="h-6 w-6" /> Analyst Embedding Backfill
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Embed pre-existing learnings and precedent-bank rows so they're picked up by semantic
            retrieval (the top-K `match_*` RPCs). Rows created after the pgvector migration embed
            automatically; this page handles the backlog.
          </p>
        </div>

        {abortReason && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Backfill aborted</AlertTitle>
            <AlertDescription>{abortReason}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Backlog Summary</CardTitle>
                <CardDescription>
                  {isCounting ? 'Counting...' : `${totalMissing.toLocaleString()} rows missing embeddings across 10 tables.`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void loadCounts()} disabled={isCounting || isRunning}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${isCounting ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                {isRunning ? (
                  <Button variant="destructive" size="sm" onClick={() => setAbortFlag(true)}>
                    <Square className="h-4 w-4 mr-1" />
                    Stop
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleRunAll} disabled={totalMissing === 0 || !missingCounts}>
                    <Play className="h-4 w-4 mr-1" />
                    Run All ({totalMissing.toLocaleString()})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {BACKFILL_TARGETS.map(target => {
              const missing = missingCounts?.[target.table] ?? 0;
              const prog = progress[target.table];
              const result = results.find(r => r.table === target.table);
              const isActive = currentTable === target.table;
              return (
                <div key={target.table} className="p-3 border rounded-md space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={target.kind === 'learning' ? 'default' : 'secondary'} className="text-xs">
                        {target.kind}
                      </Badge>
                      <span className="font-medium text-sm">{target.label}</span>
                      {isActive && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </div>
                    <div className="flex items-center gap-2">
                      {result && !result.aborted && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {result.succeeded} embedded
                        </Badge>
                      )}
                      {missing > 0 ? (
                        <Badge variant="outline" className="text-xs">{missing.toLocaleString()} pending</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-primary border-primary/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Up to date
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isRunning || missing === 0}
                        onClick={() => void handleRunOne(target)}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {prog && prog.total > 0 && (
                    <div className="space-y-1">
                      <Progress value={(prog.processed / prog.total) * 100} className="h-1.5" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{prog.processed} / {prog.total}</span>
                        <span>
                          {prog.succeeded} embedded
                          {prog.failed > 0 && ` · ${prog.failed} failed`}
                          {prog.skipped > 0 && ` · ${prog.skipped} skipped`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="pt-4 text-xs text-muted-foreground space-y-1">
            <p>
              <span className="font-medium text-foreground">How it works.</span> For each row with
              `embedding IS NULL`, the composed text (category + original/corrected position +
              feedback for learnings; category + project + summary for precedents) is sent to the
              `embed-text` edge function which calls OpenAI `text-embedding-3-small`. The resulting
              1536-dim vector is written back with `embedding_model` and `embedded_at`.
            </p>
            <p>
              <span className="font-medium text-foreground">Rate + cost.</span> Batches of 10 rows
              are embedded in a single OpenAI call. At ~$0.02 per 1M input tokens this is cheap —
              1000 rows is typically well under $1. The bottleneck is the gateway round trip, not
              token spend.
            </p>
            <p>
              <span className="font-medium text-foreground">If it aborts.</span> The most common
              failure is `embed-text unavailable` which means `OPENAI_API_KEY` isn't configured on
              the edge function. Set the secret in Supabase and re-run.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
