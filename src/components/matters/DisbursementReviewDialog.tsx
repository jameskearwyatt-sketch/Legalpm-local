import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, X, HelpCircle, Building2, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { LocalCounsel } from '@/lib/hooks/useLocalCounsels';

// Types for disbursement data
export interface DisbursementData {
  matterId: string;
  matterName: string;
  matterNumber: string;
  currency: string;
  wipDisbursement: number;
  arDisbursement: number;
  paidDisbursement: number;
  localCounsels: LocalCounsel[];
}

export interface DisbursementAllocation {
  localCounselId: string;
  firmName: string;
  wipAmount: number;
  billedAmount: number; // AR + Paid
}

export interface DisbursementReviewResult {
  matterId: string;
  isLocalCounselFee: boolean;
  allocations: DisbursementAllocation[];
  allocateLater?: boolean;
}

interface DisbursementReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (results: DisbursementReviewResult[]) => void;
  disbursements: DisbursementData[];
  threshold: number; // e.g., 1000
}

type Step = 'review' | 'select-lc' | 'allocate';

export function DisbursementReviewDialog({
  isOpen,
  onClose,
  onComplete,
  disbursements,
  threshold,
}: DisbursementReviewDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<Step>('review');
  const [results, setResults] = useState<DisbursementReviewResult[]>([]);
  
  // For current matter
  const [isLcFee, setIsLcFee] = useState<boolean | null>(null);
  const [selectedLcIds, setSelectedLcIds] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Record<string, { wipAmount: number; billedAmount: number }>>({});

  const current = disbursements[currentIndex];
  const totalDisbursement = current 
    ? current.wipDisbursement + current.arDisbursement + current.paidDisbursement 
    : 0;

  // Reset state when dialog opens
  const resetForMatter = () => {
    setIsLcFee(null);
    setSelectedLcIds([]);
    setAllocations({});
    setStep('review');
  };

  // Check if any disbursement exceeds threshold
  const hasSignificantDisbursement = current && (
    current.wipDisbursement >= threshold ||
    current.arDisbursement >= threshold ||
    current.paidDisbursement >= threshold
  );

  const handleConfirmLcFee = (isLc: boolean) => {
    setIsLcFee(isLc);
    if (isLc && current?.localCounsels.length > 0) {
      setStep('select-lc');
    } else if (isLc) {
      // No LCs configured, skip to next
      saveCurrentAndNext({ isLocalCounselFee: true, allocations: [] });
    } else {
      // Not LC fee, skip to next
      saveCurrentAndNext({ isLocalCounselFee: false, allocations: [] });
    }
  };

  const handleLcSelection = () => {
    if (selectedLcIds.length === 0) return;
    
    // Initialize allocations with even split
    const totalBilled = (current?.arDisbursement || 0) + (current?.paidDisbursement || 0);
    const wipPerLc = (current?.wipDisbursement || 0) / selectedLcIds.length;
    const billedPerLc = totalBilled / selectedLcIds.length;
    
    const newAllocations: Record<string, { wipAmount: number; billedAmount: number }> = {};
    selectedLcIds.forEach(id => {
      newAllocations[id] = {
        wipAmount: Math.round(wipPerLc * 100) / 100,
        billedAmount: Math.round(billedPerLc * 100) / 100,
      };
    });
    
    setAllocations(newAllocations);
    setStep('allocate');
  };

  const handleAllocationChange = (lcId: string, field: 'wipAmount' | 'billedAmount', value: number) => {
    setAllocations(prev => ({
      ...prev,
      [lcId]: {
        ...prev[lcId],
        [field]: value,
      },
    }));
  };

  const saveCurrentAndNext = (partialResult: { isLocalCounselFee: boolean; allocations: DisbursementAllocation[]; allocateLater?: boolean }) => {
    if (!current) return;
    
    const result: DisbursementReviewResult = {
      matterId: current.matterId,
      ...partialResult,
    };
    
    const newResults = [...results, result];
    setResults(newResults);
    
    if (currentIndex < disbursements.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetForMatter();
    } else {
      // All done
      onComplete(newResults);
    }
  };

  const handleFinalizeAllocations = () => {
    if (!current) return;
    
    const allocationList: DisbursementAllocation[] = selectedLcIds.map(id => {
      const lc = current.localCounsels.find(l => l.id === id);
      return {
        localCounselId: id,
        firmName: lc?.firm_name || 'Unknown',
        wipAmount: allocations[id]?.wipAmount || 0,
        billedAmount: allocations[id]?.billedAmount || 0,
      };
    });
    
    saveCurrentAndNext({ isLocalCounselFee: true, allocations: allocationList });
  };

  const totalAllocatedWip = useMemo(() => 
    Object.values(allocations).reduce((sum, a) => sum + (a.wipAmount || 0), 0),
    [allocations]
  );

  const totalAllocatedBilled = useMemo(() => 
    Object.values(allocations).reduce((sum, a) => sum + (a.billedAmount || 0), 0),
    [allocations]
  );

  const totalBilledDisbursement = current 
    ? current.arDisbursement + current.paidDisbursement 
    : 0;

  if (!current) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Large Disbursement Detected
          </DialogTitle>
          <DialogDescription>
            {currentIndex + 1} of {disbursements.length} matters with significant disbursements
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Matter Info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="font-medium">{current.matterName}</div>
            <div className="text-sm text-muted-foreground">{current.matterNumber}</div>
          </div>

          {/* Step: Review - Is this an LC fee? */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                {current.wipDisbursement >= threshold && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="text-xs text-muted-foreground mb-1">WIP Disbursement</div>
                    <div className="font-semibold text-amber-700 dark:text-amber-400">
                      {formatCurrency(current.wipDisbursement, current.currency)}
                    </div>
                  </div>
                )}
                {current.arDisbursement >= threshold && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="text-xs text-muted-foreground mb-1">AR Disbursement</div>
                    <div className="font-semibold text-orange-700 dark:text-orange-400">
                      {formatCurrency(current.arDisbursement, current.currency)}
                    </div>
                  </div>
                )}
                {current.paidDisbursement >= threshold && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800">
                    <div className="text-xs text-muted-foreground mb-1">Paid Disbursement</div>
                    <div className="font-semibold text-rose-700 dark:text-rose-400">
                      {formatCurrency(current.paidDisbursement, current.currency)}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Is this a local counsel fee that should be tracked separately?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      If yes, you'll be able to allocate these amounts to your local counsel records 
                      for accurate budget tracking and client billing.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleConfirmLcFee(false)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      No, regular disbursement
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={() => handleConfirmLcFee(true)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Yes, allocate to firm now
                    </Button>
                  </div>
                  <Button 
                    variant="secondary"
                    className="w-full"
                    onClick={() => saveCurrentAndNext({ isLocalCounselFee: true, allocations: [], allocateLater: true })}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Yes, but allocate to specific firm later
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Select Local Counsel */}
          {step === 'select-lc' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Which local counsel does this relate to?</p>
                  <p className="text-sm text-muted-foreground">
                    Select one or more local counsel firms. You can allocate specific amounts in the next step.
                  </p>
                </div>
              </div>

              <ScrollArea className="max-h-[200px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {current.localCounsels.map(lc => (
                    <label
                      key={lc.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        selectedLcIds.includes(lc.id) 
                          ? "bg-primary/10 border border-primary/30" 
                          : "hover:bg-muted"
                      )}
                    >
                      <Checkbox
                        checked={selectedLcIds.includes(lc.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLcIds([...selectedLcIds, lc.id]);
                          } else {
                            setSelectedLcIds(selectedLcIds.filter(id => id !== lc.id));
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{lc.firm_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Budget: {formatCurrency(lc.allocated_budget, current.currency)}
                          {lc.billing_mode && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              {lc.billing_mode}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('review')}>
                  Back
                </Button>
                <Button 
                  onClick={handleLcSelection} 
                  disabled={selectedLcIds.length === 0}
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step: Allocate Amounts */}
          {step === 'allocate' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Allocate amounts to each local counsel</p>
                  <p className="text-sm text-muted-foreground">
                    Distribute the disbursement amounts across the selected firms.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 bg-muted rounded">
                  <span className="text-muted-foreground">WIP to allocate:</span>
                  <span className="font-medium ml-2">
                    {formatCurrency(current.wipDisbursement, current.currency)}
                  </span>
                </div>
                <div className="p-2 bg-muted rounded">
                  <span className="text-muted-foreground">Billed to allocate:</span>
                  <span className="font-medium ml-2">
                    {formatCurrency(totalBilledDisbursement, current.currency)}
                  </span>
                </div>
              </div>

              {/* Allocation inputs */}
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {selectedLcIds.map(id => {
                  const lc = current.localCounsels.find(l => l.id === id);
                  if (!lc) return null;
                  
                  return (
                    <div key={id} className="p-3 border rounded-lg space-y-2">
                      <div className="font-medium text-sm">{lc.firm_name}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">WIP Amount</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={allocations[id]?.wipAmount || ''}
                            onChange={(e) => handleAllocationChange(id, 'wipAmount', parseFloat(e.target.value) || 0)}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Billed Amount</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={allocations[id]?.billedAmount || ''}
                            onChange={(e) => handleAllocationChange(id, 'billedAmount', parseFloat(e.target.value) || 0)}
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Allocation summary */}
              <div className="text-sm space-y-1 p-2 bg-muted rounded">
                <div className="flex justify-between">
                  <span>Allocated WIP:</span>
                  <span className={cn(
                    "font-medium",
                    Math.abs(totalAllocatedWip - current.wipDisbursement) < 0.01 
                      ? "text-green-600" 
                      : "text-amber-600"
                  )}>
                    {formatCurrency(totalAllocatedWip, current.currency)} / {formatCurrency(current.wipDisbursement, current.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Allocated Billed:</span>
                  <span className={cn(
                    "font-medium",
                    Math.abs(totalAllocatedBilled - totalBilledDisbursement) < 0.01 
                      ? "text-green-600" 
                      : "text-amber-600"
                  )}>
                    {formatCurrency(totalAllocatedBilled, current.currency)} / {formatCurrency(totalBilledDisbursement, current.currency)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('select-lc')}>
                  Back
                </Button>
                <Button onClick={handleFinalizeAllocations}>
                  {currentIndex < disbursements.length - 1 ? 'Save & Next' : 'Finish'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        {disbursements.length > 1 && (
          <div className="flex justify-center gap-1 pt-2">
            {disbursements.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-colors",
                  idx < currentIndex ? "bg-primary" :
                  idx === currentIndex ? "bg-primary/60" :
                  "bg-muted-foreground/20"
                )}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
