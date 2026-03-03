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
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
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
  
  // Always use 1000 increment for discrepancy adjustment
  const increment = 1000;
  
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

// Two-tier distribution: first by category, then by items within each category
function distributeTwoTier(
  items: { index: number; currentFee: number; category: string }[],
  targetTotal: number
): Map<number, number> {
  const result = new Map<number, number>();
  
  if (items.length === 0) return result;
  
  // Group items by category
  const categoryGroups = new Map<string, { index: number; currentFee: number }[]>();
  items.forEach(item => {
    const existing = categoryGroups.get(item.category) || [];
    existing.push({ index: item.index, currentFee: item.currentFee });
    categoryGroups.set(item.category, existing);
  });
  
  // Calculate current category totals
  const categoryTotals: { category: string; total: number }[] = [];
  categoryGroups.forEach((groupItems, category) => {
    const total = groupItems.reduce((sum, item) => sum + item.currentFee, 0);
    categoryTotals.push({ category, total });
  });
  
  const currentGrandTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0);
  
  // First tier: distribute target across categories pro-rata
  const categoryTargets = new Map<string, number>();
  
  if (currentGrandTotal === 0) {
    // Equal distribution across categories
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
    // Pro-rata by current category totals
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
    
    // Reconcile category discrepancy
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
  
  // Second tier: distribute each category's target across its items
  categoryGroups.forEach((groupItems, category) => {
    const categoryTarget = categoryTargets.get(category) ?? 0;
    const itemAllocations = distributeProRata(groupItems, categoryTarget);
    itemAllocations.forEach((value, index) => {
      result.set(index, value);
    });
  });
  
  return result;
}

interface CategoryFeeAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string | null; // null for subtotal edit
  phaseName: string | null;
  currentTotal: number;
  affectedItems: { index: number; workItem: string; currentFee: number; category: string }[];
  formatCurrency: (value: number) => string;
  currencySymbol: string;
  onApply: (allocations: Map<number, number>) => void;
  isSubtotalEdit?: boolean; // true = editing phase subtotal, false = editing single category
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
  
  // Preview allocations - use two-tier for subtotal, single-tier for category
  const previewAllocations = useMemo(() => {
    if (isSubtotalEdit) {
      return distributeTwoTier(affectedItems, newTotal);
    }
    return distributeProRata(
      affectedItems.map(item => ({ index: item.index, currentFee: item.currentFee })),
      newTotal
    );
  }, [affectedItems, newTotal, isSubtotalEdit]);
  
  // Preview items with new values, grouped by category for subtotal view
  const previewItems = useMemo(() => {
    return affectedItems.map(item => ({
      ...item,
      newFee: previewAllocations.get(item.index) ?? item.currentFee,
      change: (previewAllocations.get(item.index) ?? item.currentFee) - item.currentFee,
    }));
  }, [affectedItems, previewAllocations]);
  
  // Group items by category for subtotal preview
  const groupedPreviewItems = useMemo(() => {
    if (!isSubtotalEdit) return null;
    
    const groups = new Map<string, typeof previewItems>();
    previewItems.forEach(item => {
      const existing = groups.get(item.category) || [];
      existing.push(item);
      groups.set(item.category, existing);
    });
    return groups;
  }, [previewItems, isSubtotalEdit]);
  
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
  
  // Build dialog title and description
  const dialogTitle = isSubtotalEdit ? 'Adjust Phase Subtotal' : 'Adjust Category Fee';
  const dialogDescription = isSubtotalEdit
    ? <>Adjust the subtotal for <strong>{phaseName}</strong>. The change will be distributed pro-rata across categories first, then within each category across {affectedItems.length} work item(s).</>
    : <>Adjust the total fee for <strong>{categoryName}</strong>{phaseName && <> in <strong>{phaseName}</strong></>}. The change will be distributed pro-rata across {affectedItems.length} work item(s).</>;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-hidden flex flex-col">
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
          
          {/* Preview table */}
          {hasChanges && (
            <div className="border rounded-md">
              <div className="px-3 py-2 bg-muted/50 border-b">
                <span className="text-sm font-medium">Preview Allocation</span>
              </div>
              <div className="max-h-[250px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      {isSubtotalEdit && <th className="text-left px-3 py-2 font-medium">Category</th>}
                      <th className="text-left px-3 py-2 font-medium">Work Item</th>
                      <th className="text-right px-3 py-2 font-medium">Current</th>
                      <th className="text-right px-3 py-2 font-medium">New</th>
                      <th className="text-right px-3 py-2 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isSubtotalEdit && groupedPreviewItems ? (
                      // Grouped view for subtotal
                      Array.from(groupedPreviewItems.entries()).map(([category, items]) => (
                        <React.Fragment key={category}>
                          {items.map((item, idx) => (
                            <tr key={item.index} className={cn(idx % 2 === 0 && "bg-muted/30")}>
                              {idx === 0 && (
                                <td 
                                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground align-top"
                                  rowSpan={items.length}
                                >
                                  {category}
                                </td>
                              )}
                              <td className="px-3 py-1.5 truncate max-w-[180px]" title={item.workItem}>
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
                        </React.Fragment>
                      ))
                    ) : (
                      // Flat view for category edit
                      previewItems.map((item, idx) => (
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
                      ))
                    )}
                  </tbody>
                </table>
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
          <Button onClick={handleApply} disabled={!hasChanges}>
            Apply Allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
