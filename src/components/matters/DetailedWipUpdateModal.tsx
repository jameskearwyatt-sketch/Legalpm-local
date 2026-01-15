import { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertTriangle, TrendingUp, Upload, Link2, X, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BudgetLineItem } from '@/lib/hooks/useBudgetVersions';
import { useDetailedWipUpdates } from '@/lib/hooks/useDetailedWipUpdates';
import { WipImportDialog } from './WipImportDialog';

interface WipLineItem {
  id: string;
  work_item: string;
  category: string | null;
  fee_amount: number;
  provider: string;
  lc_firm_name: string | null;
  wip_amount: number;
  write_off_amount: number;
}

interface CombinedGroup {
  id: string;
  itemIds: string[];
  combinedWip: number;
  combinedWriteOff: number;
}

interface DetailedWipUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineItems: BudgetLineItem[];
  matterId: string;
  formatCurrency: (value: number, currency?: string) => string;
  billingCurrency: string;
  quoteCurrency: string;
  mandatedRate: number;
  differentBillingCurrency: boolean;
}

// Round to 2 decimal places to avoid floating point issues
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

// Get health color based on WIP percentage of estimate
function getHealthColor(wipAmount: number, feeAmount: number): { bg: string; text: string; indicator: string } {
  if (feeAmount <= 0) {
    return { bg: 'bg-muted', text: 'text-muted-foreground', indicator: 'bg-muted-foreground' };
  }
  
  const percentage = (wipAmount / feeAmount) * 100;
  
  if (percentage <= 50) {
    return { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', indicator: 'bg-green-500' };
  } else if (percentage <= 70) {
    return { bg: 'bg-lime-50 dark:bg-lime-950/30', text: 'text-lime-700 dark:text-lime-400', indicator: 'bg-lime-500' };
  } else if (percentage <= 85) {
    return { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', indicator: 'bg-amber-500' };
  } else if (percentage <= 100) {
    return { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', indicator: 'bg-orange-500' };
  } else {
    return { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', indicator: 'bg-red-500' };
  }
}

function getPercentage(wipAmount: number, feeAmount: number): string {
  if (feeAmount <= 0) return '-';
  return `${Math.round((wipAmount / feeAmount) * 100)}%`;
}

export function DetailedWipUpdateModal({
  isOpen,
  onClose,
  lineItems,
  matterId,
  formatCurrency,
  billingCurrency,
  quoteCurrency,
  mandatedRate,
  differentBillingCurrency,
}: DetailedWipUpdateModalProps) {
  const { createWipUpdate } = useDetailedWipUpdates(matterId);
  const [wipItems, setWipItems] = useState<WipLineItem[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // Combined items state
  const [isCombineMode, setIsCombineMode] = useState(false);
  const [selectedForCombine, setSelectedForCombine] = useState<Set<string>>(new Set());
  const [combinedGroups, setCombinedGroups] = useState<CombinedGroup[]>([]);
  
  // Write-off mode state
  const [isWriteOffMode, setIsWriteOffMode] = useState(false);
  const [selectedForWriteOff, setSelectedForWriteOff] = useState<Set<string>>(new Set());
  const [selectedGroupsForWriteOff, setSelectedGroupsForWriteOff] = useState<Set<string>>(new Set());
  const [writeOffAmount, setWriteOffAmount] = useState<string>('');

  // Handle imported WIP matches
  const handleApplyMatches = (matches: Array<{ budget_line_item_id: string; wip_amount: number }>) => {
    setWipItems(prev =>
      prev.map(item => {
        const match = matches.find(m => m.budget_line_item_id === item.id);
        if (match) {
          return { ...item, wip_amount: roundCurrency(match.wip_amount) };
        }
        return item;
      })
    );
  };

  // Initialize WIP items from line items
  useEffect(() => {
    if (isOpen && lineItems.length > 0) {
      setWipItems(
        lineItems.map(item => ({
          id: item.id,
          work_item: item.work_item,
          category: item.category,
          fee_amount: item.fee_amount,
          provider: item.provider,
          lc_firm_name: item.lc_firm_name,
          wip_amount: roundCurrency((item as any).wip_amount || 0),
          write_off_amount: roundCurrency((item as any).wip_write_off || 0),
        }))
      );
      setHasAcknowledged(false);
      setIsCombineMode(false);
      setSelectedForCombine(new Set());
      setCombinedGroups([]);
      setIsWriteOffMode(false);
      setSelectedForWriteOff(new Set());
      setWriteOffAmount('');
    }
  }, [isOpen, lineItems]);

  const updateWipAmount = (id: string, value: string) => {
    const numValue = roundCurrency(parseFloat(value) || 0);
    setWipItems(prev =>
      prev.map(item => (item.id === id ? { ...item, wip_amount: numValue } : item))
    );
  };

  const updateWriteOffAmount = (id: string, value: string) => {
    const numValue = roundCurrency(parseFloat(value) || 0);
    setWipItems(prev =>
      prev.map(item => (item.id === id ? { ...item, write_off_amount: numValue } : item))
    );
  };


  // Toggle item selection for combining
  const toggleItemSelection = (id: string) => {
    setSelectedForCombine(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle item selection for write-off
  const toggleWriteOffSelection = (id: string) => {
    setSelectedForWriteOff(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle group selection for write-off
  const toggleGroupWriteOffSelection = (groupId: string) => {
    setSelectedGroupsForWriteOff(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Apply write-off to selected items proportionally
  const applyWriteOffToSelected = () => {
    if (selectedForWriteOff.size < 1 && selectedGroupsForWriteOff.size < 1) return;
    
    const billingValue = parseFloat(writeOffAmount) || 0;
    if (billingValue <= 0) return;
    
    // Values are stored in billing currency - no conversion needed
    
    // Collect all item IDs that should receive write-off allocation
    // This includes directly selected items AND items within selected groups
    const directlySelectedIds = Array.from(selectedForWriteOff);
    const groupItemIds: string[] = [];
    
    selectedGroupsForWriteOff.forEach(groupId => {
      const group = combinedGroups.find(g => g.id === groupId);
      if (group) {
        groupItemIds.push(...group.itemIds);
      }
    });
    
    const allAffectedIds = [...new Set([...directlySelectedIds, ...groupItemIds])];
    const affectedItems = wipItems.filter(item => allAffectedIds.includes(item.id));
    
    // For items in combined groups, use the group's combinedWip proportionally
    // For individual items, use their own wip_amount
    const itemWipValues = affectedItems.map(item => {
      const group = combinedGroups.find(g => g.itemIds.includes(item.id));
      if (group && selectedGroupsForWriteOff.has(group.id)) {
        // Calculate this item's share of the group's WIP based on fee_amount
        const groupItems = wipItems.filter(i => group.itemIds.includes(i.id));
        const totalGroupFee = groupItems.reduce((sum, i) => sum + i.fee_amount, 0);
        const itemProportion = totalGroupFee > 0 ? item.fee_amount / totalGroupFee : 1 / groupItems.length;
        return { id: item.id, wipShare: group.combinedWip * itemProportion };
      }
      return { id: item.id, wipShare: item.wip_amount };
    });
    
    const totalWip = itemWipValues.reduce((sum, item) => sum + item.wipShare, 0);
    
    // Distribute proportionally based on WIP shares (or equally if no WIP)
    setWipItems(prev =>
      prev.map(item => {
        const itemWipInfo = itemWipValues.find(i => i.id === item.id);
        if (!itemWipInfo) return item;
        
        let proportion: number;
        if (totalWip > 0) {
          proportion = itemWipInfo.wipShare / totalWip;
        } else {
          proportion = 1 / allAffectedIds.length;
        }
        
        return {
          ...item,
          write_off_amount: roundCurrency(item.write_off_amount + (billingValue * proportion)),
        };
      })
    );
    
    // Reset write-off mode
    setIsWriteOffMode(false);
    setSelectedForWriteOff(new Set());
    setSelectedGroupsForWriteOff(new Set());
    setWriteOffAmount('');
  };

  // Create a combined group from selected items
  const createCombinedGroup = () => {
    if (selectedForCombine.size < 2) return;
    
    const groupId = `group-${Date.now()}`;
    const itemIds = Array.from(selectedForCombine);
    
    // Calculate existing WIP sum and write-off sum for the combined items
    const selectedItems = wipItems.filter(item => itemIds.includes(item.id));
    const existingWipSum = selectedItems.reduce((sum, item) => sum + item.wip_amount, 0);
    const existingWriteOffSum = selectedItems.reduce((sum, item) => sum + item.write_off_amount, 0);
    
    setCombinedGroups(prev => [...prev, {
      id: groupId,
      itemIds,
      combinedWip: roundCurrency(existingWipSum),
      combinedWriteOff: roundCurrency(existingWriteOffSum),
    }]);
    
    // Clear individual WIP and write-offs for combined items
    setWipItems(prev =>
      prev.map(item => 
        itemIds.includes(item.id) ? { ...item, wip_amount: 0, write_off_amount: 0 } : item
      )
    );
    
    setSelectedForCombine(new Set());
    setIsCombineMode(false);
  };

  // Remove a combined group
  const removeCombinedGroup = (groupId: string) => {
    setCombinedGroups(prev => prev.filter(g => g.id !== groupId));
  };

  // Update combined group WIP
  const updateCombinedGroupWip = (groupId: string, value: string) => {
    const numValue = roundCurrency(parseFloat(value) || 0);
    setCombinedGroups(prev =>
      prev.map(g => g.id === groupId ? { ...g, combinedWip: numValue } : g)
    );
  };

  // Update combined group write-off
  const updateCombinedGroupWriteOff = (groupId: string, value: string) => {
    const numValue = roundCurrency(parseFloat(value) || 0);
    setCombinedGroups(prev =>
      prev.map(g => g.id === groupId ? { ...g, combinedWriteOff: numValue } : g)
    );
  };

  // Check if item is in a combined group
  const getItemCombinedGroup = (itemId: string): CombinedGroup | undefined => {
    return combinedGroups.find(g => g.itemIds.includes(itemId));
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      // Distribute combined group WIP and write-offs proportionally among items based on fee_amount
      const finalWipItems = wipItems.map(item => {
        const group = getItemCombinedGroup(item.id);
        if (group) {
          const groupItems = wipItems.filter(i => group.itemIds.includes(i.id));
          const totalFee = groupItems.reduce((sum, i) => sum + i.fee_amount, 0);
          const proportion = totalFee > 0 ? item.fee_amount / totalFee : 1 / groupItems.length;
          return {
            ...item,
            wip_amount: roundCurrency(group.combinedWip * proportion),
            write_off_amount: roundCurrency(group.combinedWriteOff * proportion),
          };
        }
        return item;
      });

      await createWipUpdate.mutateAsync({
        matterId,
        wipItems: finalWipItems.map(item => ({
          budget_line_item_id: item.id,
          work_item: item.work_item,
          provider: item.provider,
          category: item.category,
          lc_firm_name: item.lc_firm_name,
          fee_amount: item.fee_amount,
          wip_amount: item.wip_amount,
          write_off_amount: item.write_off_amount,
        })),
      });
      onClose();
    } catch (error) {
      console.error('Error finalizing WIP update:', error);
    } finally {
      setIsFinalizing(false);
    }
  };

  // Calculate totals - convert to billing currency if needed
  const totalEstimateQuote = wipItems.reduce((sum, item) => sum + item.fee_amount, 0);
  const individualWipQuote = wipItems.reduce((sum, item) => {
    if (getItemCombinedGroup(item.id)) return sum; // Skip items in groups
    return sum + item.wip_amount;
  }, 0);
  const combinedWipQuote = combinedGroups.reduce((sum, g) => sum + g.combinedWip, 0);
  const totalWipQuote = individualWipQuote + combinedWipQuote;
  
  // Calculate write-off totals
  const individualWriteOffQuote = wipItems.reduce((sum, item) => {
    if (getItemCombinedGroup(item.id)) return sum; // Skip items in groups
    return sum + item.write_off_amount;
  }, 0);
  const combinedWriteOffQuote = combinedGroups.reduce((sum, g) => sum + g.combinedWriteOff, 0);
  const totalWriteOffQuote = individualWriteOffQuote + combinedWriteOffQuote;
  
  // All values are already stored in billing currency - no conversion needed for display
  const totalEstimate = roundCurrency(totalEstimateQuote);
  const totalWip = roundCurrency(totalWipQuote);
  const totalWriteOff = roundCurrency(totalWriteOffQuote);
  const overallHealth = getHealthColor(totalWip, totalEstimate);

  // Group items by category
  const groupedItems = wipItems.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, WipLineItem[]>);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Detailed Budget Utilisation Update
          </DialogTitle>
          <DialogDescription>
            Update the budget utilisation for each budget line item
          </DialogDescription>
        </DialogHeader>

        {/* Health Warning */}
        {!hasAcknowledged && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              <p className="font-medium mb-1">Important: Complete WIP Update Required</p>
              <p className="text-sm">
                For accurate financial tracking, you must update the WIP for <strong>all</strong> line items.
                Updating only some items will result in an inaccurate aggregate WIP figure.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-amber-500 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                onClick={() => setHasAcknowledged(true)}
              >
                I understand, proceed
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {hasAcknowledged && (
          <>
            {/* Action Buttons */}
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {!isCombineMode && !isWriteOffMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCombineMode(true)}
                      className="flex items-center gap-2"
                    >
                      <Link2 className="h-4 w-4" />
                      Combine Items
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsWriteOffMode(true)}
                      className="flex items-center gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                      <MinusCircle className="h-4 w-4" />
                      Write-off Multiple Items
                    </Button>
                  </>
                ) : isCombineMode ? (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={createCombinedGroup}
                      disabled={selectedForCombine.size < 2}
                    >
                      Combine Selected ({selectedForCombine.size})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCombineMode(false);
                        setSelectedForCombine(new Set());
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-destructive">Write-off amount ({billingCurrency}):</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={writeOffAmount}
                        onChange={e => setWriteOffAmount(e.target.value)}
                        className="h-8 w-28 text-sm border-destructive/50"
                        placeholder="0"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={applyWriteOffToSelected}
                      disabled={(selectedForWriteOff.size < 1 && selectedGroupsForWriteOff.size < 1) || !writeOffAmount || parseFloat(writeOffAmount) <= 0}
                    >
                      Apply to {selectedForWriteOff.size + selectedGroupsForWriteOff.size} item{(selectedForWriteOff.size + selectedGroupsForWriteOff.size) !== 1 ? 's' : ''}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsWriteOffMode(false);
                        setSelectedForWriteOff(new Set());
                        setSelectedGroupsForWriteOff(new Set());
                        setWriteOffAmount('');
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => setShowImportDialog(true)}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload or Paste
              </Button>
            </div>

            {isCombineMode && (
              <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/30">
                <Link2 className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-300">
                  <p className="text-sm">
                    Select 2 or more budget items to combine them. WIP will be entered once for the combined items 
                    and distributed proportionally based on each item's budget allocation.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {isWriteOffMode && (
              <Alert className="border-destructive/50 bg-red-50 dark:bg-red-950/30">
                <MinusCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-red-800 dark:text-red-300">
                  <p className="text-sm">
                    Select budget items to write off WIP against. Enter the total write-off amount above, and it will be 
                    distributed proportionally based on each item's current WIP (or equally if no WIP).
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Combined Groups Display */}
            {combinedGroups.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Combined WIP Entries</Label>
                {combinedGroups.map(group => {
                  const groupItems = wipItems.filter(i => group.itemIds.includes(i.id));
                  const groupTotalFee = groupItems.reduce((sum, i) => sum + i.fee_amount, 0);
                  // All values are stored in billing currency - no conversion needed
                  const displayFee = roundCurrency(groupTotalFee);
                  const displayWip = roundCurrency(group.combinedWip);
                  const groupHealth = getHealthColor(displayWip, displayFee);
                  
                  const isGroupSelectedForWriteOff = selectedGroupsForWriteOff.has(group.id);
                  
                  return (
                    <div key={group.id} className={cn(
                      'rounded-lg border p-3', 
                      groupHealth.bg,
                      isGroupSelectedForWriteOff && 'ring-2 ring-inset ring-destructive'
                    )}>
                      <div className="flex items-start gap-3">
                        {/* Checkbox for write-off mode */}
                        {isWriteOffMode && (
                          <Checkbox
                            checked={isGroupSelectedForWriteOff}
                            onCheckedChange={() => toggleGroupWriteOffSelection(group.id)}
                            className="flex-shrink-0 mt-1 border-destructive data-[state=checked]:bg-destructive"
                          />
                        )}
                        <div className={cn('w-3 h-3 rounded-full flex-shrink-0 mt-1', groupHealth.indicator)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Combined Entry ({groupItems.length} items)</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCombinedGroup(group.id)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <ul className="text-xs text-muted-foreground space-y-0.5 mb-2">
                            {groupItems.map(item => (
                              <li key={item.id}>• {item.work_item}</li>
                            ))}
                          </ul>
                          <div className="flex items-center gap-4 flex-wrap">
                            <div>
                              <Label className="text-xs text-muted-foreground">Combined Estimate</Label>
                              <p className="text-sm font-medium">{formatCurrency(displayFee, billingCurrency)}</p>
                            </div>
                            <div className="flex-shrink-0 w-28">
                              <Label className="text-xs text-muted-foreground">WIP ({billingCurrency})</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                              value={roundCurrency(displayWip) || ''}
                              onChange={e => {
                                // Values are stored in billing currency - no conversion needed
                                const billingValue = parseFloat(e.target.value) || 0;
                                updateCombinedGroupWip(group.id, billingValue.toString());
                              }}
                                className="h-8 text-sm"
                                placeholder="0"
                              />
                            </div>
                            <div className="flex-shrink-0 w-28">
                              <Label className="text-xs text-destructive flex items-center gap-1">
                                <MinusCircle className="h-3 w-3" />
                                Write-off
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={roundCurrency(group.combinedWriteOff) || ''}
                                onChange={e => {
                                  // Values are stored in billing currency - no conversion needed
                                  const billingValue = parseFloat(e.target.value) || 0;
                                  updateCombinedGroupWriteOff(group.id, billingValue.toString());
                                }}
                                className="h-8 text-sm border-destructive/50 text-destructive"
                                placeholder="0"
                              />
                            </div>
                            <div className={cn('font-bold', groupHealth.text)}>
                              {getPercentage(displayWip, displayFee)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Overall Summary */}
            <div className={cn('rounded-lg p-4 border', overallHealth.bg)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium', overallHealth.text)}>Overall Progress</p>
                  <p className={cn('text-2xl font-bold', overallHealth.text)}>
                    {formatCurrency(totalWip, billingCurrency)} / {formatCurrency(totalEstimate, billingCurrency)}
                  </p>
                  {totalWriteOff > 0 && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <MinusCircle className="h-3 w-3" />
                      Write-off: {formatCurrency(totalWriteOff, billingCurrency)}
                    </p>
                  )}
                  {differentBillingCurrency && (
                    <p className="text-xs text-muted-foreground mt-1">
                      All values shown in {billingCurrency} (billing currency)
                    </p>
                  )}
                </div>
                <div className={cn('text-3xl font-bold', overallHealth.text)}>
                  {getPercentage(totalWip, totalEstimate)}
                </div>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full transition-all duration-300', overallHealth.indicator)}
                  style={{ width: `${Math.min((totalWip / totalEstimate) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Line Items by Category */}
            <div className="space-y-4 mt-4">
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 font-medium text-sm">
                    {category}
                  </div>
                  <div className="divide-y">
                    {items.map(item => {
                      const combinedGroup = getItemCombinedGroup(item.id);
                      const isInCombinedGroup = !!combinedGroup;
                      const isSelected = selectedForCombine.has(item.id);
                      const isSelectedForWriteOff = selectedForWriteOff.has(item.id);
                      
                      // All values are stored in billing currency - no conversion needed
                      const displayFeeAmount = roundCurrency(item.fee_amount);
                      const displayWipAmount = roundCurrency(item.wip_amount);
                      const displayWriteOffAmount = roundCurrency(item.write_off_amount);
                      const health = isInCombinedGroup 
                        ? { bg: 'bg-blue-50/50 dark:bg-blue-950/20', text: 'text-blue-600', indicator: 'bg-blue-400' }
                        : getHealthColor(displayWipAmount, displayFeeAmount);
                      
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'px-4 py-3 flex items-center gap-4',
                            health.bg,
                            isSelected && 'ring-2 ring-inset ring-primary',
                            isSelectedForWriteOff && 'ring-2 ring-inset ring-destructive'
                          )}
                        >
                          {/* Checkbox for combine mode */}
                          {isCombineMode && !isInCombinedGroup && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleItemSelection(item.id)}
                              className="flex-shrink-0"
                            />
                          )}
                          
                          {/* Checkbox for write-off mode */}
                          {isWriteOffMode && !isInCombinedGroup && (
                            <Checkbox
                              checked={isSelectedForWriteOff}
                              onCheckedChange={() => toggleWriteOffSelection(item.id)}
                              className="flex-shrink-0 border-destructive data-[state=checked]:bg-destructive"
                            />
                          )}
                          
                          {/* Health indicator dot */}
                          <div className={cn('w-3 h-3 rounded-full flex-shrink-0', health.indicator)} />
                          
                          {/* Work item description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.work_item}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.provider === 'Local Counsel' && item.lc_firm_name
                                ? item.lc_firm_name
                                : item.provider}
                            </p>
                            {isInCombinedGroup && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                Part of combined entry
                              </p>
                            )}
                          </div>
                          
                          {/* Estimate - in billing currency */}
                          <div className="text-right flex-shrink-0 w-24">
                            <Label className="text-xs text-muted-foreground">Estimate</Label>
                            <p className="text-sm font-medium">{formatCurrency(displayFeeAmount, billingCurrency)}</p>
                          </div>
                          
                          {/* WIP Input - in billing currency (disabled if in combined group) */}
                          <div className="flex-shrink-0 w-28">
                            <Label className="text-xs text-muted-foreground">WIP ({billingCurrency})</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={isInCombinedGroup ? '' : (displayWipAmount || '')}
                              onChange={e => {
                                // Values are stored in billing currency - no conversion needed
                                const billingValue = parseFloat(e.target.value) || 0;
                                updateWipAmount(item.id, billingValue.toString());
                              }}
                              className="h-8 text-sm"
                              placeholder={isInCombinedGroup ? 'Combined' : '0'}
                              disabled={isInCombinedGroup}
                            />
                          </div>
                          
                          {/* Write-off Input */}
                          <div className="flex-shrink-0 w-28">
                            <Label className="text-xs text-destructive flex items-center gap-1">
                              <MinusCircle className="h-3 w-3" />
                              Write-off
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={isInCombinedGroup ? '' : (displayWriteOffAmount || '')}
                              onChange={e => {
                                // Values are stored in billing currency - no conversion needed
                                const billingValue = parseFloat(e.target.value) || 0;
                                updateWriteOffAmount(item.id, billingValue.toString());
                              }}
                              className="h-8 text-sm border-destructive/50 text-destructive"
                              placeholder={isInCombinedGroup ? 'Combined' : '0'}
                              disabled={isInCombinedGroup}
                            />
                          </div>
                          
                          {/* Percentage */}
                          <div className={cn('w-14 text-right font-bold', health.text)}>
                            {isInCombinedGroup ? '-' : getPercentage(displayWipAmount, displayFeeAmount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isFinalizing}>
            Cancel
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={isFinalizing || !hasAcknowledged}
          >
            {isFinalizing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Finalize WIP Update'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Import Dialog */}
      <WipImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onApplyMatches={handleApplyMatches}
        budgetLineItems={wipItems}
        currency={billingCurrency}
        formatCurrency={formatCurrency}
      />
    </Dialog>
  );
}
