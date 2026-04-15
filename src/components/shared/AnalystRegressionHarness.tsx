import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Beaker, Play, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle, Loader2, ChevronDown, ChevronRight, History, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import type { AnalystType } from '@/lib/analyst/semanticRetrieval';
import {
  listRegressionCases,
  createRegressionCase,
  updateRegressionCase,
  deleteRegressionCase,
  listRegressionRuns,
  runRegressionSuite,
  type RegressionCase,
  type ExpectedPosition,
  type RegressionCaseStatus,
  type RegressionRunRow,
  type CaseRunResult,
} from '@/lib/analyst/regressionHarness';

/**
 * Shared regression harness panel. Mounted in each analyst page via the
 * `analyst` prop. Handles listing / creating / running / viewing the
 * golden-set cases for that analyst.
 */

interface Props {
  analyst: AnalystType;
  analystLabel: string;
}

const STATUS_CONFIG: Record<RegressionCaseStatus, { label: string; icon: typeof CheckCircle2; classes: string }> = {
  passed:  { label: 'Passed',  icon: CheckCircle2, classes: 'bg-primary/10 text-primary border-primary/30' },
  partial: { label: 'Partial', icon: AlertTriangle, classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  failed:  { label: 'Failed',  icon: XCircle,     classes: 'bg-destructive/10 text-destructive border-destructive/30' },
  error:   { label: 'Error',   icon: XCircle,     classes: 'bg-destructive/15 text-destructive border-destructive' },
};

function StatusBadge({ status }: { status: RegressionCaseStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.classes}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

export function AnalystRegressionHarness({ analyst, analystLabel }: Props) {
  const [cases, setCases] = useState<RegressionCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState({ current: 0, total: 0 });
  const [latestResults, setLatestResults] = useState<Record<string, CaseRunResult>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const data = await listRegressionCases(analyst);
    setCases(data);
    setIsLoading(false);
  }, [analyst]);

  useEffect(() => { void reload(); }, [reload]);

  const handleRunAll = async () => {
    const active = cases.filter(c => c.is_active);
    if (active.length === 0) {
      toast.error('No active cases to run');
      return;
    }
    setIsRunning(true);
    setRunProgress({ current: 0, total: active.length });
    setLatestResults({});
    try {
      const { results } = await runRegressionSuite({
        analyst,
        cases: active,
        onProgress: (idx, total, result) => {
          setRunProgress({ current: idx + 1, total });
          setLatestResults(prev => ({ ...prev, [result.caseId]: result }));
        },
      });
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
      const partial = results.filter(r => r.status === 'partial').length;
      if (failed > 0 || partial > 0) {
        toast.warning(`Regression run complete: ${passed} passed, ${partial} partial, ${failed} failed/error`);
      } else {
        toast.success(`All ${passed} cases passed`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Regression run failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleActive = async (c: RegressionCase) => {
    const ok = await updateRegressionCase(c.id, { is_active: !c.is_active });
    if (ok) {
      setCases(prev => prev.map(x => (x.id === c.id ? { ...x, is_active: !x.is_active } : x)));
    } else {
      toast.error('Failed to toggle case');
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    const ok = await deleteRegressionCase(deleteTargetId);
    if (ok) {
      setCases(prev => prev.filter(c => c.id !== deleteTargetId));
      toast.success('Case deleted');
    } else {
      toast.error('Failed to delete case');
    }
    setDeleteTargetId(null);
  };

  const activeCount = cases.filter(c => c.is_active).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="h-5 w-5" />
                {analystLabel} Regression Harness
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Curate a golden set of contract snippets with expected positions. Re-run the
                suite after changing learnings or banking precedents to catch subtle
                regressions in analyst output. Each run is stored append-only so you can
                trend pass-rate over time.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Case
              </Button>
              <Button size="sm" onClick={handleRunAll} disabled={isRunning || activeCount === 0}>
                {isRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Run Suite ({activeCount})
              </Button>
            </div>
          </div>
        </CardHeader>
        {isRunning && (
          <CardContent>
            <div className="flex items-center gap-3">
              <Progress value={(runProgress.current / Math.max(runProgress.total, 1)) * 100} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {runProgress.current} / {runProgress.total}
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : cases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Beaker className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">No regression cases yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add a case by pasting a contract snippet and describing the positions you
                expect the analyst to extract. Cases can also be seeded from an existing
                analysis — coming soon.
              </p>
            </div>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add First Case</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cases.map(c => (
            <RegressionCaseCard
              key={c.id}
              kase={c}
              latestResult={latestResults[c.id]}
              onToggleActive={() => handleToggleActive(c)}
              onDelete={() => setDeleteTargetId(c.id)}
            />
          ))}
        </div>
      )}

      <AddCaseDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        analyst={analyst}
        onCreated={async () => { setAddDialogOpen(false); await reload(); }}
      />

      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => !o && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete regression case?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the case and all of its past run history. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- Per-case card ---------------------------------------------------

function RegressionCaseCard({
  kase,
  latestResult,
  onToggleActive,
  onDelete,
}: {
  kase: RegressionCase;
  latestResult: CaseRunResult | undefined;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runs, setRuns] = useState<RegressionRunRow[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const loadHistory = async () => {
    setRunsLoading(true);
    const r = await listRegressionRuns(kase.id, 20);
    setRuns(r);
    setRunsLoading(false);
  };

  const score = latestResult ?? (runs[0] ? runResultFromRow(runs[0]) : null);

  return (
    <Card className={kase.is_active ? '' : 'opacity-60'}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{kase.name}</span>
              <Badge variant="outline" className="text-xs">{kase.expected_positions.length} expected</Badge>
              {score && <StatusBadge status={score.status} />}
              {score && score.totalExpected > 0 && (
                <span className="text-xs text-muted-foreground">
                  {score.matchCount} / {score.totalExpected} matched
                  {score.durationMs ? ` · ${Math.round(score.durationMs / 100) / 10}s` : ''}
                </span>
              )}
            </div>
            {kase.description && <p className="text-sm text-muted-foreground mt-1">{kase.description}</p>}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Switch checked={kase.is_active} onCheckedChange={onToggleActive} id={`active-${kase.id}`} />
              <Label htmlFor={`active-${kase.id}`} className="text-xs text-muted-foreground cursor-pointer">Active</Label>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {score && score.missedExpectations.length > 0 && (
          <div className="p-2 bg-muted/50 rounded text-xs">
            <span className="font-medium">Missed:</span>{' '}
            {score.missedExpectations.map((m, i) => (
              <span key={i} className="text-muted-foreground">
                {i > 0 && ', '}
                <span className="font-mono">{m.category}</span>
                {m.summary_contains && <span className="text-muted-foreground/70"> ("{m.summary_contains.slice(0, 30)}")</span>}
              </span>
            ))}
          </div>
        )}

        <Collapsible open={historyOpen} onOpenChange={(o) => { setHistoryOpen(o); if (o && runs.length === 0) void loadHistory(); }}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {historyOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <History className="h-3 w-3" /> Run history
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            {runsLoading ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>
            ) : runs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No prior runs</p>
            ) : (
              <div className="space-y-1.5">
                {runs.map(r => (
                  <div key={r.id} className="flex items-center gap-3 text-xs">
                    <StatusBadge status={r.status} />
                    <span className="text-muted-foreground">{r.match_count} / {r.total_expected}</span>
                    {r.duration_ms != null && <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {(r.duration_ms / 1000).toFixed(1)}s</span>}
                    <span className="text-muted-foreground">{format(new Date(r.created_at), 'MMM d, HH:mm')}</span>
                    <span className="text-muted-foreground/70">({formatDistanceToNow(new Date(r.created_at), { addSuffix: true })})</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function runResultFromRow(row: RegressionRunRow): CaseRunResult {
  return {
    caseId: row.case_id,
    status: row.status,
    matchCount: row.match_count,
    totalExpected: row.total_expected,
    missedExpectations: row.missed_expectations || [],
    unexpectedPositions: row.unexpected_positions || [],
    durationMs: row.duration_ms ?? 0,
    modelUsed: row.model_used,
    error: row.error_message ?? undefined,
  };
}

// ---------- Add-case dialog -------------------------------------------------

function AddCaseDialog({
  open,
  onOpenChange,
  analyst,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analyst: AnalystType;
  onCreated: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contractSnippet, setContractSnippet] = useState('');
  const [analysisConfigText, setAnalysisConfigText] = useState(DEFAULT_CONFIGS[analyst]);
  const [expected, setExpected] = useState<ExpectedPosition[]>([{ category: '', summary_contains: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setContractSnippet('');
      setAnalysisConfigText(DEFAULT_CONFIGS[analyst]);
      setExpected([{ category: '', summary_contains: '' }]);
    }
  }, [open, analyst]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!contractSnippet.trim()) { toast.error('Contract snippet is required'); return; }
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(analysisConfigText);
    } catch {
      toast.error('Analysis config is not valid JSON');
      return;
    }
    const cleanedExpected = expected
      .filter(e => e.category.trim())
      .map(e => ({
        category: e.category.trim(),
        summary_contains: e.summary_contains?.trim() || undefined,
        summary_regex: e.summary_regex?.trim() || undefined,
        confidence: e.confidence || undefined,
        market_position: e.market_position || undefined,
      }));
    if (cleanedExpected.length === 0) {
      toast.error('Add at least one expected position');
      return;
    }

    setSaving(true);
    const created = await createRegressionCase({
      analyst,
      name: name.trim(),
      description: description.trim() || undefined,
      contractSnippet,
      expectedPositions: cleanedExpected,
      analysisConfig: parsedConfig,
    });
    setSaving(false);
    if (created) {
      toast.success('Case created');
      await onCreated();
    } else {
      toast.error('Failed to create case');
    }
  };

  const updateExpected = (idx: number, patch: Partial<ExpectedPosition>) => {
    setExpected(prev => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const removeExpected = (idx: number) => setExpected(prev => prev.filter((_, i) => i !== idx));
  const addExpected = () => setExpected(prev => [...prev, { category: '', summary_contains: '' }]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Regression Case</DialogTitle>
          <DialogDescription>
            A snippet plus the positions you expect the analyst to extract. The harness
            compares each expectation against the actual positions returned and scores
            the case passed / partial / failed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="regression-name">Name</Label>
              <Input id="regression-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 10-year PPA take-or-pay" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regression-desc">Description (optional)</Label>
              <Input id="regression-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notes about what this case covers" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="regression-snippet">Contract snippet</Label>
            <Textarea
              id="regression-snippet"
              value={contractSnippet}
              onChange={(e) => setContractSnippet(e.target.value)}
              placeholder="Paste the clauses the analyst should see..."
              className="min-h-[160px] font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="regression-config">Analysis config (JSON)</Label>
            <Textarea
              id="regression-config"
              value={analysisConfigText}
              onChange={(e) => setAnalysisConfigText(e.target.value)}
              className="min-h-[120px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Passed as body fields to the analyze-{analyst.replace('_', '-')} edge function.
              The contract snippet is injected under the right text key automatically.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Expected positions</Label>
              <Button type="button" variant="outline" size="sm" onClick={addExpected}><Plus className="h-3.5 w-3.5 mr-1" /> Add expectation</Button>
            </div>
            <div className="space-y-2">
              {expected.map((e, i) => (
                <div key={i} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Expectation #{i + 1}</span>
                    {expected.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeExpected(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <Input value={e.category} onChange={(ev) => updateExpected(i, { category: ev.target.value })} placeholder="e.g. Term and Termination" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Summary contains</Label>
                      <Input value={e.summary_contains || ''} onChange={(ev) => updateExpected(i, { summary_contains: ev.target.value })} placeholder="substring that must appear" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Confidence (optional)</Label>
                      <Select value={e.confidence ?? '__any__'} onValueChange={(v) => updateExpected(i, { confidence: v === '__any__' ? undefined : v as ExpectedPosition['confidence'] })}>
                        <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__any__">Any</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="review_required">Review Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Market position (optional)</Label>
                      <Select value={e.market_position ?? '__any__'} onValueChange={(v) => updateExpected(i, { market_position: v === '__any__' ? undefined : v as ExpectedPosition['market_position'] })}>
                        <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__any__">Any</SelectItem>
                          <SelectItem value="on_market">On Market</SelectItem>
                          <SelectItem value="off_market">Off Market</SelectItem>
                          <SelectItem value="way_off_market">Way Off Market</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sensible defaults per analyst for the analysis_config JSON editor.
const DEFAULT_CONFIGS: Record<AnalystType, string> = {
  ppa: JSON.stringify(
    { analysisType: 'ppa_vs_bible', perspective: 'buyer', ppaType: 'physical_ppa', jurisdiction: '', projectName: 'Regression Case', precedents: [], userLearnings: '' },
    null, 2,
  ),
  tolling: JSON.stringify(
    { analysisType: 'tolling_vs_bible', perspective: 'offtaker', tollingType: 'gas_ccgt', facilityStage: 'operating', jurisdiction: '', projectName: 'Regression Case', precedents: [], userLearnings: '' },
    null, 2,
  ),
  carbon: JSON.stringify(
    { analysisType: 'carbon_vs_bible', perspective: 'buyer', carbonType: '', projectStage: 'operating', jurisdiction: '', projectName: 'Regression Case', precedents: [], userLearnings: '' },
    null, 2,
  ),
  it_supply: JSON.stringify(
    { analysisType: 'contract_vs_bible', perspective: 'buyer', supplyType: 'semiconductor', contractStage: 'framework', jurisdiction: '', projectName: 'Regression Case', precedents: [], userLearnings: '' },
    null, 2,
  ),
  cloud_compute: JSON.stringify(
    { analysisType: 'agreement_vs_bible', perspective: 'tenant', serviceType: 'iaas', deploymentModel: 'public_cloud', jurisdiction: '', projectName: 'Regression Case', precedents: [], userLearnings: '' },
    null, 2,
  ),
};
