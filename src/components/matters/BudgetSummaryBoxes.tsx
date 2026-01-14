import { useMemo } from 'react';
import { DraftLineItem, BUDGET_CATEGORIES, BudgetCategory } from '@/lib/hooks/useBudgetVersions';
import { cn } from '@/lib/utils';

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

interface BudgetSummaryBoxesProps {
  items: DraftLineItem[];
  formatCurrency: (value: number, currency?: string) => string;
  currency: string;
  billingCurrency: string;
  differentBillingCurrency: boolean;
  agreedBillingAmount: number;
  mandatedRate: number;
}

export function BudgetSummaryBoxes({
  items,
  formatCurrency,
  currency,
  billingCurrency,
  differentBillingCurrency,
  agreedBillingAmount,
  mandatedRate,
}: BudgetSummaryBoxesProps) {
  // Get all categories including custom ones
  const allCategories = useMemo(() => {
    const customCategories = new Set<string>();
    items.forEach(item => {
      const category = item.category || 'Other';
      if (!(BUDGET_CATEGORIES as readonly string[]).includes(category)) {
        customCategories.add(category);
      }
    });
    return [...BUDGET_CATEGORIES, ...Array.from(customCategories).sort()];
  }, [items]);

  // Calculate totals per category
  const categoryTotals = useMemo(() => {
    const totals: Record<string, { budget: number; used: number; writeOff: number }> = {};
    
    allCategories.forEach(category => {
      totals[category] = { budget: 0, used: 0, writeOff: 0 };
    });
    
    items.forEach(item => {
      const category = item.category || 'Other';
      const isIncluded = !item.is_optional || (item.is_optional && item.is_included !== false);
      
      // Ensure category exists in totals (fallback for any new categories)
      if (!totals[category]) {
        totals[category] = { budget: 0, used: 0, writeOff: 0 };
      }
      
      if (isIncluded) {
        totals[category].budget += item.fee_amount || 0;
      }
      const rawWip = item.wip_amount || 0;
      const writeOff = item.wip_write_off || 0;
      totals[category].used += rawWip - writeOff;
      totals[category].writeOff += writeOff;
    });
    
    return totals;
  }, [items, allCategories]);

  // Calculate totals per provider (budget, wip, write-off)
  const providerTotals = useMemo(() => {
    const totals: Record<string, { budget: number; rawWip: number; writeOff: number }> = {};
    
    items.forEach(item => {
      const providerName = item.provider === 'Local Counsel' && item.lc_firm_name 
        ? item.lc_firm_name 
        : 'Baker McKenzie';
      const isIncluded = !item.is_optional || (item.is_optional && item.is_included !== false);
      
      if (!totals[providerName]) {
        totals[providerName] = { budget: 0, rawWip: 0, writeOff: 0 };
      }
      
      if (isIncluded) {
        totals[providerName].budget += item.fee_amount || 0;
      }
      totals[providerName].rawWip += item.wip_amount || 0;
      totals[providerName].writeOff += item.wip_write_off || 0;
    });
    
    return totals;
  }, [items]);

  const displayCurrency = differentBillingCurrency && agreedBillingAmount > 0 
    ? billingCurrency 
    : currency;

  // Check if there's any data to show
  const hasData = items.some(i => i.work_item.trim());
  if (!hasData) return null;

  return (
    <div className="space-y-3">
      {/* Category Summary Boxes */}
      <div className="flex flex-wrap gap-2">
        {allCategories.map(category => {
          const catData = categoryTotals[category];
          if (!catData || (catData.budget === 0 && catData.used === 0 && catData.writeOff === 0)) return null;
          
          const displayBudget = differentBillingCurrency && agreedBillingAmount > 0
            ? catData.budget * mandatedRate
            : catData.budget;
          const displayAdjUsed = differentBillingCurrency && agreedBillingAmount > 0
            ? catData.used * mandatedRate
            : catData.used;
          const displayWriteOff = differentBillingCurrency && agreedBillingAmount > 0
            ? catData.writeOff * mandatedRate
            : catData.writeOff;
          const displayRawWip = displayAdjUsed + displayWriteOff;
          const burnPct = displayBudget > 0 ? Math.round((displayAdjUsed / displayBudget) * 100) : 0;
          const burnColor = burnPct > 100 ? 'text-red-600 dark:text-red-400' : 
                           burnPct > 85 ? 'text-orange-600 dark:text-orange-400' : 
                           burnPct > 70 ? 'text-amber-600 dark:text-amber-400' : 
                           'text-green-600 dark:text-green-400';
          
          // Get colors - use fallback for custom categories
          const isStandardCategory = (BUDGET_CATEGORIES as readonly string[]).includes(category);
          const bgColor = isStandardCategory ? categoryBgColors[category as BudgetCategory] : 'bg-slate-100 dark:bg-slate-800/50';
          const textColor = isStandardCategory ? categoryTextColors[category as BudgetCategory] : 'text-slate-700 dark:text-slate-300';
          
          return (
            <div
              key={category}
              className={cn(
                'rounded-md px-3 py-2 border min-w-[140px]',
                bgColor
              )}
            >
              <div className={cn('text-xs font-medium mb-1', textColor)}>
                {category}
              </div>
              {displayWriteOff > 0 ? (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Raw:</span>
                    <span className="font-medium">{formatCurrency(displayRawWip, displayCurrency)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-destructive">
                    <span>W/O:</span>
                    <span className="font-medium">-{formatCurrency(displayWriteOff, displayCurrency)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Adj:</span>
                    <span className={cn('font-semibold', burnColor)}>
                      {formatCurrency(displayAdjUsed, displayCurrency)}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <span className={cn('font-semibold', textColor)}>
                      {formatCurrency(displayBudget, displayCurrency)}
                    </span>
                    <span className={cn('font-medium', burnColor)}>
                      ({burnPct}%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  {displayAdjUsed > 0 && (
                    <>
                      <span className={cn('text-sm font-semibold', burnColor)}>
                        {formatCurrency(displayAdjUsed, displayCurrency)}
                      </span>
                      <span className="text-xs text-muted-foreground">/</span>
                    </>
                  )}
                  <span className={cn('text-sm font-semibold', textColor)}>
                    {formatCurrency(displayBudget, displayCurrency)}
                  </span>
                  {displayAdjUsed > 0 && (
                    <span className={cn('text-xs font-medium', burnColor)}>
                      ({burnPct}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Total Box */}
        {(() => {
          const grandBudget = Object.values(categoryTotals).reduce((sum, val) => sum + val.budget, 0);
          const grandAdjUsed = Object.values(categoryTotals).reduce((sum, val) => sum + val.used, 0);
          const grandWriteOff = Object.values(categoryTotals).reduce((sum, val) => sum + val.writeOff, 0);
          if (grandBudget === 0 && grandAdjUsed === 0 && grandWriteOff === 0) return null;
          
          const displayGrandBudget = differentBillingCurrency && agreedBillingAmount > 0
            ? grandBudget * mandatedRate
            : grandBudget;
          const displayGrandAdjUsed = differentBillingCurrency && agreedBillingAmount > 0
            ? grandAdjUsed * mandatedRate
            : grandAdjUsed;
          const displayGrandWriteOff = differentBillingCurrency && agreedBillingAmount > 0
            ? grandWriteOff * mandatedRate
            : grandWriteOff;
          const displayGrandRawWip = displayGrandAdjUsed + displayGrandWriteOff;
          const burnPct = displayGrandBudget > 0 ? Math.round((displayGrandAdjUsed / displayGrandBudget) * 100) : 0;
          const burnColor = burnPct > 100 ? 'text-red-600 dark:text-red-400' : 
                           burnPct > 85 ? 'text-orange-600 dark:text-orange-400' : 
                           burnPct > 70 ? 'text-amber-600 dark:text-amber-400' : 
                           'text-green-600 dark:text-green-400';
          
          return (
            <div className="rounded-md px-3 py-2 border bg-primary/10 border-primary/30 min-w-[160px]">
              <div className="text-xs font-medium text-primary mb-1">
                Total Budget
              </div>
              {displayGrandWriteOff > 0 ? (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Raw:</span>
                    <span className="font-medium">{formatCurrency(displayGrandRawWip, displayCurrency)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-destructive">
                    <span>W/O:</span>
                    <span className="font-medium">-{formatCurrency(displayGrandWriteOff, displayCurrency)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Adj:</span>
                    <span className={cn('font-semibold', burnColor)}>
                      {formatCurrency(displayGrandAdjUsed, displayCurrency)}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(displayGrandBudget, displayCurrency)}
                    </span>
                    <span className={cn('font-medium', burnColor)}>
                      ({burnPct}%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  {displayGrandAdjUsed > 0 && (
                    <>
                      <span className={cn('text-sm font-semibold', burnColor)}>
                        {formatCurrency(displayGrandAdjUsed, displayCurrency)}
                      </span>
                      <span className="text-xs text-muted-foreground">/</span>
                    </>
                  )}
                  <span className="text-sm font-semibold text-primary">
                    {formatCurrency(displayGrandBudget, displayCurrency)}
                  </span>
                  {displayGrandAdjUsed > 0 && (
                    <span className={cn('text-xs font-medium', burnColor)}>
                      ({burnPct}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Provider Subtotals with WIP breakdown */}
      {Object.keys(providerTotals).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {providerTotals['Baker McKenzie'] && providerTotals['Baker McKenzie'].budget > 0 && (() => {
            const data = providerTotals['Baker McKenzie'];
            const displayBudget = differentBillingCurrency && agreedBillingAmount > 0
              ? data.budget * mandatedRate
              : data.budget;
            const displayRawWip = differentBillingCurrency && agreedBillingAmount > 0
              ? data.rawWip * mandatedRate
              : data.rawWip;
            const displayWriteOff = differentBillingCurrency && agreedBillingAmount > 0
              ? data.writeOff * mandatedRate
              : data.writeOff;
            const displayAdjWip = displayRawWip - displayWriteOff;
            const burnPct = displayBudget > 0 ? Math.round((displayAdjWip / displayBudget) * 100) : 0;
            const burnColor = burnPct > 100 ? 'text-red-600 dark:text-red-400' : 
                             burnPct > 85 ? 'text-orange-600 dark:text-orange-400' : 
                             burnPct > 70 ? 'text-amber-600 dark:text-amber-400' : 
                             'text-green-600 dark:text-green-400';
            
            return (
              <div className="rounded-md px-3 py-2 border bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 min-w-[160px]">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Baker McKenzie
                </div>
                {displayWriteOff > 0 ? (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>Raw:</span>
                      <span className="font-medium">{formatCurrency(displayRawWip, displayCurrency)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <span>W/O:</span>
                      <span className="font-medium">-{formatCurrency(displayWriteOff, displayCurrency)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">Adj:</span>
                      <span className={cn('font-semibold', burnColor)}>
                        {formatCurrency(displayAdjWip, displayCurrency)}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatCurrency(displayBudget, displayCurrency)}
                      </span>
                      <span className={cn('font-medium', burnColor)}>
                        ({burnPct}%)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    {displayRawWip > 0 && (
                      <>
                        <span className={cn('text-sm font-semibold', burnColor)}>
                          {formatCurrency(displayRawWip, displayCurrency)}
                        </span>
                        <span className="text-xs text-muted-foreground">/</span>
                      </>
                    )}
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatCurrency(displayBudget, displayCurrency)}
                    </span>
                    {displayRawWip > 0 && (
                      <span className={cn('text-xs font-medium', burnColor)}>
                        ({burnPct}%)
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          
          {Object.entries(providerTotals)
            .filter(([name]) => name !== 'Baker McKenzie')
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([lcName, data]) => {
              if (data.budget === 0 && data.rawWip === 0) return null;
              
              const displayBudget = differentBillingCurrency && agreedBillingAmount > 0
                ? data.budget * mandatedRate
                : data.budget;
              const displayRawWip = differentBillingCurrency && agreedBillingAmount > 0
                ? data.rawWip * mandatedRate
                : data.rawWip;
              const displayWriteOff = differentBillingCurrency && agreedBillingAmount > 0
                ? data.writeOff * mandatedRate
                : data.writeOff;
              const displayAdjWip = displayRawWip - displayWriteOff;
              const burnPct = displayBudget > 0 ? Math.round((displayAdjWip / displayBudget) * 100) : 0;
              const burnColor = burnPct > 100 ? 'text-red-600 dark:text-red-400' : 
                               burnPct > 85 ? 'text-orange-600 dark:text-orange-400' : 
                               burnPct > 70 ? 'text-amber-600 dark:text-amber-400' : 
                               'text-green-600 dark:text-green-400';
              
              return (
                <div
                  key={lcName}
                  className="rounded-md px-3 py-2 border bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 min-w-[160px]"
                >
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                    {lcName}
                  </div>
                  {displayWriteOff > 0 ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Raw:</span>
                        <span className="font-medium">{formatCurrency(displayRawWip, displayCurrency)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <span>W/O:</span>
                        <span className="font-medium">-{formatCurrency(displayWriteOff, displayCurrency)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground">Adj:</span>
                        <span className={cn('font-semibold', burnColor)}>
                          {formatCurrency(displayAdjWip, displayCurrency)}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                          {formatCurrency(displayBudget, displayCurrency)}
                        </span>
                        <span className={cn('font-medium', burnColor)}>
                          ({burnPct}%)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      {displayRawWip > 0 && (
                        <>
                          <span className={cn('text-sm font-semibold', burnColor)}>
                            {formatCurrency(displayRawWip, displayCurrency)}
                          </span>
                          <span className="text-xs text-muted-foreground">/</span>
                        </>
                      )}
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(displayBudget, displayCurrency)}
                      </span>
                      {displayRawWip > 0 && (
                        <span className={cn('text-xs font-medium', burnColor)}>
                          ({burnPct}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}