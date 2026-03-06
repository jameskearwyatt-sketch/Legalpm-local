import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
import { Slider } from '@/components/ui/slider';
import { ArrowRight, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Rounding: always nearest 1,000
function smartRound(value: number): number {
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
    const equalShare = targetTotal / items.length;
    const roundedShare = smartRound(equalShare);
    
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
  
  const shares = items.map(item => ({
    index: item.index,
    proportion: item.currentFee / currentTotal,
    exactShare: (item.currentFee / currentTotal) * targetTotal,
  }));
  
  const roundedShares = shares.map(share => ({
    ...share,
    rounded: smartRound(share.exactShare),
    remainder: share.exactShare - smartRound(share.exactShare),
  }));
  
  const totalRounded = roundedShares.reduce((sum, s) => sum + s.rounded, 0);
  let discrepancy = targetTotal - totalRounded;
  
  const sortedByRemainder = [...roundedShares].sort((a, b) => 
    discrepancy > 0 ? b.remainder - a.remainder : a.remainder - b.remainder
  );
  
  const increment = 1000;
  
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

// Two-tier distribution: first by category, then by items within each category
function distributeTwoTier(
  items: { index: number; currentFee: number; category: string }[],
  targetTotal: number
): Map<number, number> {
  const result = new Map<number, number>();
  
  if (items.length === 0) return result;
  
  const categoryGroups = new Map<string, { index: number; currentFee: number }[]>();
  items.forEach(item => {
    const existing = categoryGroups.get(item.category) || [];
    existing.push({ index: item.index, currentFee: item.currentFee });
    categoryGroups.set(item.category, existing);
  });
  
  const categoryTotals: { category: string; total: number }[] = [];
  categoryGroups.forEach((groupItems, category) => {
    const total = groupItems.reduce((sum, item) => sum + item.currentFee, 0);
    categoryTotals.push({ category, total });
  });
  
  const currentGrandTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0);
  
  const categoryTargets = new Map<string, number>();
  
  if (currentGrandTotal === 0) {
    const equalShare = targetTotal / categoryTotals.length;
    const roundedShare = smartRound(equalShare);
    let distributed = 0;
    categoryTotals.forEach((cat, idx) => {
      if (idx === categoryTotals.length - 1) {
        categoryTargets.set(cat.category, targetTotal - distributed);
      } else {
        categoryTargets.set(cat.category, roundedShare);
        distributed += roundedShare;
      }
    });
  } else {
    const categoryShares = categoryTotals.map(cat => ({
      category: cat.category,
      proportion: cat.total / currentGrandTotal,
      exactShare: (cat.total / currentGrandTotal) * targetTotal,
    }));
    
    const roundedCategoryShares = categoryShares.map(share => ({
      ...share,
      rounded: smartRound(share.exactShare),
      remainder: share.exactShare - smartRound(share.exactShare),
    }));
    
    const totalCategoryRounded = roundedCategoryShares.reduce((sum, s) => sum + s.rounded, 0);
    let categoryDiscrepancy = targetTotal - totalCategoryRounded;
    
    const sortedCategories = [...roundedCategoryShares].sort((a, b) =>
      categoryDiscrepancy > 0 ? b.remainder - a.remainder : a.remainder - b.remainder
    );
    
    const catIncrement = targetTotal / categoryTotals.length >= 10000 ? 1000 : 100;
    
    sortedCategories.forEach(share => {
      if (Math.abs(categoryDiscrepancy) >= catIncrement) {
        const adjustment = categoryDiscrepancy > 0 ? catIncrement : -catIncrement;
        share.rounded += adjustment;
        categoryDiscrepancy -= adjustment;
      }
    });
    
    if (categoryDiscrepancy !== 0 && sortedCategories.length > 0) {
      sortedCategories[0].rounded += categoryDiscrepancy;
    }
    
    roundedCategoryShares.forEach(share => {
      categoryTargets.set(share.category, share.rounded);
    });
  }
  
  categoryGroups.forEach((groupItems, category) => {
    const categoryTarget = categoryTargets.get(category) ?? 0;
    const itemAllocations = distributeProRata(groupItems, categoryTarget);
    itemAllocations.forEach((value, index) => {
      result.set(index, value);
    });
  });
  
  return result;
}

// Snap continuous slider values to clean 1,000 multiples using Largest Remainder
function snapToCleanValues(
  values: Map<number, number>,
  targetTotal: number
): Map<number, number> {
  const result = new Map<number, number>();
  const entries = Array.from(values.entries());
  
  if (entries.length === 0) return result;
  
  const roundedEntries = entries.map(([index, value]) => ({
    index,
    exact: value,
    rounded: smartRound(value),
    remainder: value - smartRound(value),
  }));
  
  const totalRounded = roundedEntries.reduce((sum, e) => sum + e.rounded, 0);
  let discrepancy = targetTotal - totalRounded;
  
  const sorted = [...roundedEntries].sort((a, b) =>
    discrepancy > 0 ? b.remainder - a.remainder : a.remainder - b.remainder
  );
  
  sorted.forEach(entry => {
    if (Math.abs(discrepancy) >= 1000) {
      const adj = discrepancy > 0 ? 1000 : -1000;
      entry.rounded += adj;
      discrepancy -= adj;
    }
  });
  
  if (discrepancy !== 0 && sorted.length > 0) {
    sorted[0].rounded += discrepancy;
  }
  
  roundedEntries.forEach(e => result.set(e.index, e.rounded));
  return result;
}

interface CategoryFeeAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string | null;
  phaseName: string | null;
  currentTotal: number;
  affectedItems: { index: number; workItem: string; currentFee: number; category: string }[];
  formatCurrency: (value: number) => string;
  currencySymbol: string;
  onApply: (allocations: Map<number, number>) => void;
  isSubtotalEdit?: boolean;
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
  isSubtotalEdit = false,
}: CategoryFeeAllocationDialogProps) {
  const [newTotalInput, setNewTotalInput] = useState('');
  // Slider values keyed by item index — start at CURRENT fees, user adjusts manually
  const [sliderValues, setSliderValues] = useState<Map<number, number>>(new Map());
  const [showSliders, setShowSliders] = useState(false);
  
  const newTotal = useMemo(() => {
    const parsed = parseFloat(newTotalInput.replace(/,/g, ''));
    return isNaN(parsed) ? currentTotal : parsed;
  }, [newTotalInput, currentTotal]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setNewTotalInput(currentTotal.toString());
      setShowSliders(false);
      setSliderValues(new Map());
    }
  }, [open, currentTotal]);
  
  const difference = newTotal - currentTotal;
  const percentChange = currentTotal > 0 ? (difference / currentTotal) * 100 : 0;
  const hasChanges = difference !== 0;
  
  // Initialize sliders at CURRENT fees when user changes the total
  useEffect(() => {
    if (hasChanges) {
      const initial = new Map<number, number>();
      affectedItems.forEach(item => {
        initial.set(item.index, item.currentFee);
      });
      setSliderValues(initial);
      setShowSliders(true);
    } else {
      setShowSliders(false);
    }
  }, [hasChanges, newTotal, affectedItems]);
  
  // Calculate totals from slider positions
  const sliderTotal = useMemo(() => {
    let sum = 0;
    sliderValues.forEach(v => sum += v);
    return sum;
  }, [sliderValues]);
  
  const unallocated = newTotal - sliderTotal;
  const isFullyAllocated = Math.abs(unallocated) < 500; // within rounding tolerance

  // Handle slider change: can only go right if there's unallocated budget
  const handleSliderChange = useCallback((changedIndex: number, newValue: number) => {
    setSliderValues(prev => {
      const next = new Map(prev);
      const currentValue = prev.get(changedIndex) ?? 0;
      
      if (newValue > currentValue) {
        // Sliding RIGHT — only allowed up to unallocated budget
        let othersTotal = 0;
        prev.forEach((val, idx) => { if (idx !== changedIndex) othersTotal += val; });
        const maxAllowed = Math.max(0, newTotal - othersTotal);
        next.set(changedIndex, Math.min(newValue, maxAllowed));
      } else {
        // Sliding LEFT — always allowed (down to 0)
        next.set(changedIndex, Math.max(0, newValue));
      }
      return next;
    });
  }, [newTotal]);
  
  // Auto-distribute: spread the difference pro-rata from current fees
  const handleAutoDistribute = useCallback(() => {
    let allocations: Map<number, number>;
    if (isSubtotalEdit) {
      allocations = distributeTwoTier(affectedItems, newTotal);
    } else {
      allocations = distributeProRata(
        affectedItems.map(item => ({ index: item.index, currentFee: item.currentFee })),
        newTotal
      );
    }
    // Set raw (unrounded) values proportionally
    const currentItemTotal = affectedItems.reduce((s, i) => s + i.currentFee, 0);
    const rawMap = new Map<number, number>();
    if (currentItemTotal === 0) {
      const share = newTotal / affectedItems.length;
      affectedItems.forEach(item => rawMap.set(item.index, share));
    } else {
      affectedItems.forEach(item => {
        rawMap.set(item.index, (item.currentFee / currentItemTotal) * newTotal);
      });
    }
    setSliderValues(rawMap);
  }, [affectedItems, newTotal, isSubtotalEdit]);
  
  // Reset sliders to current fees
  const handleResetSliders = useCallback(() => {
    const initial = new Map<number, number>();
    affectedItems.forEach(item => initial.set(item.index, item.currentFee));
    setSliderValues(initial);
  }, [affectedItems]);
  
  // Snap values for apply
  const snappedValues = useMemo(() => {
    if (sliderValues.size === 0) return new Map<number, number>();
    return snapToCleanValues(sliderValues, newTotal);
  }, [sliderValues, newTotal]);
  
  const formatNumber = (value: string): string => {
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('en-GB').format(num);
  };
  
  const handleApply = () => {
    onApply(snappedValues);
    onOpenChange(false);
  };
  
  const dialogTitle = isSubtotalEdit ? 'Adjust Phase Subtotal' : 'Adjust Category Fee';

  const dialogDescription = isSubtotalEdit
    ? <>Adjust the subtotal for <strong>{phaseName}</strong>. The change will be distributed across {affectedItems.length} work item(s).</>
    : <>Adjust the total fee for <strong>{categoryName}</strong>{phaseName && <> in <strong>{phaseName}</strong></>}. Adjust across {affectedItems.length} work item(s).</>;

  // Slider visual max: use newTotal so all sliders share a consistent scale
  const sliderMax = Math.max(newTotal, currentTotal, 1);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          {/* Current vs New Total */}
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <Label className="text-xs text-muted-foreground">Current {isSubtotalEdit ? 'Subtotal' : 'Total'}</Label>
              <div className="text-lg font-semibold">{formatCurrency(currentTotal)}</div>
            </div>
            
            <div className="text-center">
              <ArrowRight className="h-5 w-5 mx-auto text-muted-foreground" />
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">New {isSubtotalEdit ? 'Subtotal' : 'Total'} ({currencySymbol})</Label>
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
          
          {/* Slider-based allocation */}
          {hasChanges && showSliders && (
            <div className="border rounded-md">
              <div className="px-3 py-2 bg-muted/50 border-b flex items-center justify-between">
                <span className="text-sm font-medium">Adjust Individual Items</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAutoDistribute}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Auto-spread
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetSliders}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>
              </div>
              
              {/* Budget status */}
              <div className="px-4 py-2 border-b flex items-center justify-center">
                {isFullyAllocated ? (
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">
                    ✓ Fully allocated — ready to apply
                  </span>
                ) : unallocated > 0 ? (
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                    {formatCurrency(smartRound(unallocated))} still to allocate — slide items right
                  </span>
                ) : (
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">
                    Over-allocated by {formatCurrency(smartRound(Math.abs(unallocated)))} — slide items left
                  </span>
                )}
              </div>

              <div className="max-h-[320px] overflow-y-auto px-4 py-3 space-y-4">
                {affectedItems.map((item) => {
                  const rawValue = sliderValues.get(item.index) ?? item.currentFee;
                  const displayValue = smartRound(rawValue);
                  const changeFromCurrent = displayValue - item.currentFee;
                  const pctOfTotal = newTotal > 0 ? (rawValue / newTotal) * 100 : 0;
                  
                  return (
                    <div key={item.index} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm truncate flex-1" title={item.workItem}>
                          {item.workItem || '(No description)'}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            was {formatCurrency(item.currentFee)}
                          </span>
                          <span className="text-sm font-semibold tabular-nums min-w-[80px] text-right">
                            {formatCurrency(displayValue)}
                          </span>
                          {changeFromCurrent !== 0 && (
                            <span className={cn(
                              "text-xs tabular-nums min-w-[60px] text-right",
                              changeFromCurrent > 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {changeFromCurrent > 0 ? '+' : ''}{formatCurrency(changeFromCurrent)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[rawValue]}
                          min={0}
                          max={sliderMax}
                          step={Math.max(1000, sliderMax / 200)}
                          onValueChange={([v]) => handleSliderChange(item.index, v)}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground tabular-nums w-[36px] text-right">
                          {pctOfTotal.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground text-center">
                Sliders start at current fees · Slide right to add budget · Snaps to nearest {currencySymbol}1,000 on apply
              </div>
            </div>
          )}
          
          {!hasChanges && (
            <div className="text-center text-muted-foreground py-4">
              Enter a new {isSubtotalEdit ? 'subtotal' : 'total'} to see the allocation preview.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasChanges || !isFullyAllocated}>
            Apply Allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}