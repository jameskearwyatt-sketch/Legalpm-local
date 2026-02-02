import { useMemo, useState } from 'react';
import { Loader2, Wand2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DraftProposalItem, BUDGET_CATEGORIES, ProposalPhase } from '@/lib/hooks/usePricingProposals';

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

export function CategorizedProposalView({
  items,
  phases,
  onItemsChange,
  formatCurrency,
  currencySymbol,
  customCategories = [],
}: CategorizedProposalViewProps) {
  const [isCategorizing, setIsCategorizing] = useState(false);

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
  const renderCategoryBreakdown = (
    totals: Record<string, number>,
    total: number,
    label?: string
  ) => (
    <div className="space-y-2">
      {label && (
        <div className="text-sm font-medium text-foreground">{label}</div>
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
        })}
        
        {/* Phase/Section Total Box */}
        {total > 0 && (
          <div className="rounded-md px-3 py-2 border bg-primary/10 border-primary/30">
            <div className="text-xs font-medium text-primary">
              {label ? 'Subtotal' : 'Total'}
            </div>
            <div className="text-sm font-semibold text-primary">
              {formatCurrency(total)}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Auto-categorize button row */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {uncategorizedCount > 0 && (
            <span>{uncategorizedCount} item(s) need categorization</span>
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
              {renderCategoryBreakdown(totals, phaseTotal, phase.name)}
            </div>
          ))}
          
          {/* Aggregate Total */}
          <div className="pt-2 border-t">
            {renderCategoryBreakdown(categoryTotals, grandTotal, 'Aggregate Total')}
          </div>
        </div>
      )}

      {/* Single breakdown (if single phase or no phases) */}
      {(!phaseBreakdowns || phaseBreakdowns.length <= 1) && (
        renderCategoryBreakdown(categoryTotals, grandTotal)
      )}
    </div>
  );
}

// Export category styling utilities for use in the table
export { categoryBgColors, categoryTextColors, categoryBorderColors };
export type { BudgetCategory };
