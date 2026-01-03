import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BudgetLineItem {
  id: string;
  work_item: string;
  fee_amount: number;
  category: string | null;
  provider: string;
  sort_order: number;
}

interface WorkItemAllocation {
  id: string;
  name: string;
  hours: number;
}

interface WorkItemAllocatorProps {
  budgetItems: BudgetLineItem[];
  totalHours: number;
  allocations: WorkItemAllocation[];
  onAllocationsChange: (allocations: WorkItemAllocation[]) => void;
  className?: string;
}

export function WorkItemAllocator({
  budgetItems,
  totalHours,
  allocations,
  onAllocationsChange,
  className,
}: WorkItemAllocatorProps) {
  // Track which items are locked
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  // Get IDs of selected items
  const selectedIds = useMemo(() => new Set(allocations.map(a => a.id)), [allocations]);

  // Sort items: selected first (grouped by category in budget order), then rest (grouped by category in budget order)
  const sortedItems = useMemo(() => {
    // Build category order from original budget items (first occurrence determines order)
    const categoryOrder: string[] = [];
    budgetItems.forEach(item => {
      const cat = item.category || '';
      if (!categoryOrder.includes(cat)) {
        categoryOrder.push(cat);
      }
    });
    
    // Sort function that uses category order from budget, then sort_order within category
    const sortByBudgetOrder = (a: BudgetLineItem, b: BudgetLineItem) => {
      const catA = a.category || '';
      const catB = b.category || '';
      if (catA !== catB) {
        return categoryOrder.indexOf(catA) - categoryOrder.indexOf(catB);
      }
      return a.sort_order - b.sort_order;
    };
    
    const selected = budgetItems.filter(item => selectedIds.has(item.id)).sort(sortByBudgetOrder);
    const unselected = budgetItems.filter(item => !selectedIds.has(item.id)).sort(sortByBudgetOrder);
    return [...selected, ...unselected];
  }, [budgetItems, selectedIds]);

  // Toggle lock state for an item
  const toggleLock = (itemId: string) => {
    setLockedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Toggle selection of a work item
  const toggleSelection = (item: BudgetLineItem) => {
    if (selectedIds.has(item.id)) {
      // Remove from allocations and unlock
      const newAllocations = allocations.filter(a => a.id !== item.id);
      setLockedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
      // Redistribute hours among remaining unlocked items
      if (newAllocations.length > 0) {
        const redistributed = redistributeHours(newAllocations, totalHours, lockedIds);
        onAllocationsChange(redistributed);
      } else {
        onAllocationsChange([]);
      }
    } else {
      // Add to allocations with 0 hours initially
      const newAllocations = [...allocations, { id: item.id, name: item.work_item, hours: 0 }];
      // Redistribute hours among unlocked items
      const redistributed = redistributeHours(newAllocations, totalHours, lockedIds);
      onAllocationsChange(redistributed);
    }
  };

  // Redistribute hours evenly among unlocked items
  const redistributeHours = (items: WorkItemAllocation[], total: number, locked: Set<string>): WorkItemAllocation[] => {
    if (items.length === 0) return [];
    
    // Calculate locked total
    const lockedTotal = items.filter(a => locked.has(a.id)).reduce((sum, a) => sum + a.hours, 0);
    const remainingForUnlocked = total - lockedTotal;
    
    const unlockedItems = items.filter(a => !locked.has(a.id));
    
    if (unlockedItems.length === 0) {
      return items; // All locked, can't redistribute
    }
    
    const equalShare = remainingForUnlocked / unlockedItems.length;
    const roundedShare = roundToQuarter(equalShare);
    
    let allocated = 0;
    const unlockedUpdated = unlockedItems.map((item, index) => {
      if (index === unlockedItems.length - 1) {
        const remaining = roundToQuarter(remainingForUnlocked - allocated);
        return { ...item, hours: Math.max(0, remaining) };
      }
      allocated += roundedShare;
      return { ...item, hours: Math.max(0, roundedShare) };
    });
    
    // Merge back locked and unlocked
    return items.map(item => {
      if (locked.has(item.id)) return item;
      const updated = unlockedUpdated.find(u => u.id === item.id);
      return updated || item;
    });
  };

  // Round to nearest 0.25
  const roundToQuarter = (value: number): number => {
    return Math.round(value * 4) / 4;
  };

  // Calculate max hours available for unlocked sliders
  const getMaxForUnlocked = (itemId: string): number => {
    const lockedTotal = allocations
      .filter(a => lockedIds.has(a.id) && a.id !== itemId)
      .reduce((sum, a) => sum + a.hours, 0);
    return Math.max(0, totalHours - lockedTotal);
  };

  // Handle slider change - auto-balance only unlocked sliders
  const handleSliderChange = (itemId: string, newHours: number) => {
    const isLocked = lockedIds.has(itemId);
    const maxAllowed = getMaxForUnlocked(itemId);
    const clampedHours = Math.min(newHours, maxAllowed);
    const roundedNewHours = roundToQuarter(clampedHours);
    
    const currentItem = allocations.find(a => a.id === itemId);
    if (!currentItem) return;

    // Get other allocations (excluding current)
    const otherAllocations = allocations.filter(a => a.id !== itemId);
    
    // Separate locked and unlocked others
    const lockedOthers = otherAllocations.filter(a => lockedIds.has(a.id));
    const unlockedOthers = otherAllocations.filter(a => !lockedIds.has(a.id));
    
    if (unlockedOthers.length === 0 && !isLocked) {
      // Only this item is unlocked, set it to remaining after locked
      const lockedTotal = lockedOthers.reduce((sum, a) => sum + a.hours, 0);
      onAllocationsChange([
        ...lockedOthers,
        { ...currentItem, hours: roundToQuarter(totalHours - lockedTotal) }
      ]);
      return;
    }

    // Calculate locked total (excluding current if it's locked)
    const lockedTotal = lockedOthers.reduce((sum, a) => sum + a.hours, 0);
    
    // Calculate how much is left for unlocked others
    const remainingForUnlockedOthers = totalHours - lockedTotal - roundedNewHours;
    
    // Get current total of unlocked others
    const currentUnlockedOthersTotal = unlockedOthers.reduce((sum, a) => sum + a.hours, 0);
    
    let scaledUnlockedOthers: WorkItemAllocation[];
    
    if (remainingForUnlockedOthers <= 0) {
      // Set all unlocked others to 0
      scaledUnlockedOthers = unlockedOthers.map(a => ({ ...a, hours: 0 }));
    } else if (currentUnlockedOthersTotal === 0) {
      // Distribute equally among unlocked others
      const equalShare = remainingForUnlockedOthers / unlockedOthers.length;
      let allocated = 0;
      scaledUnlockedOthers = unlockedOthers.map((a, index) => {
        if (index === unlockedOthers.length - 1) {
          return { ...a, hours: roundToQuarter(remainingForUnlockedOthers - allocated) };
        }
        const share = roundToQuarter(equalShare);
        allocated += share;
        return { ...a, hours: share };
      });
    } else {
      // Scale proportionally
      const scale = remainingForUnlockedOthers / currentUnlockedOthersTotal;
      let allocated = 0;
      scaledUnlockedOthers = unlockedOthers.map((a, index) => {
        if (index === unlockedOthers.length - 1) {
          return { ...a, hours: roundToQuarter(remainingForUnlockedOthers - allocated) };
        }
        const newH = roundToQuarter(a.hours * scale);
        allocated += newH;
        return { ...a, hours: newH };
      });
    }

    // Reconstruct in original order
    const updatedAllocations = allocations.map(a => {
      if (a.id === itemId) return { ...a, hours: roundedNewHours };
      if (lockedIds.has(a.id)) return a; // Keep locked as-is
      const scaled = scaledUnlockedOthers.find(s => s.id === a.id);
      return scaled || a;
    });

    onAllocationsChange(updatedAllocations);
  };

  // Get allocation for an item
  const getAllocation = (itemId: string): WorkItemAllocation | undefined => {
    return allocations.find(a => a.id === itemId);
  };

  // Calculate if allocations sum to total (for validation display)
  const allocationTotal = allocations.reduce((sum, a) => sum + a.hours, 0);
  const isBalanced = Math.abs(allocationTotal - totalHours) < 0.01;
  const lockedCount = allocations.filter(a => lockedIds.has(a.id)).length;

  if (budgetItems.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No budget items found for this matter
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Summary badge */}
      {allocations.length > 0 && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Badge variant={isBalanced ? "default" : "destructive"} className="text-xs">
            {allocationTotal.toFixed(2)}h / {totalHours.toFixed(2)}h allocated
          </Badge>
          <span className="text-muted-foreground">
            {allocations.length} work item{allocations.length !== 1 ? 's' : ''} selected
          </span>
          {lockedCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              {lockedCount} locked
            </Badge>
          )}
        </div>
      )}

      {/* Scrollable list */}
      <div className="max-h-64 overflow-y-auto border rounded-md">
        <div className="p-2 space-y-1">
          {sortedItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const allocation = getAllocation(item.id);
            const isLocked = lockedIds.has(item.id);
            
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-md p-2 transition-all",
                  isSelected 
                    ? isLocked
                      ? "bg-amber-500/10 border border-amber-500/30"
                      : "bg-primary/10 border border-primary/30" 
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelection(item)}
                    className="mt-0.5"
                  />
                  
                  {/* Work item info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm truncate",
                        isSelected && !isLocked && "text-primary",
                        isLocked && "text-amber-600 dark:text-amber-400"
                      )}>
                        {item.work_item}
                      </span>
                      {item.category && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {item.category}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Slider for selected items */}
                    {isSelected && allocation && totalHours > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <Slider
                          value={[allocation.hours]}
                          min={0}
                          max={isLocked ? totalHours : getMaxForUnlocked(item.id)}
                          step={0.25}
                          onValueChange={([value]) => handleSliderChange(item.id, value)}
                          className={cn("flex-1", isLocked && "opacity-50")}
                          disabled={isLocked}
                        />
                        <span className={cn(
                          "text-sm font-mono w-14 text-right",
                          isLocked && "text-amber-600 dark:text-amber-400"
                        )}>
                          {allocation.hours.toFixed(2)}h
                        </span>
                        <Button
                          type="button"
                          variant={isLocked ? "secondary" : "ghost"}
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => toggleLock(item.id)}
                          title={isLocked ? "Unlock" : "Lock"}
                        >
                          {isLocked ? (
                            <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warning if no items selected but hours entered */}
      {allocations.length === 0 && totalHours > 0 && (
        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          ⚠️ Select at least one work item to allocate hours
        </div>
      )}
    </div>
  );
}
