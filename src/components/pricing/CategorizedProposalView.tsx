import { useMemo, useState, useCallback } from 'react';
import { Loader2, Wand2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DraftProposalItem, BUDGET_CATEGORIES, ProposalPhase } from '@/lib/hooks/usePricingProposals';
import { CategoryFeeAllocationDialog } from './CategoryFeeAllocationDialog';
import { calculateFeeRange } from '@/lib/feeSpreadUtils';
type BudgetCategory = typeof BUDGET_CATEGORIES[number];

// Category color maps for summary boxes
const categoryBgColors: Record<BudgetCategory, string> = {
  'Due Diligence': 'bg-blue-100 dark:bg-blue-900/40',
  'Documentation': 'bg-purple-100 dark:bg-purple-900/40',
  'Negotiations': 'bg-amber-100 dark:bg-amber-900/40',
  'Meetings': 'bg-green-100 dark:bg-green-900/40',
  'Regulatory': 'bg-red-100 dark:bg-red-900/40',
  'Closing': 'bg-teal-100 dark:bg-teal-900/40',
  'Tax': 'bg-orange-100 dark:bg-orange-900/40',
  'Legal Opinions': 'bg-indigo-100 dark:bg-indigo-900/40',
  'Other': 'bg-gray-100 dark:bg-gray-800/50',
};

const categoryTextColors: Record<BudgetCategory, string> = {
  'Due Diligence': 'text-blue-700 dark:text-blue-300',
  'Documentation': 'text-purple-700 dark:text-purple-300',
  'Negotiations': 'text-amber-700 dark:text-amber-300',
  'Meetings': 'text-green-700 dark:text-green-300',
  'Regulatory': 'text-red-700 dark:text-red-300',
  'Closing': 'text-teal-700 dark:text-teal-300',
  'Tax': 'text-orange-700 dark:text-orange-300',
  'Legal Opinions': 'text-indigo-700 dark:text-indigo-300',
  'Other': 'text-gray-700 dark:text-gray-300',
};

const categoryBorderColors: Record<BudgetCategory, string> = {
  'Due Diligence': 'border-blue-300 dark:border-blue-700',
  'Documentation': 'border-purple-300 dark:border-purple-700',
  'Negotiations': 'border-amber-300 dark:border-amber-700',
  'Meetings': 'border-green-300 dark:border-green-700',
  'Regulatory': 'border-red-300 dark:border-red-700',
  'Closing': 'border-teal-300 dark:border-teal-700',
  'Tax': 'border-orange-300 dark:border-orange-700',
  'Legal Opinions': 'border-indigo-300 dark:border-indigo-700',
  'Other': 'border-gray-300 dark:border-gray-600',
};

interface CategorizedProposalViewProps {
  items: DraftProposalItem[];
  phases: ProposalPhase[];
  onItemsChange: (items: DraftProposalItem[]) => void;
  formatCurrency: (value: number) => string;
  currencySymbol: string;
  customCategories?: string[];
  onNavigateToCategory?: (phaseId: string | null, category: string) => void;
}

// Helper function to calculate category totals from a list of items using fee_upper
function calculateCategoryTotals(
  items: DraftProposalItem[],
  allCategories: string[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  
  // Initialize all known categories
  allCategories.forEach(category => {
    totals[category] = 0;
  });
  
  items.forEach(item => {
    const category = item.category || 'Other';
    const isIncluded = !item.is_optional || (item.is_optional && item.is_included !== false);
    if (isIncluded) {
      // Ensure category exists in totals
      if (totals[category] === undefined) {
        totals[category] = 0;
      }
      // Use fee_upper for upper estimate pricing
      totals[category] += item.fee_upper ?? item.fee_amount ?? 0;
    }
  });
  
  return totals;
}

// Get items by phase and category with their original indices
function getItemsForPhaseCategory(
  items: DraftProposalItem[],
  phaseId: string | null,
  category: string | null, // null means all categories in phase (for subtotal)
  phases: ProposalPhase[]
): { index: number; workItem: string; currentFee: number; category: string }[] {
  const validPhaseIds = new Set(phases.map(p => p.id));
  
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      // Check if included
      const isIncluded = !item.is_optional || (item.is_optional && item.is_included !== false);
      if (!isIncluded) return false;
      
      // Check category match (null = all categories)
      if (category !== null) {
        const itemCategory = item.category || 'Other';
        if (itemCategory !== category) return false;
      }
      
      // Check phase match
      if (phaseId === null) {
        // Aggregate - include all
        return true;
      } else if (phaseId === 'unassigned') {
        // Unassigned items (no phase_id or orphaned phase_id)
        return !item.phase_id || !validPhaseIds.has(item.phase_id);
      } else {
        return item.phase_id === phaseId;
      }
    })
    .map(({ item, index }) => ({
      index,
      workItem: item.work_item,
      currentFee: item.fee_upper ?? item.fee_amount ?? 0,
      category: item.category || 'Other',
    }));
}

export function CategorizedProposalView({
  items,
  phases,
  onItemsChange,
  formatCurrency,
  currencySymbol,
  customCategories = [],
  onNavigateToCategory,
}: CategorizedProposalViewProps) {
  const [isCategorizing, setIsCategorizing] = useState(false);
  
  // Allocation dialog state
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // null for subtotal
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedPhaseName, setSelectedPhaseName] = useState<string | null>(null);
  const [isSubtotalEdit, setIsSubtotalEdit] = useState(false);

  // Combine standard and custom categories for display
  const allCategories = useMemo(() => {
    return [...BUDGET_CATEGORIES, ...customCategories];
  }, [customCategories]);

  // Get included phases (for determining if we show per-phase breakdowns)
  const includedPhases = useMemo(() => {
    return phases.filter(p => p.is_included);
  }, [phases]);

  // Calculate per-phase category totals
  const phaseBreakdowns = useMemo(() => {
    if (includedPhases.length <= 1) return null;
    
    return includedPhases.map(phase => {
      const phaseItems = items.filter(item => item.phase_id === phase.id);
      const totals = calculateCategoryTotals(phaseItems, allCategories);
      const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
      return { phase, totals, grandTotal };
    });
  }, [items, includedPhases, allCategories]);

  // Calculate aggregate totals (always shown)
  const categoryTotals = useMemo(() => {
    return calculateCategoryTotals(items, allCategories);
  }, [items, allCategories]);

  // Grand total
  const grandTotal = useMemo(() => {
    return Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
  }, [categoryTotals]);

  // Count uncategorized items
  const uncategorizedCount = items.filter(item => !item.category && item.work_item.trim()).length;

  // Handle tile click for navigation
  const handleTileClick = useCallback((phaseId: string | null, category: string) => {
    if (onNavigateToCategory) {
      onNavigateToCategory(phaseId, category);
    }
  }, [onNavigateToCategory]);
  
  // Handle edit click for fee allocation (category level)
  const handleEditClick = useCallback((
    e: React.MouseEvent,
    phaseId: string | null,
    phaseName: string | null,
    category: string
  ) => {
    e.stopPropagation(); // Prevent tile navigation
    setSelectedPhaseId(phaseId);
    setSelectedPhaseName(phaseName);
    setSelectedCategory(category);
    setIsSubtotalEdit(false);
    setAllocationDialogOpen(true);
  }, []);
  
  // Handle subtotal edit click (phase level - all categories)
  const handleSubtotalEditClick = useCallback((
    e: React.MouseEvent,
    phaseId: string,
    phaseName: string
  ) => {
    e.stopPropagation();
    setSelectedPhaseId(phaseId);
    setSelectedPhaseName(phaseName);
    setSelectedCategory(null); // null = all categories
    setIsSubtotalEdit(true);
    setAllocationDialogOpen(true);
  }, []);
  
  // Get affected items for the dialog
  const affectedItems = useMemo(() => {
    if (!allocationDialogOpen) return [];
    // For subtotal edit, pass null category to get all items in phase
    return getItemsForPhaseCategory(items, selectedPhaseId, selectedCategory, phases);
  }, [allocationDialogOpen, items, selectedPhaseId, selectedCategory, phases]);
  
  // Current total for selected category/subtotal
  const selectedCategoryTotal = useMemo(() => {
    return affectedItems.reduce((sum, item) => sum + item.currentFee, 0);
  }, [affectedItems]);
  
  // Apply fee allocations - now includes risk-based lower estimate calculation
  const handleApplyAllocations = useCallback((allocations: Map<number, number>) => {
    const newItems = items.map((item, index) => {
      const newFeeUpper = allocations.get(index);
      if (newFeeUpper !== undefined) {
        // Calculate fee_lower and fee_amount based on category risk
        const { fee_lower, fee_amount } = calculateFeeRange(newFeeUpper, item.category);
        return {
          ...item,
          fee_upper: newFeeUpper,
          fee_lower,
          fee_amount,
        };
      }
      return item;
    });
    onItemsChange(newItems);
    toast.success(`Allocated fees across ${allocations.size} work items`);
  }, [items, onItemsChange]);

  // Auto-categorize items using AI
  const handleAutoCategorize = async () => {
    const itemsToCategorize = items
      .map((item, index) => ({ ...item, index }))
      .filter(item => item.work_item.trim());
    
    if (itemsToCategorize.length === 0) {
      toast.info('No items to categorize');
      return;
    }

    setIsCategorizing(true);
    try {
      const response = await supabase.functions.invoke('categorize-budget-items', {
        body: { 
          items: itemsToCategorize.map(item => ({
            index: item.index,
            work_item: item.work_item
          }))
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to categorize items');
      }

      const { categorizations } = response.data;
      
      if (!categorizations || categorizations.length === 0) {
        toast.error('No categorizations returned');
        return;
      }

      // Apply categorizations
      const updatedItems = [...items];
      
      categorizations.forEach((cat: { index: number; category: string }) => {
        if (updatedItems[cat.index]) {
          updatedItems[cat.index] = { ...updatedItems[cat.index], category: cat.category };
        }
      });
      
      // Sort items by category order, uncategorized at end
      const categoryOrder = Object.fromEntries(
        BUDGET_CATEGORIES.map((cat, idx) => [cat, idx])
      );
      
      updatedItems.sort((a, b) => {
        const catA = a.category || '';
        const catB = b.category || '';
        
        // Uncategorized items go to the end
        if (!catA && catB) return 1;
        if (catA && !catB) return -1;
        if (!catA && !catB) return 0;
        
        // Sort by category order
        const orderA = categoryOrder[catA] ?? 999;
        const orderB = categoryOrder[catB] ?? 999;
        return orderA - orderB;
      });
      
      onItemsChange(updatedItems);
      toast.success(`Categorized ${categorizations.length} items`);
    } catch (error) {
      console.error('Error categorizing items:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to categorize items');
    } finally {
      setIsCategorizing(false);
    }
  };

  // Helper to render a category breakdown section
  // isAggregate = true means this is the aggregate totals row (no navigation/editing)
  const renderCategoryBreakdown = (
    totals: Record<string, number>,
    total: number,
    phaseId: string | null,
    phaseName: string | null,
    isAggregate: boolean = false
  ) => {
    const isPhaseRow = phaseId !== null && !isAggregate;
    
    return (
      <div className="space-y-2">
        {phaseName && (
          <div className="text-sm font-medium text-foreground">{phaseName}</div>
        )}
        <div className="flex flex-wrap gap-2">
          {allCategories.map(category => {
            const categoryTotal = totals[category];
            if (categoryTotal === 0) return null;
            
            // Get colors - use 'Other' colors as fallback for custom categories
            const isStandardCategory = (BUDGET_CATEGORIES as readonly string[]).includes(category);
            const bgColor = isStandardCategory ? categoryBgColors[category as BudgetCategory] : 'bg-slate-100 dark:bg-slate-800/50';
            const textColor = isStandardCategory ? categoryTextColors[category as BudgetCategory] : 'text-slate-700 dark:text-slate-300';
            const borderColor = isStandardCategory ? categoryBorderColors[category as BudgetCategory] : 'border-slate-300 dark:border-slate-600';
            
            // Aggregate row: no interactivity
            if (isAggregate) {
              return (
                <div
                  key={category}
                  className={cn(
                    'rounded-md px-3 py-2 border',
                    bgColor,
                    borderColor
                  )}
                >
                  <div className={cn('text-xs font-medium', textColor)}>
                    {category}
                  </div>
                  <div className={cn('text-sm font-semibold', textColor)}>
                    {formatCurrency(categoryTotal)}
                  </div>
                </div>
              );
            }
            
            // Phase row: navigation + edit
            return (
              <TooltipProvider key={category}>
                <div
                  className={cn(
                    'rounded-md px-3 py-2 border cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] group relative',
                    bgColor,
                    borderColor
                  )}
                  onClick={() => handleTileClick(phaseId, category)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleTileClick(phaseId, category);
                    }
                  }}
                >
                  <div className={cn('text-xs font-medium', textColor)}>
                    {category}
                  </div>
                  <div className={cn('text-sm font-semibold flex items-center gap-1', textColor)}>
                    <span>{formatCurrency(categoryTotal)}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                          onClick={(e) => handleEditClick(e, phaseId, phaseName, category)}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Adjust fee and distribute pro-rata</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </TooltipProvider>
            );
          })}
          
          {/* Phase/Section Total Box */}
          {total > 0 && (
            <TooltipProvider>
              <div className={cn(
                'rounded-md px-3 py-2 border bg-primary/10 border-primary/30',
                isPhaseRow && 'group'
              )}>
                <div className="text-xs font-medium text-primary">
                  {isAggregate ? 'Total' : 'Subtotal'}
                </div>
                <div className="text-sm font-semibold text-primary flex items-center gap-1">
                  <span>{formatCurrency(total)}</span>
                  {/* Subtotal edit button - only for phase rows */}
                  {isPhaseRow && phaseId && phaseName && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-primary/20"
                          onClick={(e) => handleSubtotalEditClick(e, phaseId, phaseName)}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Adjust phase subtotal and distribute across categories</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Auto-categorize button row */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {uncategorizedCount > 0 && (
            <span>{uncategorizedCount} item(s) need categorization</span>
          )}
          {onNavigateToCategory && (
            <span className="ml-2 text-xs">(Click a tile to navigate)</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoCategorize}
          disabled={isCategorizing || items.filter(i => i.work_item.trim()).length === 0}
        >
          {isCategorizing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Categorizing...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Auto-Categorize
            </>
          )}
        </Button>
      </div>

      {/* Per-Phase Breakdowns (if multiple phases) */}
      {phaseBreakdowns && phaseBreakdowns.length > 1 && (
        <div className="space-y-4">
          {phaseBreakdowns.map(({ phase, totals, grandTotal: phaseTotal }) => (
            <div key={phase.id}>
              {renderCategoryBreakdown(totals, phaseTotal, phase.id, phase.name, false)}
            </div>
          ))}
          
          {/* Aggregate Total - isAggregate = true (no interactivity) */}
          <div className="pt-2 border-t">
            {renderCategoryBreakdown(categoryTotals, grandTotal, null, 'Aggregate Total', true)}
          </div>
        </div>
      )}

      {/* Single breakdown (if single phase or no phases) */}
      {(!phaseBreakdowns || phaseBreakdowns.length <= 1) && (
        renderCategoryBreakdown(categoryTotals, grandTotal, null, null, false)
      )}
      
      {/* Fee Allocation Dialog */}
      <CategoryFeeAllocationDialog
        open={allocationDialogOpen}
        onOpenChange={setAllocationDialogOpen}
        categoryName={selectedCategory}
        phaseName={selectedPhaseName}
        currentTotal={selectedCategoryTotal}
        affectedItems={affectedItems}
        formatCurrency={formatCurrency}
        currencySymbol={currencySymbol}
        onApply={handleApplyAllocations}
        isSubtotalEdit={isSubtotalEdit}
      />
    </div>
  );
}

// Export category styling utilities for use in the table
export { categoryBgColors, categoryTextColors, categoryBorderColors };
export type { BudgetCategory };
