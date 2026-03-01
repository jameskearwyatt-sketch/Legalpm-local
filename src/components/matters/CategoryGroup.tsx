import { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BudgetCategory, BUDGET_CATEGORIES } from '@/lib/hooks/useBudgetVersions';

interface CategoryGroupProps {
  category: string; // Changed from BudgetCategory to string to support custom categories
  providerName?: string;
  groupKey: string;
  subtotal: number;
  budgetUsed: number;
  writeOffTotal: number;
  formatCurrency: (value: number, currency?: string) => string;
  currency: string;
  mandatedRate: number;
  isEmpty?: boolean;
  children: ReactNode;
}

const categoryColors: Record<BudgetCategory, string> = {
  'Due Diligence': 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
  'Term Sheets': 'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700',
  'Documentation': 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700',
  'Regulatory': 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
  'Tax': 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700',
  'Legal Opinions': 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700',
  'Structuring Advice': 'bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700',
  'Negotiations': 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
  'Meetings': 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
  'Closing': 'bg-teal-100 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700',
  'Other': 'bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600',
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

// Get health color for budget usage
function getBurnHealth(budgetUsed: number, budget: number): string {
  if (budget <= 0) return 'text-muted-foreground';
  const pct = (budgetUsed / budget) * 100;
  if (pct <= 50) return 'text-green-600 dark:text-green-400';
  if (pct <= 70) return 'text-lime-600 dark:text-lime-400';
  if (pct <= 85) return 'text-amber-600 dark:text-amber-400';
  if (pct <= 100) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

// Helper to get colors for a category (with fallback for custom categories)
function getCategoryColor(category: string): string {
  if ((BUDGET_CATEGORIES as readonly string[]).includes(category)) {
    return categoryColors[category as BudgetCategory];
  }
  return 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600';
}

function getCategoryTextColor(category: string): string {
  if ((BUDGET_CATEGORIES as readonly string[]).includes(category)) {
    return categoryTextColors[category as BudgetCategory];
  }
  return 'text-slate-700 dark:text-slate-300';
}

export function CategoryGroup({
  category,
  providerName,
  groupKey,
  subtotal,
  budgetUsed,
  writeOffTotal,
  formatCurrency,
  currency,
  mandatedRate,
  isEmpty = false,
  children,
}: CategoryGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${groupKey}`,
    data: {
      type: 'category',
      category,
      providerName,
      groupKey,
    },
  });

  // Display name shows category and provider
  const displayName = providerName ? `${category} - ${providerName}` : category;
  // Calculate raw WIP (adjusted + write-offs)
  const rawWip = budgetUsed + writeOffTotal;
  // Adjusted budget used is the figure we track against
  const adjBudgetUsed = budgetUsed;
  const burnPct = subtotal > 0 ? Math.round((adjBudgetUsed / subtotal) * 100) : 0;
  const burnHealthColor = getBurnHealth(adjBudgetUsed, subtotal);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg border transition-all',
        getCategoryColor(category),
        isOver && 'ring-2 ring-primary ring-offset-2',
        isEmpty && 'opacity-60'
      )}
    >
      {/* Category Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 cursor-pointer select-none',
          !isEmpty && 'border-b',
          getCategoryColor(category)
        )}
        onClick={() => !isEmpty && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          {!isEmpty && (
            isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )
          )}
          <span className={cn('font-semibold text-sm', getCategoryTextColor(category))}>
            {displayName}
          </span>
        </div>
        {!isEmpty && subtotal > 0 && (
          <div className="flex items-center gap-3 text-xs">
            {/* Raw WIP */}
            {rawWip > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Raw:</span>
                <span className="font-medium text-muted-foreground">
                  {formatCurrency(rawWip, currency)}
                </span>
              </div>
            )}
            {/* Write-off */}
            {writeOffTotal > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">W/O:</span>
                <span className="font-medium text-destructive">
                  -{formatCurrency(writeOffTotal, currency)}
                </span>
              </div>
            )}
            {/* Adjusted Budget Used / Budget with percentage */}
            <div className="flex items-center gap-1.5">
              {adjBudgetUsed > 0 && (
                <>
                  <span className="text-muted-foreground">Adj:</span>
                  <span className={cn('font-medium', burnHealthColor)}>
                    {formatCurrency(adjBudgetUsed, currency)}
                  </span>
                  <span className="text-muted-foreground">/</span>
                </>
              )}
              <span className={cn('font-medium', getCategoryTextColor(category))}>
                {formatCurrency(subtotal, currency)}
              </span>
              {adjBudgetUsed > 0 && (
                <span className={cn('font-medium px-1.5 py-0.5 rounded', burnHealthColor, 
                  burnPct > 100 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted/50'
                )}>
                  {burnPct}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category Items */}
      {!isCollapsed && (
        <div className="p-2 space-y-1 bg-background/50 overflow-x-auto">
          {children}
        </div>
      )}
    </div>
  );
}
