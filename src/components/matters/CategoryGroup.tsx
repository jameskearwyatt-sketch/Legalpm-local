import { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BudgetCategory } from '@/lib/hooks/useBudgetVersions';

interface CategoryGroupProps {
  category: BudgetCategory;
  subtotal: number;
  formatCurrency: (value: number, currency?: string) => string;
  currency: string;
  mandatedRate: number;
  isEmpty?: boolean;
  children: ReactNode;
}

const categoryColors: Record<BudgetCategory, string> = {
  'Due Diligence': 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
  'Documentation': 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700',
  'Negotiations': 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
  'Meetings': 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
  'Regulatory': 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
  'Closing': 'bg-teal-100 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700',
  'Other': 'bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600',
};

const categoryTextColors: Record<BudgetCategory, string> = {
  'Due Diligence': 'text-blue-700 dark:text-blue-300',
  'Documentation': 'text-purple-700 dark:text-purple-300',
  'Negotiations': 'text-amber-700 dark:text-amber-300',
  'Meetings': 'text-green-700 dark:text-green-300',
  'Regulatory': 'text-red-700 dark:text-red-300',
  'Closing': 'text-teal-700 dark:text-teal-300',
  'Other': 'text-gray-700 dark:text-gray-300',
};

export function CategoryGroup({
  category,
  subtotal,
  formatCurrency,
  currency,
  mandatedRate,
  isEmpty = false,
  children,
}: CategoryGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const { setNodeRef, isOver } = useDroppable({
    id: `category-${category}`,
    data: {
      type: 'category',
      category,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg border transition-all',
        categoryColors[category],
        isOver && 'ring-2 ring-primary ring-offset-2',
        isEmpty && 'opacity-60'
      )}
    >
      {/* Category Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 cursor-pointer select-none',
          !isEmpty && 'border-b',
          categoryColors[category]
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
          <span className={cn('font-semibold text-sm', categoryTextColors[category])}>
            {category}
          </span>
        </div>
        {!isEmpty && subtotal > 0 && (
          <span className={cn('font-medium text-sm', categoryTextColors[category])}>
            {formatCurrency(subtotal, currency)}
          </span>
        )}
      </div>

      {/* Category Items */}
      {!isCollapsed && (
        <div className="p-2 space-y-1 bg-background/50">
          {children}
        </div>
      )}
    </div>
  );
}
