import { useMemo, useState, useCallback } from 'react';
import { Loader2, Wand2, Pencil, HelpCircle, Lock, LockOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
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
  'Term Sheets': 'bg-cyan-100 dark:bg-cyan-900/40',
  'Documentation': 'bg-purple-100 dark:bg-purple-900/40',
  'Regulatory': 'bg-red-100 dark:bg-red-900/40',
  'Tax': 'bg-orange-100 dark:bg-orange-900/40',
  'Legal Opinions': 'bg-indigo-100 dark:bg-indigo-900/40',
  'Structuring Advice': 'bg-rose-100 dark:bg-rose-900/40',
  'Negotiations': 'bg-amber-100 dark:bg-amber-900/40',
  'Meetings': 'bg-green-100 dark:bg-green-900/40',
  'Closing': 'bg-teal-100 dark:bg-teal-900/40',
  'Other': 'bg-gray-100 dark:bg-gray-800/50',
};

const categoryTextColors: Record<BudgetCategory, string> = {
  'Due Diligence': 'text-blue-700 dark:text-blue-300',
  'Term Sheets': 'text-cyan-700 dark:text-cyan-300',
  'Documentation': 'text-purple-700 dark:text-purple-300',
  'Regulatory': 'text-red-700 dark:text-red-300',
  'Tax': 'text-orange-700 dark:text-orange-300',
  'Legal Opinions': 'text-indigo-700 dark:text-indigo-300',
  'Structuring Advice': 'text-rose-700 dark:text-rose-300',
  'Negotiations': 'text-amber-700 dark:text-amber-300',
  'Meetings': 'text-green-700 dark:text-green-300',
  'Closing': 'text-teal-700 dark:text-teal-300',
  'Other': 'text-gray-700 dark:text-gray-300',
};

const categoryBorderColors: Record<BudgetCategory, string> = {
  'Due Diligence': 'border-blue-300 dark:border-blue-700',
  'Term Sheets': 'border-cyan-300 dark:border-cyan-700',
  'Documentation': 'border-purple-300 dark:border-purple-700',
  'Regulatory': 'border-red-300 dark:border-red-700',
  'Tax': 'border-orange-300 dark:border-orange-700',
  'Legal Opinions': 'border-indigo-300 dark:border-indigo-700',
  'Structuring Advice': 'border-rose-300 dark:border-rose-700',
  'Negotiations': 'border-amber-300 dark:border-amber-700',
  'Meetings': 'border-green-300 dark:border-green-700',
  'Closing': 'border-teal-300 dark:border-teal-700',
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
  showAssumptionsNotTrue?: boolean;
  onToggleAssumptionsNotTrue?: (value: boolean) => void;
  lockedCategories?: Set<string>;
  onToggleLock?: (key: string) => void;
}

// Helper to get fee_upper from item
function getFeeUpper(item: DraftProposalItem): number {
  return item.fee_upper ?? item.fee_amount ?? 0;
}

// Helper function to calculate category totals from a list of items using fee_upper
function calculateCategoryTotals(
  items: DraftProposalItem[],
  allCategories: string[],
  useAltEstimates: boolean = false
): Record<string, number> {
  const totals: Record<string, number> = {};
  
  // Initialize all known categories
  allCategories.forEach(category => {
    totals[category] = 0;
  });
  
  items.forEach(item => {
    const category = item.category || 'Other';
    const isIncluded = item.is_included !== false;
    if (isIncluded) {
      if (totals[category] === undefined) {
        totals[category] = 0;
      }
      const mult = (item.is_multiplied && item.multiplier_qty) ? item.multiplier_qty : 1;
      if (useAltEstimates && item.assumption_linked && item.alt_fee_upper) {
        totals[category] += item.alt_fee_upper * mult;
      } else {
        totals[category] += getFeeUpper(item) * mult;
      }
    }
  });
  
  return totals;
}

// Get items by phase and category with their original indices
function getItemsForPhaseCategory(
  items: DraftProposalItem[],
  phaseId: string | null,
  category: string | null,
  phases: ProposalPhase[]
): { index: number; workItem: string; currentFee: number; category: string; phaseId: string | null }[] {
  const validPhaseIds = new Set(phases.map(p => p.id));
  
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const isIncluded = !item.is_optional || (item.is_optional && item.is_included !== false);
      if (!isIncluded) return false;
      
      if (category !== null) {
        const itemCategory = item.category || 'Other';
        if (itemCategory !== category) return false;
      }
      
      if (phaseId === null) {
        return true;
      } else if (phaseId === 'unassigned') {
        return !item.phase_id || !validPhaseIds.has(item.phase_id);
      } else {
        return item.phase_id === phaseId;
      }
    })
    .map(({ item, index }) => ({
      index,
      workItem: item.work_item,
      currentFee: getFeeUpper(item),
      category: item.category || 'Other',
      phaseId: item.phase_id || null,
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
  showAssumptionsNotTrue = false,
  onToggleAssumptionsNotTrue,
  lockedCategories = new Set(),
  onToggleLock,
}: CategorizedProposalViewProps) {
  const [isCategorizing, setIsCategorizing] = useState(false);
  
  // Review checkboxes state (visual aid only)
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set());
  
  const toggleReviewed = useCallback((key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReviewedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  
  // Toggle all categories in a phase at once
  const togglePhaseReviewed = useCallback((phaseId: string, categoryKeys: string[], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReviewedItems(prev => {
      const next = new Set(prev);
      const phaseKey = `phase:${phaseId}`;
      const allChecked = categoryKeys.every(k => prev.has(k)) && prev.has(phaseKey);
      if (allChecked) {
        next.delete(phaseKey);
        categoryKeys.forEach(k => next.delete(k));
      } else {
        next.add(phaseKey);
        categoryKeys.forEach(k => next.add(k));
      }
      return next;
    });
  }, []);

  // Toggle exclude for all items in a category (and optionally a phase)
  const toggleCategoryExclude = useCallback((phaseId: string | null, category: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const validPhaseIds = new Set(phases.map(p => p.id));
    
    // Find matching items
    const matchingIndices: number[] = [];
    items.forEach((item, index) => {
      const itemCategory = item.category || 'Other';
      if (itemCategory !== category) return;
      if (phaseId !== null) {
        if (phaseId === 'unassigned') {
          if (item.phase_id && validPhaseIds.has(item.phase_id)) return;
        } else {
          if (item.phase_id !== phaseId) return;
        }
      }
      matchingIndices.push(index);
    });
    
    if (matchingIndices.length === 0) return;
    
    // Check if all matching are currently excluded
    const allExcluded = matchingIndices.every(i => items[i].is_included === false);
    const newIncluded = allExcluded; // toggle: if all excluded → include, else exclude all
    
    const newItems = items.map((item, index) => {
      if (matchingIndices.includes(index)) {
        return { ...item, is_included: newIncluded };
      }
      return item;
    });
    onItemsChange(newItems);
    
    const count = matchingIndices.length;
    if (newIncluded) {
      toast.success(`Included ${count} ${category} item${count > 1 ? 's' : ''}`);
    } else {
      toast.success(`Excluded ${count} ${category} item${count > 1 ? 's' : ''}`);
    }
  }, [items, phases, onItemsChange]);

  // Check if a category in a phase is fully excluded
  const isCategoryExcluded = useCallback((phaseId: string | null, category: string): boolean => {
    const validPhaseIds = new Set(phases.map(p => p.id));
    const matchingItems = items.filter((item) => {
      const itemCategory = item.category || 'Other';
      if (itemCategory !== category) return false;
      if (phaseId !== null) {
        if (phaseId === 'unassigned') {
          if (item.phase_id && validPhaseIds.has(item.phase_id)) return false;
        } else {
          if (item.phase_id !== phaseId) return false;
        }
      }
      return true;
    });
    return matchingItems.length > 0 && matchingItems.every(item => item.is_included === false);
  }, [items, phases]);

  // Allocation dialog state
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedPhaseName, setSelectedPhaseName] = useState<string | null>(null);
  const [isSubtotalEdit, setIsSubtotalEdit] = useState(false);
  
  // Lock override state
  const [showLockPrompt, setShowLockPrompt] = useState(false);
  const [includeLocked, setIncludeLocked] = useState(false);
  const [pendingEditAction, setPendingEditAction] = useState<(() => void) | null>(null);

  // Combine standard and custom categories for display
  const allCategories = useMemo(() => {
    return [...BUDGET_CATEGORIES, ...customCategories];
  }, [customCategories]);

  // Calculate per-phase category totals
  const phaseBreakdowns = useMemo(() => {
    if (phases.length <= 1) return null;
    
    return phases.map(phase => {
      const phaseItems = items.filter(item => item.phase_id === phase.id);
      const totals = calculateCategoryTotals(phaseItems, allCategories, showAssumptionsNotTrue);
      const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
      return { phase, totals, grandTotal };
    });
  }, [items, phases, allCategories, showAssumptionsNotTrue]);

  // Calculate aggregate totals
  const categoryTotals = useMemo(() => {
    return calculateCategoryTotals(items, allCategories, showAssumptionsNotTrue);
  }, [items, allCategories, showAssumptionsNotTrue]);

  // Grand total
  const grandTotal = useMemo(() => {
    return Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
  }, [categoryTotals]);

  // Check if any items have assumption-linked alt estimates
  const hasAssumptionLinkedItems = useMemo(() => {
    return items.some(item => item.assumption_linked && item.alt_fee_upper);
  }, [items]);

  // Count uncategorized items
  const uncategorizedCount = items.filter(item => !item.category && item.work_item.trim()).length;

  // Handle tile click for navigation
  const handleTileClick = useCallback((phaseId: string | null, category: string) => {
    if (onNavigateToCategory) {
      onNavigateToCategory(phaseId, category);
    }
  }, [onNavigateToCategory]);
  
  // Check if locked items exist in scope and prompt if needed
  const checkLockedAndProceed = useCallback((
    phaseId: string | null,
    category: string | null,
    openAction: () => void
  ) => {
    // Check if there are locked items in the scope
    const allItems = getItemsForPhaseCategory(items, phaseId, category, phases);
    const hasLocked = allItems.some(item => {
      // For aggregate edits (phaseId === null), check each item's own phase
      const itemPhaseKey = item.phaseId || 'global';
      const lockKey = `${phaseId !== null ? phaseId : itemPhaseKey}:${item.category}`;
      return lockedCategories.has(lockKey);
    });

    if (hasLocked) {
      setPendingEditAction(() => openAction);
      setShowLockPrompt(true);
    } else {
      setIncludeLocked(false);
      openAction();
    }
  }, [items, phases, lockedCategories]);
  
  // Handle edit click for fee allocation (category level)
  const handleEditClick = useCallback((
    e: React.MouseEvent,
    phaseId: string | null,
    phaseName: string | null,
    category: string
  ) => {
    e.stopPropagation();
    const openAction = () => {
      setSelectedPhaseId(phaseId);
      setSelectedPhaseName(phaseName);
      setSelectedCategory(category);
      setIsSubtotalEdit(false);
      setAllocationDialogOpen(true);
    };
    // For aggregate category edits (phaseId === null), check locked items across all phases
    if (phaseId === null && phases.length > 1) {
      checkLockedAndProceed(null, category, openAction);
    } else {
      setIncludeLocked(false);
      openAction();
    }
  }, [phases, checkLockedAndProceed]);
  
  // Handle subtotal edit click (phase level or aggregate total - all categories)
  const handleSubtotalEditClick = useCallback((
    e: React.MouseEvent,
    phaseId: string | null,
    phaseName: string
  ) => {
    e.stopPropagation();
    const openAction = () => {
      setSelectedPhaseId(phaseId);
      setSelectedPhaseName(phaseName);
      setSelectedCategory(null);
      setIsSubtotalEdit(true);
      setAllocationDialogOpen(true);
    };
    checkLockedAndProceed(phaseId, null, openAction);
  }, [checkLockedAndProceed]);
  
  // Get affected items for the dialog (respecting lock override choice, excluding zero-fee)
  const affectedItems = useMemo(() => {
    if (!allocationDialogOpen) return [];
    const allItems = getItemsForPhaseCategory(items, selectedPhaseId, selectedCategory, phases);
    return allItems.filter(item => {
      // Exclude zero-fee items
      if (item.currentFee === 0) return false;
      // Filter locked items unless user chose to include them
      if (!includeLocked) {
        // Use the item's own phase for lock key lookup
        const itemPhaseKey = selectedPhaseId !== null ? selectedPhaseId : (item.phaseId || 'global');
        const lockKey = `${itemPhaseKey}:${item.category}`;
        if (lockedCategories.has(lockKey)) return false;
      }
      return true;
    });
  }, [allocationDialogOpen, items, selectedPhaseId, selectedCategory, phases, lockedCategories, includeLocked]);
  
  // Current total for selected category/subtotal
  const selectedCategoryTotal = useMemo(() => {
    return affectedItems.reduce((sum, item) => sum + item.currentFee, 0);
  }, [affectedItems]);
  
  // Apply fee allocations
  const handleApplyAllocations = useCallback((allocations: Map<number, number>) => {
    const newItems = items.map((item, index) => {
      const newFeeUpper = allocations.get(index);
      if (newFeeUpper !== undefined) {
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

      const updatedItems = [...items];
      
      categorizations.forEach((cat: { index: number; category: string }) => {
        if (updatedItems[cat.index]) {
          updatedItems[cat.index] = { ...updatedItems[cat.index], category: cat.category };
        }
      });
      
      const categoryOrder = Object.fromEntries(
        BUDGET_CATEGORIES.map((cat, idx) => [cat, idx])
      );
      
      updatedItems.sort((a, b) => {
        const catA = a.category || '';
        const catB = b.category || '';
        if (!catA && catB) return 1;
        if (catA && !catB) return -1;
        if (!catA && !catB) return 0;
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
  const renderCategoryBreakdown = (
    totals: Record<string, number>,
    total: number,
    phaseId: string | null,
    phaseName: string | null,
    isAggregate: boolean = false,
    sourceItems: DraftProposalItem[] = items
  ) => {
    const isPhaseRow = phaseId !== null && !isAggregate;
    
    // Track which categories have any items (even excluded) so tiles stay visible
    const categoriesWithItems = new Set<string>();
    sourceItems.forEach(item => {
      const cat = item.category || 'Other';
      categoriesWithItems.add(cat);
    });
    
    return (
      <div className="space-y-2">
        {phaseName && (
          <div className="text-sm font-medium text-foreground">{phaseName}</div>
        )}
        <div className="flex flex-wrap gap-2">
          {allCategories.map(category => {
            const categoryTotal = totals[category];
            // Show tile if it has a total OR if it has items (they might be excluded)
            if (categoryTotal === 0 && !categoriesWithItems.has(category)) return null;
            
            const isStandardCategory = (BUDGET_CATEGORIES as readonly string[]).includes(category);
            const bgColor = isStandardCategory ? categoryBgColors[category as BudgetCategory] : 'bg-slate-100 dark:bg-slate-800/50';
            const textColor = isStandardCategory ? categoryTextColors[category as BudgetCategory] : 'text-slate-700 dark:text-slate-300';
            const borderColor = isStandardCategory ? categoryBorderColors[category as BudgetCategory] : 'border-slate-300 dark:border-slate-600';
            
          const reviewKey = `${phaseId ?? 'agg'}:${category}`;
          
            if (isAggregate) {
              // Aggregate category tiles: interactive with pencil + lock (operates across all phases)
              const isLockedInAllPhases = phases.length > 0 && phases.every(p => lockedCategories.has(`${p.id}:${category}`));
              const isLockedInSomePhases = phases.some(p => lockedCategories.has(`${p.id}:${category}`));
              const isExcluded = isCategoryExcluded(null, category);
              
              return (
                <TooltipProvider key={category}>
                  <div
                    className={cn(
                      'rounded-md px-3 py-2 pb-5 border cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] group relative',
                      bgColor,
                      borderColor,
                      isLockedInAllPhases && 'opacity-75 border-dashed',
                      isExcluded && 'opacity-40'
                    )}
                    onClick={() => handleTileClick(null, category)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleTileClick(null, category);
                      }
                    }}
                  >
                    {/* Review checkbox */}
                    <Checkbox
                      checked={reviewedItems.has(reviewKey)}
                      onCheckedChange={() => toggleReviewed(reviewKey)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1 right-1 h-3 w-3 rounded-[3px] border-muted-foreground/30 data-[state=checked]:bg-primary/60 data-[state=checked]:border-primary/60"
                    />
                    <div className={cn('text-xs font-medium flex items-center gap-1', textColor)}>
                      <span>{category}</span>
                      {isLockedInAllPhases && (
                        <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      )}
                      {isLockedInSomePhases && !isLockedInAllPhases && (
                        <Lock className="h-3 w-3 text-amber-400 dark:text-amber-500 opacity-60" />
                      )}
                    </div>
                    <div className={cn('text-sm font-semibold flex items-center gap-1', textColor, isExcluded && 'line-through')}>
                      <span>{formatCurrency(categoryTotal)}</span>
                      {onToggleLock && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                'transition-opacity p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10',
                                isLockedInAllPhases ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLock(`aggregate:${category}`);
                              }}
                            >
                              {isLockedInAllPhases ? (
                                <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                              ) : (
                                <LockOpen className="h-3 w-3" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isLockedInAllPhases ? 'Unlock category in all phases' : 'Lock category in all phases'}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {!isLockedInAllPhases && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                              onClick={(e) => handleEditClick(e, null, 'All Phases', category)}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Adjust fee across all phases and distribute pro-rata</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {/* Exclude cross button */}
                    <button
                      className={cn(
                        'absolute bottom-1 right-1 h-3.5 w-3.5 rounded-sm flex items-center justify-center transition-all',
                        isExcluded
                          ? 'bg-destructive/80 text-destructive-foreground'
                          : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 bg-destructive/20 text-destructive hover:bg-destructive/80 hover:text-destructive-foreground'
                      )}
                      onClick={(e) => toggleCategoryExclude(null, category, e)}
                      title={isExcluded ? 'Include category' : 'Exclude category'}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </TooltipProvider>
              );
            }
            
            const lockKey = `${phaseId || 'global'}:${category}`;
            const isLocked = lockedCategories.has(lockKey);
            const isExcludedPhase = isCategoryExcluded(phaseId, category);
            
            return (
              <TooltipProvider key={category}>
                <div
                  className={cn(
                    'rounded-md px-3 py-2 pb-5 border cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] group relative',
                    bgColor,
                    borderColor,
                    isLocked && 'opacity-75 border-dashed',
                    isExcludedPhase && 'opacity-40'
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
                    {/* Review checkbox */}
                    <Checkbox
                      checked={reviewedItems.has(reviewKey)}
                      onCheckedChange={() => toggleReviewed(reviewKey)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1 right-1 h-3 w-3 rounded-[3px] border-muted-foreground/30 data-[state=checked]:bg-primary/60 data-[state=checked]:border-primary/60"
                    />
                  <div className={cn('text-xs font-medium flex items-center gap-1', textColor)}>
                    <span>{category}</span>
                    {isLocked && (
                      <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div className={cn('text-sm font-semibold flex items-center gap-1', textColor, isExcludedPhase && 'line-through')}>
                    <span>{formatCurrency(categoryTotal)}</span>
                    {onToggleLock && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              'transition-opacity p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10',
                              isLocked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleLock(lockKey);
                            }}
                          >
                            {isLocked ? (
                              <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <LockOpen className="h-3 w-3" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{isLocked ? 'Unlock category (allow automated pricing)' : 'Lock category (protect from automated pricing)'}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {!isLocked && (
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
                    )}
                  </div>
                  {/* Exclude cross button */}
                  <button
                    className={cn(
                      'absolute bottom-1 right-1 h-3.5 w-3.5 rounded-sm flex items-center justify-center transition-all',
                      isExcludedPhase
                        ? 'bg-destructive/80 text-destructive-foreground'
                        : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 bg-destructive/20 text-destructive hover:bg-destructive/80 hover:text-destructive-foreground'
                    )}
                    onClick={(e) => toggleCategoryExclude(phaseId, category, e)}
                    title={isExcludedPhase ? 'Include category' : 'Exclude category'}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              </TooltipProvider>
            );
          })}
          
          {/* Phase/Section Total Box */}
          {total > 0 && (() => {
            // Compute active category keys for this phase for the "select all" checkbox
            const activeCategoryKeys = isPhaseRow && phaseId
              ? allCategories.filter(c => totals[c] > 0).map(c => `${phaseId}:${c}`)
              : [];
            const phaseReviewKey = phaseId ? `phase:${phaseId}` : null;
            const allCatsChecked = isPhaseRow && phaseId
              ? activeCategoryKeys.length > 0 && activeCategoryKeys.every(k => reviewedItems.has(k))
              : false;
            
            return (
            <TooltipProvider>
              <div className={cn(
                'rounded-md px-3 py-2 border bg-primary/10 border-primary/30 relative',
                (isPhaseRow || isAggregate) && 'group'
              )}>
                {/* Phase-level review checkbox (select all categories) */}
                {isPhaseRow && phaseId && activeCategoryKeys.length > 0 && (
                  <Checkbox
                    checked={allCatsChecked}
                    onCheckedChange={() => togglePhaseReviewed(phaseId, activeCategoryKeys)}
                    className="absolute top-1 right-1 h-3 w-3 rounded-[3px] border-primary/40 data-[state=checked]:bg-primary/60 data-[state=checked]:border-primary/60"
                  />
                )}
                <div className="text-xs font-medium text-primary">
                  {isAggregate ? 'Total' : 'Subtotal'}
                </div>
                <div className="text-sm font-semibold text-primary flex items-center gap-1">
                  <span>{formatCurrency(total)}</span>
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
                  {isAggregate && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-primary/20"
                          onClick={(e) => handleSubtotalEditClick(e, null, 'Aggregate Total')}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Adjust total and distribute across all phases and categories</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </TooltipProvider>
            );
          })()}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Lock override prompt for subtotal edits */}
      <AlertDialog open={showLockPrompt} onOpenChange={setShowLockPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Locked Categories Detected</AlertDialogTitle>
            <AlertDialogDescription>
              Some items belong to locked categories. Would you like to include locked items in this adjustment?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIncludeLocked(false);
              setShowLockPrompt(false);
              // Still open the dialog, just without locked items
              if (pendingEditAction) pendingEditAction();
              setPendingEditAction(null);
            }}>
              No, skip locked items
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setIncludeLocked(true);
              setShowLockPrompt(false);
              if (pendingEditAction) pendingEditAction();
              setPendingEditAction(null);
            }}>
              Yes, include locked items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Assumptions Not All True toggle */}
      {hasAssumptionLinkedItems && onToggleAssumptionsNotTrue && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            checked={showAssumptionsNotTrue}
            onCheckedChange={(checked) => onToggleAssumptionsNotTrue(!!checked)}
            className="border-amber-500 data-[state=checked]:bg-amber-600"
          />
          <label className="text-sm font-medium cursor-pointer" onClick={() => onToggleAssumptionsNotTrue(!showAssumptionsNotTrue)}>
            Assumptions Not All True?
          </label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  Toggle this to see estimates that apply when one or more linked assumptions 
                  are not true. Items without linked assumptions are unchanged.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {showAssumptionsNotTrue && (
            <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 text-xs">
              Showing alt estimates
            </Badge>
          )}
        </div>
      )}

      {/* Per-Phase Breakdowns (if multiple phases) */}
      {phaseBreakdowns && phaseBreakdowns.length > 1 && (
        <div className="space-y-4">
          {phaseBreakdowns.map(({ phase, totals, grandTotal: phaseTotal }) => (
            <div key={phase.id}>
              {renderCategoryBreakdown(totals, phaseTotal, phase.id, phase.name, false)}
            </div>
          ))}
          
          {/* Aggregate Total */}
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
