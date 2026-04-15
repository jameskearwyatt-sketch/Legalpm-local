/**
 * Shared "Save as Regression Case" button for the 5 analyst reports.
 *
 * Attorneys who have just analysed a contract and like the result want an
 * easy way to freeze that output as a golden-set case. This button opens a
 * lightweight dialog that:
 *   - Pre-fills the case name from the project name.
 *   - Seeds expected positions from the analysis's extracted positions
 *     (category + first 8 words of the summary + confidence + market
 *     position) via `seedExpectationsFromPositions`.
 *   - Asks the user to paste the contract text (the analyses tables don't
 *     store raw contract text — retaining privileged text at rest would be
 *     a bigger decision — so the user hands it over just for this case).
 *   - Lets the user toggle which expectations to keep.
 *   - Pre-fills `analysis_config` with the analyst-specific body params
 *     (perspective, analysis type, jurisdiction, etc.) so the saved case
 *     can later round-trip through `runRegressionSuite`.
 *
 * Complements the Regression tab's "Add Case" flow — this is the
 * from-report shortcut, that one is the manual form.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Beaker, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AnalystType } from '@/lib/analyst/semanticRetrieval';
import {
  createRegressionCase,
  seedExpectationsFromPositions,
  type ActualPositionShape,
  type ExpectedPosition,
} from '@/lib/analyst/regressionHarness';

interface Props {
  analyst: AnalystType;
  analystLabel: string;
  analysisId: string;
  projectName: string;
  positions: ActualPositionShape[];
  defaultConfig: Record<string, unknown>;
}

export function SaveAsRegressionCaseButton({
  analyst,
  analystLabel,
  analysisId,
  projectName,
  positions,
  defaultConfig,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState('');
  const [contractSnippet, setContractSnippet] = useState('');
  const seeded = useMemo<ExpectedPosition[]>(() => seedExpectationsFromPositions(positions), [positions]);
  const [kept, setKept] = useState<Set<number>>(() => new Set(seeded.map((_, i) => i)));

  const reset = () => {
    setName(projectName);
    setDescription('');
    setContractSnippet('');
    setKept(new Set(seeded.map((_, i) => i)));
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    setOpen(next);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!contractSnippet.trim()) { toast.error('Paste the contract text so the case can be re-run'); return; }
    const expectations = seeded.filter((_, i) => kept.has(i));
    if (expectations.length === 0) { toast.error('Keep at least one expected position'); return; }
    setSaving(true);
    try {
      const created = await createRegressionCase({
        analyst,
        name: name.trim(),
        description: description.trim() || undefined,
        contractSnippet: contractSnippet.trim(),
        expectedPositions: expectations,
        analysisConfig: defaultConfig,
        sourceAnalysisId: analysisId,
      });
      if (!created) { toast.error('Failed to save regression case'); return; }
      toast.success(`Saved "${created.name}" to ${analystLabel} regression suite`);
      setOpen(false);
      reset();
    } catch (err) {
      console.error('SaveAsRegressionCase failed', err);
      toast.error('Failed to save regression case');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (i: number) => {
    setKept(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Beaker className="h-4 w-4 mr-1" />
        Save as Regression Case
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Save as Regression Case</DialogTitle>
            <DialogDescription>
              Freeze this analysis as a golden case for the {analystLabel} regression suite. Re-run
              after learnings change to catch drift.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="srcase-name">Case Name</Label>
              <Input
                id="srcase-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme Solar 2026 Q1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="srcase-desc">Description (optional)</Label>
              <Textarea
                id="srcase-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What makes this a good regression case?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="srcase-contract">Contract Text</Label>
              <p className="text-xs text-muted-foreground">
                The original contract text isn't stored on the analysis record. Paste it here so the
                case can be replayed through the same analyze-* edge function.
              </p>
              <Textarea
                id="srcase-contract"
                value={contractSnippet}
                onChange={e => setContractSnippet(e.target.value)}
                placeholder="Paste the contract text..."
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Expected Positions ({kept.size} of {seeded.length})</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Uncheck any expectations you don't want to freeze. Each expected position must match
                at least one extracted position when the case is re-run.
              </p>
              <ScrollArea className="max-h-64 border rounded-md p-2">
                <div className="space-y-2">
                  {seeded.map((exp, i) => (
                    <label
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={kept.has(i)}
                        onCheckedChange={() => toggle(i)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{exp.category || 'Unknown'}</Badge>
                          {exp.confidence && (
                            <Badge variant="secondary" className="text-xs">{exp.confidence}</Badge>
                          )}
                          {exp.market_position && (
                            <Badge variant="secondary" className="text-xs">
                              {exp.market_position.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                        {exp.summary_contains && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            "{exp.summary_contains}..."
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                  {seeded.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      No positions to seed. Save this case manually via the Regression tab.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || seeded.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Beaker className="h-4 w-4 mr-1" />}
              Save Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
