import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowRightCircle, Lightbulb, ArrowUpDown } from 'lucide-react';
import { formatCurrency, convertToUsd } from '@/lib/currencyUtils';
import { getClientDisplayName } from '@/lib/clientUtils';
import { ProgressSlider } from './ProgressSlider';
import { HighlightedFinancialValue } from './HighlightedFinancialValue';
import { MatterWithFinancials, MatterCategory } from '@/lib/hooks/useMatters';

// Types for column definitions
export type SortField = 'matter_name' | 'fee_amount' | 'bm_fee' | 'headroom' | 'headroom_pct' | 'wip' | 'ar' | 'paid' | 'budget_burn' | 'budget_burn_pct' | 'local_burn_pct' | 'local_counsel' | 'progress' | 'burn_rate_usd';

export interface ColumnRenderContext {
  matter: MatterWithFinancials;
  isLive: boolean;
  isPipeline: boolean;
  isPipelineOrLost: boolean;
  gbpToUsdRate: number;
  liveRates: Record<string, number> | undefined;
  masterHighlightEnabled: boolean;
  masterChangesMap: Map<string, {
    before_wip_amount: number;
    before_billed_amount: number;
    before_paid_amount: number;
    before_accounts_receivable: number;
    before_wip_write_off_amount: number;
    created_at: string;
  }>;
  updateMatter: {
    mutateAsync: (input: any) => Promise<unknown>;
    isPending?: boolean;
  };
  updateLocalCounselBilling: (matterId: string, value: 'Direct' | 'Disb' | null) => Promise<void>;
  updateLcBillingMode: (lcId: string, value: 'Direct' | 'Disb' | null) => Promise<void>;
  getCategoryActions: (matter: MatterWithFinancials) => { label: string; category: MatterCategory; outcome?: 'Won' | 'Lost' }[];
  handleCategoryChange: (matterId: string, newCategory: MatterCategory, pipelineOutcome?: 'Won' | 'Lost') => Promise<void>;
  budgetBurn: number;
}

export interface HeaderRenderContext {
  toggleSort: (field: SortField) => void;
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
}

export interface TableColumnDefinition {
  id: string;
  // Returns the header content
  renderHeader: (ctx: HeaderRenderContext) => ReactNode;
  // Returns the cell content
  renderCell: (ctx: ColumnRenderContext) => ReactNode;
  // Header classes
  headerClassName?: string;
  // Cell classes 
  cellClassName?: string | ((ctx: ColumnRenderContext) => string);
  // Which categories this column applies to
  categories: ('Live' | 'Pipeline' | 'Closed' | 'Lost')[];
  // Minimum width
  minWidth?: string;
}

// Sortable header component
function SortableHeader({ 
  field, 
  children, 
  toggleSort, 
  sortField, 
  sortDirection 
}: { 
  field: SortField; 
  children: ReactNode;
  toggleSort: (field: SortField) => void;
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => toggleSort(field)}
    >
      {children}
      <ArrowUpDown className={cn(
        "ml-2 h-4 w-4",
        sortField === field && "text-primary"
      )} />
    </Button>
  );
}

// Helper to get fee type label
const getFeeTypeLabel = (feeType: string | null) => {
  if (!feeType) return null;
  if (feeType.includes('Cap')) return 'Cap';
  if (feeType.includes('Estimate')) return 'Estimate';
  return feeType;
};

// Helper for exhaustion color
const getExhaustionColor = (months: number) => {
  if (months <= 0) return 'text-destructive';
  if (months <= 2) return 'text-warning';
  if (months <= 4) return 'text-amber-500';
  return 'text-success';
};

// Column definitions
export const columnDefinitions: Record<string, TableColumnDefinition> = {
  // Client/Matter - locked first column
  client_matter: {
    id: 'client_matter',
    categories: ['Live', 'Pipeline', 'Closed', 'Lost'],
    headerClassName: 'min-w-[140px] sticky left-0 z-20 bg-background',
    cellClassName: 'sticky left-0 z-10 bg-background max-w-[200px]',
    renderHeader: (ctx) => (
      <SortableHeader field="matter_name" {...ctx}>Client / Matter</SortableHeader>
    ),
    renderCell: (ctx) => (
      <>
        <Link 
          to={`/matters/${ctx.matter.id}`}
          className="block hover:text-primary transition-colors"
        >
          <p className="font-medium text-foreground">{getClientDisplayName(ctx.matter.clients)}</p>
          <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors line-clamp-2" title={ctx.matter.matter_name}>
            {(ctx.matter as any).matter_display_name || ctx.matter.matter_name}
          </p>
        </Link>
        {(ctx.matter as any).show_shaping_proposal && (ctx.matter as any).selected_proposal && (
          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 whitespace-nowrap">
            <Lightbulb className="h-3 w-3" />
            WIP Proposal
          </span>
        )}
      </>
    ),
  },

  // Financials - Live only
  financials: {
    id: 'financials',
    categories: ['Live'],
    headerClassName: 'text-right min-w-[110px]',
    cellClassName: (ctx) => cn(
      "p-1",
      (ctx.matter as any).show_shaping_proposal && (ctx.matter as any).selected_proposal && "bg-amber-50 dark:bg-amber-900/20"
    ),
    renderHeader: () => <span>Financials</span>,
    renderCell: (ctx) => {
      const changeData = ctx.masterChangesMap.get(ctx.matter.id);
      const currency = (ctx.matter as any).effective_currency ?? ctx.matter.fee_currency;
      const currentWip = ctx.matter.latest_snapshot?.wip_amount || 0;
      const currentAr = ctx.matter.latest_snapshot?.accounts_receivable || 0;
      const currentPaid = ctx.matter.latest_snapshot?.paid_amount || 0;
      const currentWriteOff = ctx.matter.latest_snapshot?.wip_write_off_amount || 0;
      
      const wipChanged = ctx.masterHighlightEnabled && changeData && currentWip !== changeData.before_wip_amount;
      const arChanged = ctx.masterHighlightEnabled && changeData && currentAr !== changeData.before_accounts_receivable;
      const paidChanged = ctx.masterHighlightEnabled && changeData && currentPaid !== changeData.before_paid_amount;
      const writeOffChanged = ctx.masterHighlightEnabled && changeData && currentWriteOff !== changeData.before_wip_write_off_amount;
      
      return (
        <div className="flex flex-col gap-0.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <span className="text-[10px] text-muted-foreground leading-tight">BM WIP:</span>
            <HighlightedFinancialValue
              currentValue={formatCurrency(currentWip, currency)}
              previousValue={changeData?.before_wip_amount}
              previousDate={changeData?.created_at}
              isHighlighted={!!wipChanged}
              className="text-xs font-medium"
              formatFn={(v) => formatCurrency(v, currency)}
            />
          </div>
          {currentWriteOff > 0 && (
            <div className="flex items-center justify-end gap-1">
              <HighlightedFinancialValue
                currentValue={`W/O: ${formatCurrency(currentWriteOff, currency)}`}
                previousValue={changeData?.before_wip_write_off_amount}
                previousDate={changeData?.created_at}
                isHighlighted={!!writeOffChanged}
                className="text-[9px] text-destructive leading-tight"
                formatFn={(v) => formatCurrency(v, currency)}
              />
            </div>
          )}
          <div className="flex items-center justify-end gap-1">
            <span className="text-[10px] text-muted-foreground leading-tight">AR:</span>
            <HighlightedFinancialValue
              currentValue={formatCurrency(currentAr, currency)}
              previousValue={changeData?.before_accounts_receivable}
              previousDate={changeData?.created_at}
              isHighlighted={!!arChanged}
              className="text-xs font-medium"
              formatFn={(v) => formatCurrency(v, currency)}
            />
          </div>
          <div className="flex items-center justify-end gap-1">
            <span className="text-[10px] text-muted-foreground leading-tight">Paid:</span>
            <HighlightedFinancialValue
              currentValue={formatCurrency(currentPaid, currency)}
              previousValue={changeData?.before_paid_amount}
              previousDate={changeData?.created_at}
              isHighlighted={!!paidChanged}
              className="text-xs font-medium text-success"
              formatFn={(v) => formatCurrency(v, currency)}
            />
          </div>
        </div>
      );
    },
  },

  // BM Burn - Live only
  bm_burn: {
    id: 'bm_burn',
    categories: ['Live'],
    headerClassName: 'text-right min-w-[75px]',
    cellClassName: (ctx) => cn(
      "text-right",
      (ctx.matter as any).show_shaping_proposal && (ctx.matter as any).selected_proposal && "bg-amber-50 dark:bg-amber-900/20"
    ),
    renderHeader: (ctx) => (
      <SortableHeader field="budget_burn_pct" {...ctx}>BM Burn</SortableHeader>
    ),
    renderCell: (ctx) => {
      const currency = (ctx.matter as any).effective_currency ?? ctx.matter.fee_currency;
      return (
        <div className="flex flex-col items-end">
          <span className="text-muted-foreground">
            {formatCurrency(ctx.budgetBurn, currency)}
          </span>
          {currency !== 'USD' && (
            <span className="text-[10px] text-muted-foreground/70">
              ≈ {formatCurrency(convertToUsd(ctx.budgetBurn, currency, ctx.matter.exchange_rate, ctx.gbpToUsdRate, ctx.liveRates), 'USD')}
            </span>
          )}
          <span className={cn(
            "text-[10px]",
            (100 - ((ctx.matter as any).bm_headroom_percent || 0)) > 100 ? "text-danger" :
            (100 - ((ctx.matter as any).bm_headroom_percent || 0)) > 80 ? "text-warning" : "text-success"
          )}>
            {(100 - ((ctx.matter as any).bm_headroom_percent || 0)).toFixed(0)}%
          </span>
        </div>
      );
    },
  },

  // Local Burn - Live only
  local_burn: {
    id: 'local_burn',
    categories: ['Live'],
    headerClassName: 'text-right min-w-[75px]',
    cellClassName: (ctx) => cn(
      "text-right",
      (ctx.matter as any).show_shaping_proposal && (ctx.matter as any).selected_proposal && "bg-amber-50 dark:bg-amber-900/20"
    ),
    renderHeader: (ctx) => (
      <SortableHeader field="local_burn_pct" {...ctx}>Local Burn</SortableHeader>
    ),
    renderCell: (ctx) => {
      const currency = (ctx.matter as any).effective_currency ?? ctx.matter.fee_currency;
      if (ctx.matter.local_counsel_billing === 'Disb' && ctx.matter.local_counsel_fee > 0) {
        return (
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground">
              {formatCurrency(((ctx.matter as any).lc_wip || 0) + ((ctx.matter as any).lc_billed || 0), currency)}
            </span>
            <span className={cn(
              "text-[10px]",
              (100 - ((ctx.matter as any).lc_headroom_percent || 0)) > 100 ? "text-danger" :
              (100 - ((ctx.matter as any).lc_headroom_percent || 0)) > 80 ? "text-warning" : "text-success"
            )}>
              {(100 - ((ctx.matter as any).lc_headroom_percent || 0)).toFixed(0)}%
            </span>
          </div>
        );
      }
      return <span className="text-muted-foreground/50">-</span>;
    },
  },

  // Burn Rate - Live only
  burn_rate: {
    id: 'burn_rate',
    categories: ['Live'],
    headerClassName: 'text-right min-w-[100px]',
    cellClassName: (ctx) => cn(
      "text-right",
      (ctx.matter as any).show_shaping_proposal && (ctx.matter as any).selected_proposal && "bg-amber-50 dark:bg-amber-900/20"
    ),
    renderHeader: (ctx) => (
      <SortableHeader field="burn_rate_usd" {...ctx}>BM Burn Rate</SortableHeader>
    ),
    renderCell: (ctx) => {
      if (!ctx.matter.start_date) {
        return <span className="text-destructive text-xs">N/A</span>;
      }
      const startDate = parseISO(ctx.matter.start_date);
      const now = new Date();
      
      const yearDiff = now.getFullYear() - startDate.getFullYear();
      const monthDiff = now.getMonth() - startDate.getMonth();
      const dayDiff = now.getDate() - startDate.getDate();
      let totalMonths = yearDiff * 12 + monthDiff;
      const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      totalMonths += dayDiff / daysInCurrentMonth;
      const monthsElapsed = Math.max(totalMonths, 0.1);
      
      if (monthsElapsed <= 0) {
        return <span className="text-muted-foreground text-xs">-</span>;
      }
      
      const currency = (ctx.matter as any).effective_currency ?? ctx.matter.fee_currency;
      const burnUsd = convertToUsd(ctx.budgetBurn, currency, ctx.matter.exchange_rate, ctx.gbpToUsdRate, ctx.liveRates);
      const bmBudgetUsd = convertToUsd((ctx.matter as any).effective_bm_fee ?? ctx.matter.bm_fee_component, currency, ctx.matter.exchange_rate, ctx.gbpToUsdRate, ctx.liveRates);
      const burnRateUsd = burnUsd / monthsElapsed;
      const remainingBudget = bmBudgetUsd - burnUsd;
      const monthsToExhaustion = burnRateUsd > 0 ? remainingBudget / burnRateUsd : Infinity;
      
      return (
        <div className="flex flex-col items-end">
          <span className="text-muted-foreground text-xs">
            ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(burnRateUsd)}/m
          </span>
          {burnRateUsd > 0 && (
            <span className={cn("text-[10px] font-medium", getExhaustionColor(monthsToExhaustion))}>
              {monthsToExhaustion <= 0 
                ? 'Over' 
                : monthsToExhaustion === Infinity 
                  ? '-' 
                  : `${monthsToExhaustion.toFixed(1)}m left`}
            </span>
          )}
        </div>
      );
    },
  },

  // BM Headroom - Live only
  bm_headroom: {
    id: 'bm_headroom',
    categories: ['Live'],
    headerClassName: 'text-right min-w-[80px]',
    cellClassName: (ctx) => cn(
      "text-right",
      (ctx.matter as any).show_shaping_proposal && (ctx.matter as any).selected_proposal && "bg-amber-50 dark:bg-amber-900/20"
    ),
    renderHeader: (ctx) => (
      <SortableHeader field="headroom" {...ctx}>BM Headroom</SortableHeader>
    ),
    renderCell: (ctx) => {
      if ((ctx.matter as any).pay_full_time_costs) {
        return <span className="text-muted-foreground">N/A</span>;
      }
      const bmHeadroom = ctx.matter.bm_headroom ?? 0;
      const bmHeadroomPercent = ctx.matter.bm_headroom_percent ?? 0;
      const bmHeadroomStatus = bmHeadroomPercent < 0 ? 'danger' : bmHeadroomPercent < 20 ? 'warning' : 'success';
      const currency = (ctx.matter as any).effective_currency ?? ctx.matter.fee_currency;
      return (
        <div className="flex flex-col items-end">
          <span className={cn(
            "font-medium",
            bmHeadroom < 0 ? "text-danger" : "text-foreground"
          )}>
            {formatCurrency(bmHeadroom, currency)}
          </span>
          <span className={cn(
            "text-[10px]",
            bmHeadroomStatus === 'danger' && 'text-danger',
            bmHeadroomStatus === 'warning' && 'text-warning',
            bmHeadroomStatus === 'success' && 'text-success'
          )}>
            {bmHeadroomPercent.toFixed(0)}%
          </span>
        </div>
      );
    },
  },

  // Budget - All categories
  budget: {
    id: 'budget',
    categories: ['Live', 'Pipeline', 'Closed', 'Lost'],
    headerClassName: 'text-right min-w-[90px]',
    cellClassName: 'text-right',
    renderHeader: (ctx) => (
      <SortableHeader field="fee_amount" {...ctx}>Budget</SortableHeader>
    ),
    renderCell: (ctx) => {
      if ((ctx.matter as any).pay_full_time_costs) {
        return <span className="text-muted-foreground">N/A</span>;
      }
      const currency = (ctx.matter as any).effective_currency ?? ctx.matter.fee_currency;
      return (
        <div className="flex flex-col items-end gap-0.5">
          {ctx.matter.fee_type && (
            <span className="text-[10px] text-muted-foreground">
              {getFeeTypeLabel(ctx.matter.fee_type)}
            </span>
          )}
          <span className="font-medium">
            {formatCurrency((ctx.matter as any).effective_fee_upper_end ?? ctx.matter.fee_amount_upper_end, currency)}
          </span>
          {(ctx.matter as any).different_billing_currency && (ctx.matter as any).agreed_billing_amount > 0 && (
            <span className="text-[10px] text-muted-foreground/70">
              (quoted: {formatCurrency(ctx.matter.fee_amount_upper_end, (ctx.matter as any).quote_currency)})
            </span>
          )}
        </div>
      );
    },
  },

  // USD Value - Pipeline & Lost only
  usd_value: {
    id: 'usd_value',
    categories: ['Pipeline', 'Lost'],
    headerClassName: 'text-right min-w-[80px]',
    cellClassName: 'text-right',
    renderHeader: () => <span>USD</span>,
    renderCell: (ctx) => {
      const currency = (ctx.matter as any).effective_currency ?? ctx.matter.fee_currency;
      return (
        <div className="flex flex-col items-end">
          <span className="text-muted-foreground">
            {formatCurrency((ctx.matter as any).effective_bm_fee ?? ctx.matter.bm_fee_component, currency)}
          </span>
          {!(ctx.matter as any).different_billing_currency && ctx.matter.fee_currency !== 'USD' && (
            <span className="text-[10px] text-muted-foreground/70">
              ≈ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(convertToUsd(ctx.matter.bm_fee_component, ctx.matter.fee_currency || 'GBP', ctx.matter.exchange_rate || 1, ctx.gbpToUsdRate, ctx.liveRates))}
            </span>
          )}
        </div>
      );
    },
  },

  // BM Budget - Live only
  bm_budget: {
    id: 'bm_budget',
    categories: ['Live'],
    headerClassName: 'text-right min-w-[85px]',
    cellClassName: 'text-right font-medium',
    renderHeader: (ctx) => (
      <SortableHeader field="bm_fee" {...ctx}>BM Budget</SortableHeader>
    ),
    renderCell: (ctx) => {
      if ((ctx.matter as any).pay_full_time_costs) {
        return <span className="text-muted-foreground font-normal">N/A</span>;
      }
      const currency = (ctx.matter as any).effective_currency ?? ctx.matter.fee_currency;
      return (
        <div className="flex flex-col items-end">
          <span>{formatCurrency((ctx.matter as any).effective_bm_fee ?? ctx.matter.bm_fee_component, currency)}</span>
          {currency !== 'USD' && (
            <span className="text-[10px] text-muted-foreground/70 font-normal">
              ≈ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(convertToUsd((ctx.matter as any).effective_bm_fee ?? ctx.matter.bm_fee_component, currency ?? 'GBP', ctx.matter.exchange_rate || 1, ctx.gbpToUsdRate, ctx.liveRates))}
            </span>
          )}
        </div>
      );
    },
  },

  // Local Budget - Live only
  local_budget: {
    id: 'local_budget',
    categories: ['Live'],
    headerClassName: 'text-right min-w-[95px]',
    cellClassName: 'text-right',
    renderHeader: (ctx) => (
      <SortableHeader field="local_counsel" {...ctx}>Local Budget</SortableHeader>
    ),
    renderCell: (ctx) => {
      if ((ctx.matter as any).pay_full_time_costs) {
        return <span className="text-muted-foreground">N/A</span>;
      }
      const currency = (ctx.matter as any).effective_currency ?? ctx.matter.fee_currency;
      const localCounsels = (ctx.matter as any).local_counsels || [];
      
      return (
        <div className="flex flex-col items-end gap-1">
          <span className="text-muted-foreground">
            {formatCurrency((ctx.matter as any).effective_local_counsel_fee ?? ctx.matter.local_counsel_fee, currency)}
          </span>
          {localCounsels.length > 0 ? (
            <div className="flex flex-col gap-1 items-end">
              {localCounsels.map((lc: any) => {
                const hasSelection = lc.billing_mode === 'Disb' || lc.billing_mode === 'Direct';
                return (
                  <div key={lc.id} className="flex items-center gap-1">
                    <span className={cn(
                      "text-[8px] leading-none truncate max-w-[60px]",
                      hasSelection ? "text-muted-foreground" : "text-destructive"
                    )} title={lc.firm_name}>
                      {lc.firm_name.length > 10 ? lc.firm_name.slice(0, 10) + '…' : lc.firm_name}
                    </span>
                    <label className={cn(
                      "flex items-center gap-0.5 cursor-pointer text-[9px] leading-none",
                      hasSelection ? "text-success" : "text-destructive"
                    )}>
                      <input
                        type="checkbox"
                        checked={lc.billing_mode === 'Disb'}
                        onChange={async () => {
                          const newValue = lc.billing_mode === 'Disb' ? null : 'Disb';
                          await ctx.updateLcBillingMode(lc.id, newValue);
                        }}
                        className={cn(
                          "h-2.5 w-2.5 rounded-sm border cursor-pointer accent-current",
                          lc.billing_mode === 'Disb' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                        )}
                      />
                      D
                    </label>
                    <label className={cn(
                      "flex items-center gap-0.5 cursor-pointer text-[9px] leading-none",
                      hasSelection ? "text-success" : "text-destructive"
                    )}>
                      <input
                        type="checkbox"
                        checked={lc.billing_mode === 'Direct'}
                        onChange={async () => {
                          const newValue = lc.billing_mode === 'Direct' ? null : 'Direct';
                          await ctx.updateLcBillingMode(lc.id, newValue);
                        }}
                        className={cn(
                          "h-2.5 w-2.5 rounded-sm border cursor-pointer accent-current",
                          lc.billing_mode === 'Direct' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                        )}
                      />
                      Dir
                    </label>
                  </div>
                );
              })}
            </div>
          ) : (ctx.matter.local_counsel_fee || 0) > 0 && (
            (() => {
              const hasSelection = ctx.matter.local_counsel_billing === 'Disb' || ctx.matter.local_counsel_billing === 'Direct';
              return (
                <div className="flex items-center gap-1.5">
                  <label className={cn(
                    "flex items-center gap-0.5 cursor-pointer text-[9px] leading-none",
                    hasSelection ? "text-success" : "text-destructive"
                  )}>
                    <input
                      type="checkbox"
                      checked={ctx.matter.local_counsel_billing === 'Disb'}
                      onChange={async () => {
                        const newValue = ctx.matter.local_counsel_billing === 'Disb' ? null : 'Disb';
                        await ctx.updateLocalCounselBilling(ctx.matter.id, newValue);
                      }}
                      className={cn(
                        "h-2.5 w-2.5 rounded-sm border cursor-pointer accent-current",
                        ctx.matter.local_counsel_billing === 'Disb' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                      )}
                    />
                    Disb
                  </label>
                  <label className={cn(
                    "flex items-center gap-0.5 cursor-pointer text-[9px] leading-none",
                    hasSelection ? "text-success" : "text-destructive"
                  )}>
                    <input
                      type="checkbox"
                      checked={ctx.matter.local_counsel_billing === 'Direct'}
                      onChange={async () => {
                        const newValue = ctx.matter.local_counsel_billing === 'Direct' ? null : 'Direct';
                        await ctx.updateLocalCounselBilling(ctx.matter.id, newValue);
                      }}
                      className={cn(
                        "h-2.5 w-2.5 rounded-sm border cursor-pointer accent-current",
                        ctx.matter.local_counsel_billing === 'Direct' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                      )}
                    />
                    Direct
                  </label>
                </div>
              );
            })()
          )}
        </div>
      );
    },
  },

  // Source - Pipeline & Lost
  source: {
    id: 'source',
    categories: ['Pipeline', 'Lost'],
    headerClassName: 'min-w-[70px]',
    cellClassName: 'text-muted-foreground text-sm',
    renderHeader: () => <span>Source</span>,
    renderCell: (ctx) => ctx.matter.source || '-',
  },

  // Clarifications Date - Pipeline only
  clarif_date: {
    id: 'clarif_date',
    categories: ['Pipeline'],
    headerClassName: 'min-w-[75px]',
    cellClassName: 'text-sm',
    renderHeader: () => <span>Clarif.</span>,
    renderCell: (ctx) => {
      if (!ctx.matter.clarifications_date) return '-';
      const isUrgent = !ctx.matter.submitted && 
        differenceInDays(parseISO(ctx.matter.clarifications_date), new Date()) <= 3 &&
        differenceInDays(parseISO(ctx.matter.clarifications_date), new Date()) >= 0;
      return (
        <span className={cn(isUrgent ? "text-warning font-medium" : "text-muted-foreground")}>
          {format(parseISO(ctx.matter.clarifications_date), 'dd MMM yy')}
        </span>
      );
    },
  },

  // Submit Date - Pipeline only
  submit_date: {
    id: 'submit_date',
    categories: ['Pipeline'],
    headerClassName: 'min-w-[75px]',
    cellClassName: 'text-sm',
    renderHeader: () => <span>Submit</span>,
    renderCell: (ctx) => {
      if (!ctx.matter.submission_deadline) return '-';
      const deadlineDate = parseISO(ctx.matter.submission_deadline);
      const daysUntil = differenceInDays(deadlineDate, new Date());
      const isOverdue = isPast(deadlineDate) && !isToday(deadlineDate);
      const isUrgent = !isOverdue && daysUntil <= 3;
      const needsAttention = !ctx.matter.submitted && (isOverdue || isUrgent);
      
      return (
        <span className={cn(
          needsAttention && isOverdue && "text-destructive font-medium",
          needsAttention && isUrgent && "text-warning font-medium",
          !needsAttention && "text-muted-foreground"
        )}>
          {format(deadlineDate, 'dd MMM yy')}
        </span>
      );
    },
  },

  // Decision Date - Pipeline only
  decision_date: {
    id: 'decision_date',
    categories: ['Pipeline'],
    headerClassName: 'min-w-[70px]',
    cellClassName: 'text-sm text-muted-foreground',
    renderHeader: () => <span>Decision</span>,
    renderCell: (ctx) => ctx.matter.decision_date ? format(parseISO(ctx.matter.decision_date), 'dd MMM yy') : '-',
  },

  // Submitted - Pipeline only
  submitted: {
    id: 'submitted',
    categories: ['Pipeline'],
    headerClassName: 'min-w-[60px]',
    cellClassName: '',
    renderHeader: () => <span>Sent</span>,
    renderCell: (ctx) => (
      <span className={cn(
        "text-xs font-medium px-2 py-1 rounded",
        ctx.matter.submitted ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
      )}>
        {ctx.matter.submitted ? 'Yes' : 'No'}
      </span>
    ),
  },

  // Outcome - Pipeline only
  outcome: {
    id: 'outcome',
    categories: ['Pipeline'],
    headerClassName: 'min-w-[65px]',
    cellClassName: '',
    renderHeader: () => <span>Outcome</span>,
    renderCell: (ctx) => {
      const outcome = (ctx.matter as any).pipeline_outcome;
      if (!outcome) return <span className="text-muted-foreground">-</span>;
      return (
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded",
          outcome === 'Won' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          outcome === 'Lost' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          outcome === 'Pending' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        )}>
          {outcome}
        </span>
      );
    },
  },

  // Progress - Live only
  progress: {
    id: 'progress',
    categories: ['Live'],
    headerClassName: 'min-w-[180px]',
    cellClassName: (ctx) => cn(
      (ctx.matter as any).show_shaping_proposal && (ctx.matter as any).selected_proposal && "bg-amber-50 dark:bg-amber-900/20"
    ),
    renderHeader: (ctx) => (
      <SortableHeader field="progress" {...ctx}>Progress</SortableHeader>
    ),
    renderCell: (ctx) => (
      <ProgressSlider
        matterId={ctx.matter.id}
        initialProgress={(ctx.matter as any).progress || 0}
        currency={(ctx.matter as any).effective_currency ?? ctx.matter.fee_currency}
        currentBurn={ctx.budgetBurn}
        bmBudget={ctx.matter.bm_fee_component || 0}
        onSave={async (id, progress) => {
          await ctx.updateMatter.mutateAsync({ id, progress });
        }}
        compact={true}
      />
    ),
  },

  // Practice Area - All categories
  practice: {
    id: 'practice',
    categories: ['Live', 'Pipeline', 'Closed', 'Lost'],
    headerClassName: 'min-w-[70px]',
    cellClassName: 'text-muted-foreground text-sm',
    renderHeader: () => <span>Practice</span>,
    renderCell: (ctx) => ctx.matter.practice_area || '-',
  },

  // Status - Live & Closed only
  status: {
    id: 'status',
    categories: ['Live', 'Closed'],
    headerClassName: 'w-16',
    cellClassName: '',
    renderHeader: () => <span>Status</span>,
    renderCell: (ctx) => {
      const displayStatus = ctx.matter.aml_kyc_complete && ctx.matter.assignment_letter_signed && ctx.matter.matter_open
        ? 'Open'
        : 'ATTN';
      return <StatusBadge status={displayStatus} />;
    },
  },

  // Actions - All categories
  actions: {
    id: 'actions',
    categories: ['Live', 'Pipeline', 'Closed', 'Lost'],
    headerClassName: 'w-12 min-w-[48px]',
    cellClassName: '',
    renderHeader: () => <span>Actions</span>,
    renderCell: (ctx) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ctx.getCategoryActions(ctx.matter).map((action) => (
            <DropdownMenuItem
              key={action.label}
              onClick={() => ctx.handleCategoryChange(ctx.matter.id, action.category, action.outcome)}
              className="cursor-pointer"
            >
              <ArrowRightCircle className="mr-2 h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
};

// Get ordered columns for a category based on user preferences
export function getOrderedColumns(
  category: 'Live' | 'Pipeline' | 'Closed' | 'Lost',
  userColumns: { id: string; visible: boolean }[]
): TableColumnDefinition[] {
  // Filter column definitions to those that apply to this category
  const applicableColumnIds = Object.keys(columnDefinitions).filter(
    id => columnDefinitions[id].categories.includes(category)
  );
  
  // Order columns based on userColumns order, only including visible ones
  const orderedColumns: TableColumnDefinition[] = [];
  
  for (const userCol of userColumns) {
    if (userCol.visible && applicableColumnIds.includes(userCol.id) && columnDefinitions[userCol.id]) {
      orderedColumns.push(columnDefinitions[userCol.id]);
    }
  }
  
  // Add any columns that might be in definitions but not in user settings
  for (const id of applicableColumnIds) {
    if (!orderedColumns.find(c => c.id === id)) {
      // Check if it should be visible by default
      const userCol = userColumns.find(u => u.id === id);
      if (!userCol || userCol.visible) {
        orderedColumns.push(columnDefinitions[id]);
      }
    }
  }
  
  return orderedColumns;
}
