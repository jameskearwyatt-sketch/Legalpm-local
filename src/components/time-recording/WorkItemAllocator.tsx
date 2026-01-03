import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BudgetLineItem {
  id: string;
  work_item: string;
  fee_amount: number;
  category: string | null;
  provider: string;
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
  // Get IDs of selected items
  const selectedIds = useMemo(() => new Set(allocations.map(a => a.id)), [allocations]);

  // Sort items: selected first, then rest
  const sortedItems = useMemo(() => {
    const selected = budgetItems.filter(item => selectedIds.has(item.id));
    const unselected = budgetItems.filter(item => !selectedIds.has(item.id));
    return [...selected, ...unselected];
  }, [budgetItems, selectedIds]);

  // Toggle selection of a work item
  const toggleSelection = (item: BudgetLineItem) => {
    if (selectedIds.has(item.id)) {
      // Remove from allocations
      const newAllocations = allocations.filter(a => a.id !== item.id);
      // Redistribute hours among remaining items
      if (newAllocations.length > 0) {
        const redistributed = redistributeHours(newAllocations, totalHours);
        onAllocationsChange(redistributed);
      } else {
        onAllocationsChange([]);
      }
    } else {
      // Add to allocations with 0 hours initially
      const newAllocations = [...allocations, { id: item.id, name: item.work_item, hours: 0 }];
      // Redistribute hours
      const redistributed = redistributeHours(newAllocations, totalHours);
      onAllocationsChange(redistributed);
    }
  };

  // Redistribute hours evenly among all selected items
  const redistributeHours = (items: WorkItemAllocation[], total: number): WorkItemAllocation[] => {
    if (items.length === 0) return [];
    
    const equalShare = total / items.length;
    const roundedShare = roundToQuarter(equalShare);
    
    let allocated = 0;
    return items.map((item, index) => {
      if (index === items.length - 1) {
        // Last item gets remainder
        const remaining = roundToQuarter(total - allocated);
        return { ...item, hours: Math.max(0, remaining) };
      }
      allocated += roundedShare;
      return { ...item, hours: roundedShare };
    });
  };

  // Round to nearest 0.25
  const roundToQuarter = (value: number): number => {
    return Math.round(value * 4) / 4;
  };

  // Handle slider change - auto-balance other sliders
  const handleSliderChange = (itemId: string, newHours: number) => {
    const roundedNewHours = roundToQuarter(newHours);
    const currentItem = allocations.find(a => a.id === itemId);
    if (!currentItem) return;

    const otherAllocations = allocations.filter(a => a.id !== itemId);
    if (otherAllocations.length === 0) {
      // Only one item, just set its hours to total
      onAllocationsChange([{ ...currentItem, hours: totalHours }]);
      return;
    }

    // Calculate how much is left for others
    const remainingForOthers = totalHours - roundedNewHours;
    
    // Get current total of others
    const currentOthersTotal = otherAllocations.reduce((sum, a) => sum + a.hours, 0);
    
    if (remainingForOthers <= 0) {
      // Set current item to total, others to 0
      onAllocationsChange([
        { ...currentItem, hours: totalHours },
        ...otherAllocations.map(a => ({ ...a, hours: 0 }))
      ]);
      return;
    }

    // Scale other allocations proportionally
    let scaledOthers: WorkItemAllocation[];
    if (currentOthersTotal === 0) {
      // Distribute equally among others
      const equalShare = remainingForOthers / otherAllocations.length;
      scaledOthers = otherAllocations.map((a, index) => {
        if (index === otherAllocations.length - 1) {
          const allocated = roundToQuarter(equalShare) * (otherAllocations.length - 1);
          return { ...a, hours: roundToQuarter(remainingForOthers - allocated) };
        }
        return { ...a, hours: roundToQuarter(equalShare) };
      });
    } else {
      // Scale proportionally
      const scale = remainingForOthers / currentOthersTotal;
      let allocated = 0;
      scaledOthers = otherAllocations.map((a, index) => {
        if (index === otherAllocations.length - 1) {
          // Last one gets remainder to ensure exact total
          return { ...a, hours: roundToQuarter(remainingForOthers - allocated) };
        }
        const newH = roundToQuarter(a.hours * scale);
        allocated += newH;
        return { ...a, hours: newH };
      });
    }

    // Reconstruct in original order
    const updatedAllocations = allocations.map(a => {
      if (a.id === itemId) return { ...a, hours: roundedNewHours };
      const scaled = scaledOthers.find(s => s.id === a.id);
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
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={isBalanced ? "default" : "destructive"} className="text-xs">
            {allocationTotal.toFixed(2)}h / {totalHours.toFixed(2)}h allocated
          </Badge>
          <span className="text-muted-foreground">
            {allocations.length} work item{allocations.length !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}

      {/* Scrollable list */}
      <div className="max-h-64 overflow-y-auto border rounded-md">
        <div className="p-2 space-y-1">
          {sortedItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const allocation = getAllocation(item.id);
            
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-md p-2 transition-all",
                  isSelected 
                    ? "bg-primary/10 border border-primary/30" 
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
                        isSelected && "text-primary"
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
                      <div className="mt-2 flex items-center gap-3">
                        <Slider
                          value={[allocation.hours]}
                          min={0}
                          max={totalHours}
                          step={0.25}
                          onValueChange={([value]) => handleSliderChange(item.id, value)}
                          className="flex-1"
                        />
                        <span className="text-sm font-mono w-14 text-right">
                          {allocation.hours.toFixed(2)}h
                        </span>
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
