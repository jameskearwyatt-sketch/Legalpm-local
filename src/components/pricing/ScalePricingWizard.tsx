import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, AlertTriangle, Check, Lock } from "lucide-react";
import { DraftProposalItem, ProposalPhase } from "@/lib/hooks/usePricingProposals";
import { calculateFeeRange, smartRoundFee } from "@/lib/feeSpreadUtils";
import { cn } from "@/lib/utils";

interface ScalePricingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DraftProposalItem[];
  phases: ProposalPhase[];
  currencySymbol: string;
  lockedCategories: Set<string>;
  isItemLocked: (item: DraftProposalItem) => boolean;
  onApply: (scaledItems: { index: number; fee_upper: number; fee_lower: number; fee_amount: number }[]) => void;
}

function getFeeUpper(item: DraftProposalItem): number {
  return item.fee_upper ?? item.fee_amount ?? 0;
}

/**
 * Largest Remainder Method distribution with smart rounding.
 */
function distributeProRataLRM(
  items: { index: number; currentFee: number }[],
  targetTotal: number
): Map<number, number> {
  const result = new Map<number, number>();
  if (items.length === 0) return result;

  const currentTotal = items.reduce((sum, i) => sum + i.currentFee, 0);
  if (currentTotal <= 0) return result;

  const shares = items.map(item => ({
    index: item.index,
    exactShare: (item.currentFee / currentTotal) * targetTotal,
  }));

  const roundedShares = shares.map(s => ({
    ...s,
    rounded: smartRoundFee(s.exactShare),
    remainder: s.exactShare - smartRoundFee(s.exactShare),
  }));

  const totalRounded = roundedShares.reduce((sum, s) => sum + s.rounded, 0);
  let discrepancy = targetTotal - totalRounded;

  const sortedByRemainder = [...roundedShares].sort((a, b) =>
    discrepancy > 0 ? b.remainder - a.remainder : a.remainder - b.remainder
  );

  const avgAmount = targetTotal / items.length;
  const increment = avgAmount >= 10000 ? 1000 : 100;

  sortedByRemainder.forEach(share => {
    if (Math.abs(discrepancy) >= increment) {
      const adjustment = discrepancy > 0 ? increment : -increment;
      share.rounded += adjustment;
      discrepancy -= adjustment;
    }
  });

  if (discrepancy !== 0 && sortedByRemainder.length > 0) {
    sortedByRemainder[0].rounded += discrepancy;
  }

  roundedShares.forEach(share => {
    result.set(share.index, share.rounded);
  });

  return result;
}

export function ScalePricingWizard({
  open,
  onOpenChange,
  items,
  phases,
  currencySymbol,
  lockedCategories,
  isItemLocked,
  onApply,
}: ScalePricingWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [targetAmount, setTargetAmount] = useState("");
  const [selectionTab, setSelectionTab] = useState("phase");
  const [includeLocked, setIncludeLocked] = useState(false);
  const [showLockPrompt, setShowLockPrompt] = useState(false);

  // Check if any included items are locked
  const hasLockedItems = useMemo(() => {
    return items.some(item => item.is_included && isItemLocked(item) && getFeeUpper(item) > 0);
  }, [items, isItemLocked]);

  // Reset state when dialog opens
  const handleOpenChange = useCallback((o: boolean) => {
    if (o) {
      setStep(1);
      setSelectedIndices(new Set());
      setTargetAmount("");
      setSelectionTab("phase");
      setIncludeLocked(false);
      // Show lock prompt if there are locked items
      if (items.some(item => item.is_included && isItemLocked(item) && getFeeUpper(item) > 0)) {
        setShowLockPrompt(true);
      }
    }
    onOpenChange(o);
  }, [onOpenChange, items, isItemLocked]);

  // Selectable items based on lock override choice
  const selectableItems = useMemo(() => {
    const result: { index: number; item: DraftProposalItem }[] = [];
    items.forEach((item, index) => {
      if (item.is_included && getFeeUpper(item) > 0) {
        if (includeLocked || !isItemLocked(item)) {
          result.push({ index, item });
        }
      }
    });
    return result;
  }, [items, isItemLocked, includeLocked]);

  // Group by phase
  const phaseGroups = useMemo(() => {
    const groups = new Map<string, { phase: ProposalPhase | null; items: { index: number; item: DraftProposalItem }[] }>();
    selectableItems.forEach(({ index, item }) => {
      const phaseId = item.phase_id || "__unassigned__";
      if (!groups.has(phaseId)) {
        const phase = phases.find(p => p.id === phaseId) || null;
        groups.set(phaseId, { phase, items: [] });
      }
      groups.get(phaseId)!.items.push({ index, item });
    });
    return groups;
  }, [selectableItems, phases]);

  // Group by category
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, { index: number; item: DraftProposalItem }[]>();
    selectableItems.forEach(({ index, item }) => {
      const cat = item.category || "Other";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push({ index, item });
    });
    return groups;
  }, [selectableItems]);

  // Current aggregate for selection
  const currentTotal = useMemo(() => {
    let sum = 0;
    selectedIndices.forEach(idx => {
      sum += getFeeUpper(items[idx]);
    });
    return sum;
  }, [selectedIndices, items]);

  const targetNum = parseFloat(targetAmount) || 0;
  const scalingFactor = currentTotal > 0 ? targetNum / currentTotal : 1;
  const percentChange = ((scalingFactor - 1) * 100);
  const isExtremeScale = scalingFactor < 0.5 || scalingFactor > 2.0;

  // Preview using Largest Remainder Method with smart rounding
  const previewItems = useMemo(() => {
    if (currentTotal <= 0 || targetNum <= 0) return [];

    const selected = Array.from(selectedIndices).map(idx => ({
      index: idx,
      item: items[idx],
      currentFee: getFeeUpper(items[idx]),
      scaledFee: 0,
    }));

    const allocations = distributeProRataLRM(
      selected.map(s => ({ index: s.index, currentFee: s.currentFee })),
      targetNum
    );

    selected.forEach(s => {
      s.scaledFee = allocations.get(s.index) ?? s.currentFee;
    });

    return selected;
  }, [selectedIndices, items, currentTotal, targetNum]);

  const previewTotal = previewItems.reduce((sum, s) => sum + s.scaledFee, 0);

  // Toggle helpers
  const toggleIndex = (idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const togglePhase = (phaseId: string) => {
    const group = phaseGroups.get(phaseId);
    if (!group) return;
    const groupIndices = group.items.map(i => i.index);
    const allSelected = groupIndices.every(i => selectedIndices.has(i));
    setSelectedIndices(prev => {
      const next = new Set(prev);
      groupIndices.forEach(i => allSelected ? next.delete(i) : next.add(i));
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    const group = categoryGroups.get(cat);
    if (!group) return;
    const groupIndices = group.map(i => i.index);
    const allSelected = groupIndices.every(i => selectedIndices.has(i));
    setSelectedIndices(prev => {
      const next = new Set(prev);
      groupIndices.forEach(i => allSelected ? next.delete(i) : next.add(i));
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIndices(new Set(selectableItems.map(s => s.index)));
  };

  const selectNone = () => {
    setSelectedIndices(new Set());
  };

  const isPhaseChecked = (phaseId: string) => {
    const group = phaseGroups.get(phaseId);
    if (!group || group.items.length === 0) return false;
    return group.items.every(i => selectedIndices.has(i.index));
  };

  const isPhaseIndeterminate = (phaseId: string) => {
    const group = phaseGroups.get(phaseId);
    if (!group || group.items.length === 0) return false;
    const someSelected = group.items.some(i => selectedIndices.has(i.index));
    const allSelected = group.items.every(i => selectedIndices.has(i.index));
    return someSelected && !allSelected;
  };

  const isCatChecked = (cat: string) => {
    const group = categoryGroups.get(cat);
    if (!group || group.length === 0) return false;
    return group.every(i => selectedIndices.has(i.index));
  };

  const isCatIndeterminate = (cat: string) => {
    const group = categoryGroups.get(cat);
    if (!group || group.length === 0) return false;
    const someSelected = group.some(i => selectedIndices.has(i.index));
    const allSelected = group.every(i => selectedIndices.has(i.index));
    return someSelected && !allSelected;
  };

  const handleApply = () => {
    const result = previewItems.map(s => {
      const { fee_lower, fee_amount } = calculateFeeRange(s.scaledFee, s.item.category);
      return {
        index: s.index,
        fee_upper: s.scaledFee,
        fee_lower,
        fee_amount,
      };
    });
    onApply(result);
    handleOpenChange(false);
  };

  const fmt = (v: number) => `${currencySymbol}${v.toLocaleString()}`;

  return (
    <>
      {/* Lock override prompt */}
      <AlertDialog open={showLockPrompt} onOpenChange={setShowLockPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Locked Categories Detected</AlertDialogTitle>
            <AlertDialogDescription>
              Some items belong to locked categories. Would you like to include locked items in this scaling adjustment?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIncludeLocked(false); setShowLockPrompt(false); }}>
              No, skip locked items
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { setIncludeLocked(true); setShowLockPrompt(false); }}>
              Yes, include locked items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Scale Pricing</DialogTitle>
            <DialogDescription>
              {step === 1
                ? "Select work items to scale proportionally"
                : "Set a new target and preview scaled fees"}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              {/* Aggregate bar */}
              <div className="flex items-center justify-between px-1">
                <div className="text-sm text-muted-foreground">
                  {selectedIndices.size} item{selectedIndices.size !== 1 ? "s" : ""} selected
                  {includeLocked && hasLockedItems && (
                    <Badge variant="outline" className="ml-2 text-xs border-amber-400 text-amber-700 dark:text-amber-300">
                      <Lock className="h-3 w-3 mr-1" /> Including locked
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-semibold">
                  Current total: {fmt(currentTotal)}
                </div>
              </div>

              <div className="flex gap-2 px-1">
                <Button variant="ghost" size="sm" onClick={selectAll}>Select all</Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>Clear</Button>
              </div>

              <Tabs value={selectionTab} onValueChange={setSelectionTab} className="flex-1 min-h-0 flex flex-col">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="phase">By Phase</TabsTrigger>
                  <TabsTrigger value="category">By Category</TabsTrigger>
                  <TabsTrigger value="item">By Item</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 min-h-0 mt-2" style={{ maxHeight: "40vh" }}>
                  <TabsContent value="phase" className="mt-0 space-y-2">
                    {Array.from(phaseGroups.entries()).map(([phaseId, group]) => (
                      <div key={phaseId} className="space-y-1">
                        <label className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer font-medium text-sm">
                          <Checkbox
                            checked={isPhaseChecked(phaseId)}
                            // @ts-ignore - indeterminate prop
                            data-state={isPhaseIndeterminate(phaseId) ? "indeterminate" : undefined}
                            onCheckedChange={() => togglePhase(phaseId)}
                          />
                          {group.phase?.name || "Unassigned"}
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {group.items.length} item{group.items.length !== 1 ? "s" : ""} · {fmt(group.items.reduce((s, i) => s + getFeeUpper(i.item), 0))}
                          </Badge>
                        </label>
                      </div>
                    ))}
                    {phaseGroups.size === 0 && (
                      <p className="text-sm text-muted-foreground p-2">No selectable items</p>
                    )}
                  </TabsContent>

                  <TabsContent value="category" className="mt-0 space-y-2">
                    {Array.from(categoryGroups.entries()).sort().map(([cat, groupItems]) => (
                      <label key={cat} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer text-sm">
                        <Checkbox
                          checked={isCatChecked(cat)}
                          data-state={isCatIndeterminate(cat) ? "indeterminate" : undefined}
                          onCheckedChange={() => toggleCategory(cat)}
                        />
                        {cat}
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {groupItems.length} · {fmt(groupItems.reduce((s, i) => s + getFeeUpper(i.item), 0))}
                        </Badge>
                      </label>
                    ))}
                  </TabsContent>

                  <TabsContent value="item" className="mt-0 space-y-1">
                    {selectableItems.map(({ index, item }) => (
                      <label key={index} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedIndices.has(index)}
                          onCheckedChange={() => toggleIndex(index)}
                        />
                        <span className="flex-1 truncate">{item.work_item}</span>
                        <span className="text-muted-foreground text-xs shrink-0">{fmt(getFeeUpper(item))}</span>
                      </label>
                    ))}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          )}

          {step === 2 && (
            <div className="flex-1 min-h-0 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Current total</Label>
                  <div className="text-lg font-semibold">{fmt(currentTotal)}</div>
                </div>
                <div>
                  <Label htmlFor="scale-target" className="text-xs text-muted-foreground">New target</Label>
                  <Input
                    id="scale-target"
                    type="number"
                    min={0}
                    step={1000}
                    value={targetAmount}
                    onChange={e => setTargetAmount(e.target.value)}
                    placeholder="Enter target..."
                    autoFocus
                  />
                </div>
              </div>

              {targetNum > 0 && (
                <>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant={isExtremeScale ? "destructive" : "secondary"}>
                      ×{scalingFactor.toFixed(2)} — {percentChange >= 0 ? "+" : ""}{percentChange.toFixed(0)}%
                    </Badge>
                    {isExtremeScale && (
                      <span className="text-destructive flex items-center gap-1 text-xs">
                        <AlertTriangle className="h-3 w-3" /> Extreme scaling factor
                      </span>
                    )}
                  </div>

                  <ScrollArea className="flex-1 min-h-0 border rounded-md" style={{ maxHeight: "35vh" }}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Work Item</TableHead>
                          <TableHead className="text-right">Current</TableHead>
                          <TableHead className="text-right">Scaled</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewItems.map(s => (
                          <TableRow key={s.index}>
                            <TableCell className="text-sm truncate max-w-[200px]">{s.item.work_item}</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{fmt(s.currentFee)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{fmt(s.scaledFee)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold border-t-2">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{fmt(currentTotal)}</TableCell>
                          <TableCell className="text-right">{fmt(previewTotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {previewTotal !== targetNum && (
                    <p className="text-xs text-muted-foreground">
                      Note: Total is {fmt(previewTotal)} after smart rounding (target: {fmt(targetNum)})
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
            {step === 2 && (
              <Button variant="outline" onClick={() => setStep(1)} className="mr-auto">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step === 1 && (
              <Button
                onClick={() => setStep(2)}
                disabled={selectedIndices.size === 0}
              >
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={handleApply}
                disabled={targetNum <= 0 || previewItems.length === 0}
              >
                <Check className="h-4 w-4 mr-1" /> Apply Scaling
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
