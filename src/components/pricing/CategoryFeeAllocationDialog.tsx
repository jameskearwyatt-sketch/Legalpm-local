import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DraftProposalItem } from '@/lib/hooks/usePricingProposals';

// Smart rounding: nearest 100 for <10k, nearest 1000 for >=10k
function smartRound(value: number): number {
  const absValue = Math.abs(value);
  if (absValue < 10000) {
    return Math.round(value / 100) * 100;
  }
  return Math.round(value / 1000) * 1000;
}

// Largest Remainder Method for distributing amounts while matching target exactly
function distributeProRata(
  items: { index: number; currentFee: number }[],
  targetTotal: number
): Map<number, number> {
  const result = new Map<number, number>();
  
  if (items.length === 0) return result;
  
  const currentTotal = items.reduce((sum, item) => sum + item.currentFee, 0);
  
  if (currentTotal === 0) {
    // If all items are zero, distribute equally with smart rounding
    const equalShare = targetTotal / items.length;
    const roundedShare = smartRound(equalShare);
    
    // Give each item the rounded share, adjust last item to match target
    let distributed = 0;
    items.forEach((item, idx) => {
      if (idx === items.length - 1) {
        result.set(item.index, targetTotal - distributed);
      } else {
        result.set(item.index, roundedShare);
        distributed += roundedShare;
      }
    });
    return result;
  }
  
  // Calculate proportional shares
  const shares = items.map(item => ({
    index: item.index,
    proportion: item.currentFee / currentTotal,
    exactShare: (item.currentFee / currentTotal) * targetTotal,
  }));
  
  // First pass: round each share using smart rounding
  const roundedShares = shares.map(share => ({
    ...share,
    rounded: smartRound(share.exactShare),
    remainder: share.exactShare - smartRound(share.exactShare),
  }));
  
  // Calculate discrepancy
  const totalRounded = roundedShares.reduce((sum, s) => sum + s.rounded, 0);
  let discrepancy = targetTotal - totalRounded;
  
  // Sort by remainder (largest first for positive discrepancy, smallest for negative)
  const sortedByRemainder = [...roundedShares].sort((a, b) => 
    discrepancy > 0 ? b.remainder - a.remainder : a.remainder - b.remainder
  );
  
  // Determine increment based on amounts
  const avgAmount = targetTotal / items.length;
  const increment = avgAmount >= 10000 ? 1000 : 100;
  
  // Adjust items to eliminate discrepancy
  sortedByRemainder.forEach(share => {
    if (Math.abs(discrepancy) >= increment) {
      const adjustment = discrepancy > 0 ? increment : -increment;
      share.rounded += adjustment;
      discrepancy -= adjustment;
    }
  });
  
  // Final adjustment if still off (add to largest item)
  if (discrepancy !== 0 && sortedByRemainder.length > 0) {
    sortedByRemainder[0].rounded += discrepancy;
  }
  
  // Build result map
  roundedShares.forEach(share => {
    result.set(share.index, share.rounded);
  });
  
  return result;
}

interface CategoryFeeAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  phaseName: string | null; // null for aggregate
  currentTotal: number;
  affectedItems: { index: number; workItem: string; currentFee: number }[];
  formatCurrency: (value: number) => string;
  currencySymbol: string;
  onApply: (allocations: Map<number, number>) => void;
}

export function CategoryFeeAllocationDialog({
  open,
  onOpenChange,
  categoryName,
  phaseName,
  currentTotal,
  affectedItems,
  formatCurrency,
  currencySymbol,
  onApply,
}: CategoryFeeAllocationDialogProps) {
  const [newTotalInput, setNewTotalInput] = useState('');
  
  // Reset input when dialog opens
  useEffect(() => {
    if (open) {
      setNewTotalInput(currentTotal.toString());
    }
  }, [open, currentTotal]);
  
  const newTotal = useMemo(() => {
    const parsed = parseFloat(newTotalInput.replace(/,/g, ''));
    return isNaN(parsed) ? currentTotal : parsed;
  }, [newTotalInput, currentTotal]);
  
  const difference = newTotal - currentTotal;
  const percentChange = currentTotal > 0 ? (difference / currentTotal) * 100 : 0;
  
  // Preview allocations
  const previewAllocations = useMemo(() => {
    return distributeProRata(
      affectedItems.map(item => ({ index: item.index, currentFee: item.currentFee })),
      newTotal
    );
  }, [affectedItems, newTotal]);
  
  // Preview items with new values
  const previewItems = useMemo(() => {
    return affectedItems.map(item => ({
      ...item,
      newFee: previewAllocations.get(item.index) ?? item.currentFee,
      change: (previewAllocations.get(item.index) ?? item.currentFee) - item.currentFee,
    }));
  }, [affectedItems, previewAllocations]);
  
  const formatNumber = (value: string): string => {
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('en-GB').format(num);
  };
  
  const handleApply = () => {
    onApply(previewAllocations);
    onOpenChange(false);
  };
  
  const hasChanges = difference !== 0;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Adjust Category Fee</DialogTitle>
          <DialogDescription>
            Adjust the total fee for <strong>{categoryName}</strong>
            {phaseName && <> in <strong>{phaseName}</strong></>}.
            The change will be distributed pro-rata across {affectedItems.length} work item(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          {/* Current vs New Total */}
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <Label className="text-xs text-muted-foreground">Current Total</Label>
              <div className="text-lg font-semibold">{formatCurrency(currentTotal)}</div>
            </div>
            
            <div className="text-center">
              <ArrowRight className="h-5 w-5 mx-auto text-muted-foreground" />
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">New Total ({currencySymbol})</Label>
              <Input
                type="text"
                value={formatNumber(newTotalInput)}
                onChange={(e) => setNewTotalInput(e.target.value.replace(/,/g, ''))}
                className="text-lg font-semibold text-center"
                autoFocus
              />
            </div>
          </div>
          
          {/* Change indicator */}
          {hasChanges && (
            <div className={cn(
              "flex items-center justify-center gap-2 py-2 px-4 rounded-md",
              difference > 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"
            )}>
              {difference > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={cn(
                "font-medium",
                difference > 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
              )}>
                {difference > 0 ? '+' : ''}{formatCurrency(difference)} ({percentChange.toFixed(1)}%)
              </span>
            </div>
          )}
          
          {/* Preview table */}
          {hasChanges && (
            <div className="border rounded-md">
              <div className="px-3 py-2 bg-muted/50 border-b">
                <span className="text-sm font-medium">Preview Allocation</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left px-3 py-2 font-medium">Work Item</th>
                      <th className="text-right px-3 py-2 font-medium">Current</th>
                      <th className="text-right px-3 py-2 font-medium">New</th>
                      <th className="text-right px-3 py-2 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item, idx) => (
                      <tr key={item.index} className={cn(idx % 2 === 0 && "bg-muted/30")}>
                        <td className="px-3 py-1.5 truncate max-w-[200px]" title={item.workItem}>
                          {item.workItem || '(No description)'}
                        </td>
                        <td className="text-right px-3 py-1.5 text-muted-foreground">
                          {formatCurrency(item.currentFee)}
                        </td>
                        <td className="text-right px-3 py-1.5 font-medium">
                          {formatCurrency(item.newFee)}
                        </td>
                        <td className={cn(
                          "text-right px-3 py-1.5",
                          item.change > 0 ? "text-green-600" : item.change < 0 ? "text-red-600" : "text-muted-foreground"
                        )}>
                          {item.change > 0 ? '+' : ''}{formatCurrency(item.change)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {!hasChanges && (
            <div className="text-center text-muted-foreground py-4">
              Enter a new total to see the allocation preview.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasChanges}>
            Apply Allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
