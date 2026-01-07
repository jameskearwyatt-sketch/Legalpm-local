import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { differenceInDays, parseISO, isAfter, format } from 'date-fns';
import { convertToUsd } from '@/lib/currencyUtils';
import { useExchangeRates } from './useExchangeRates';

export interface TrendDataPoint {
  date: string;
  rawDate: string; // Original ISO date for deletion
  wip: number;
  billed: number;
  paid: number;
}

export interface LiveMatter {
  id: string;
  matterName: string;
  clientName: string;
}

export interface DashboardStats {
  totalBudget: number;
  totalWip: number;
  totalBilled: number;
  totalPaid: number;
  avgCollectionRate: number;
  openMattersCount: number;
  alerts: Alert[];
  pipelineAlerts: PipelineAlert[];
  trendData: TrendDataPoint[];
  liveMatters: LiveMatter[];
}

export interface Alert {
  id: string;
  type: 'Over Budget' | 'Near Budget' | 'High WIP' | 'Poor Collection' | 'Stale Financials' | 'Stale LC Financials';
  matterId: string;
  matterName: string;
  matterNumber: string;
  cmNumber: string;
  clientName: string;
  message: string;
  currency: string;
  value?: number;
}

export interface PipelineAlert {
  id: string;
  type: 'RFP Deadline Soon' | 'Awaiting Decision';
  matterId: string;
  matterName: string;
  cmNumber: string;
  clientName: string;
  message: string;
}

export function useDashboard(excludedMatterIds: string[] = []) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard', user?.id, excludedMatterIds.sort().join(',')],
    queryFn: async () => {
      // Fetch exchange rates for GBP to USD conversion
      const { data: ratesData } = await supabase.functions.invoke('fetch-exchange-rates');
      // Calculate GBP to USD rate: if 1 USD = 0.79 GBP, then 1 GBP = 1/0.79 USD = 1.27 USD
      const gbpToUsdRate = ratesData?.rates?.GBP ? (1 / ratesData.rates.GBP) : 1.27;
      
      // Get all Live matters with their clients
      const { data: liveMatters, error: mattersError } = await supabase
        .from('matters')
        .select(`
          *,
          clients (id, name),
          matter_local_counsels (id, last_updated)
        `)
        .eq('category', 'Live');

      if (mattersError) throw mattersError;

      // Get all Pipeline matters for pipeline alerts
      const { data: pipelineMatters, error: pipelineError } = await supabase
        .from('matters')
        .select(`
          *,
          clients (id, name)
        `)
        .eq('category', 'Pipeline');

      if (pipelineError) throw pipelineError;

      const matterIds = liveMatters?.map(m => m.id) || [];
      
      // Build live matters list for the UI (always includes all matters)
      const liveMattersForUI: LiveMatter[] = (liveMatters || []).map(matter => ({
        id: matter.id,
        matterName: matter.matter_name,
        clientName: matter.clients?.name || 'Unknown Client',
      }));

      if (matterIds.length === 0 && (!pipelineMatters || pipelineMatters.length === 0)) {
        return {
          totalBudget: 0,
          totalWip: 0,
          totalBilled: 0,
          totalPaid: 0,
          avgCollectionRate: 0,
          openMattersCount: 0,
          alerts: [],
          pipelineAlerts: [],
          trendData: [],
          liveMatters: liveMattersForUI,
        } as DashboardStats;
      }

      // Create set of excluded matter IDs for quick lookup
      const excludedSet = new Set(excludedMatterIds);

      // Get latest snapshots for each matter
      const { data: snapshots } = matterIds.length > 0 ? await supabase
        .from('financial_snapshots')
        .select('*')
        .in('matter_id', matterIds)
        .order('as_of_date', { ascending: false }) : { data: [] };

      // Create a map of matter_id to latest snapshot
      const snapshotMap = new Map<string, any>();
      snapshots?.forEach(snap => {
        if (!snapshotMap.has(snap.matter_id)) {
          snapshotMap.set(snap.matter_id, snap);
        }
      });

      let totalBmFeesUsd = 0;
      let totalWipUsd = 0;
      let totalBilledUsd = 0;
      let totalPaidUsd = 0;
      const alerts: Alert[] = [];
      const pipelineAlerts: PipelineAlert[] = [];
      const today = new Date();

      liveMatters?.forEach(matter => {
        const snapshot = snapshotMap.get(matter.id);
        const isExcluded = excludedSet.has(matter.id);
        
        // Use bm_fee_component as the BM fee and convert to USD using proper conversion
        const bmFee = Number(matter.bm_fee_component) || 0;
        const exchangeRate = Number(matter.exchange_rate) || 1;
        const feeCurrency = matter.fee_currency || 'GBP';
        const budget = Number(matter.fee_amount_upper_end) || 0;
        const wipAmount = Number(snapshot?.wip_amount) || 0;
        const billedAmount = Number(snapshot?.billed_amount) || 0;
        const paidAmount = Number(snapshot?.paid_amount) || 0;
        
        // Calculate effective BM fee - accounts for billing currency conversion
        const differentBillingCurrency = matter.different_billing_currency || false;
        const agreedBillingAmount = Number(matter.agreed_billing_amount) || 0;
        const originalFeeUpperEnd = Number(matter.fee_amount_upper_end) || 0;
        
        let effectiveBmFee = bmFee;
        if (differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0) {
          // Calculate BM portion of the billing currency amount
          const bmProportion = bmFee / originalFeeUpperEnd;
          effectiveBmFee = agreedBillingAmount * bmProportion;
        }

        // Only include in financial totals if not excluded
        if (!isExcluded) {
          // Convert to USD using proper conversion (via GBP)
          totalBmFeesUsd += convertToUsd(effectiveBmFee, feeCurrency, exchangeRate, gbpToUsdRate);
          totalWipUsd += convertToUsd(wipAmount, feeCurrency, exchangeRate, gbpToUsdRate);
          totalBilledUsd += convertToUsd(billedAmount, feeCurrency, exchangeRate, gbpToUsdRate);
          totalPaidUsd += convertToUsd(paidAmount, feeCurrency, exchangeRate, gbpToUsdRate);
        }

        const totalUsed = billedAmount + wipAmount;
        const budgetUsedPercent = budget > 0 ? (totalUsed / budget) * 100 : 0;
        const collectionRate = billedAmount > 0 ? (paidAmount / billedAmount) * 100 : 100;
        const clientName = matter.clients?.name || 'Unknown Client';

        // Use cm_number if available, otherwise show placeholder
        const cmNumber = matter.cm_number && matter.cm_number.trim() !== '' 
          ? matter.cm_number 
          : '[CM number required]';
        
        // Get the correct currency symbol for display
        const currencySymbols: Record<string, string> = {
          'GBP': '£', 'USD': '$', 'EUR': '€', 'MYR': 'RM ', 'CHF': 'CHF ', 'AUD': 'A$', 'CAD': 'C$', 'SGD': 'S$'
        };
        const currencySymbol = currencySymbols[feeCurrency] || feeCurrency + ' ';

        // Over budget check
        if (budget > 0 && totalUsed > budget) {
          alerts.push({
            id: `over-${matter.id}`,
            type: 'Over Budget',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            cmNumber,
            clientName,
            currency: feeCurrency,
            message: `Budget exceeded by ${currencySymbol}${new Intl.NumberFormat('en-GB').format(totalUsed - budget)}`,
            value: budgetUsedPercent,
          });
        }
        // Near budget check (>= 80%)
        else if (budget > 0 && budgetUsedPercent >= 80 && budgetUsedPercent <= 100) {
          alerts.push({
            id: `near-${matter.id}`,
            type: 'Near Budget',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            cmNumber,
            clientName,
            currency: feeCurrency,
            message: `${budgetUsedPercent.toFixed(0)}% of budget used`,
            value: budgetUsedPercent,
          });
        }

        // High WIP check
        if (wipAmount > 50000 && billedAmount < wipAmount * 0.5) {
          alerts.push({
            id: `wip-${matter.id}`,
            type: 'High WIP',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            cmNumber,
            clientName,
            currency: feeCurrency,
            message: `WIP of ${currencySymbol}${new Intl.NumberFormat('en-GB').format(wipAmount)} with low billing`,
            value: wipAmount,
          });
        }

        // Poor collection check
        if (billedAmount > 0 && collectionRate < 60) {
          alerts.push({
            id: `collection-${matter.id}`,
            type: 'Poor Collection',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            cmNumber,
            clientName,
            currency: feeCurrency,
            message: `Collection rate at ${collectionRate.toFixed(0)}%`,
            value: collectionRate,
          });
        }


        // Stale financials check - no update in 10+ days
        if (snapshot?.updated_at) {
          const snapshotUpdatedAt = parseISO(snapshot.updated_at);
          const daysSinceUpdate = differenceInDays(today, snapshotUpdatedAt);
          if (daysSinceUpdate >= 10) {
            alerts.push({
              id: `stale-${matter.id}`,
              type: 'Stale Financials',
              matterId: matter.id,
              matterName: matter.matter_name,
              matterNumber: matter.matter_number,
              cmNumber,
              clientName,
              currency: feeCurrency,
              message: `Financials not updated for ${daysSinceUpdate} days`,
              value: daysSinceUpdate,
            });
          }
        } else if (budget > 0) {
          // No snapshot at all for a matter with a budget
          alerts.push({
            id: `stale-${matter.id}`,
            type: 'Stale Financials',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            cmNumber,
            clientName,
            currency: feeCurrency,
          message: `No financial data recorded`,
        });
      }

        // Stale LC financials check - only for Disbursement mode with local counsel fee
        const localCounselFee = Number(matter.local_counsel_fee) || 0;
        if (localCounselFee > 0 && matter.local_counsel_billing === 'Disb') {
          const localCounsels = (matter as any).matter_local_counsels || [];
          
          if (localCounsels.length === 0) {
            // No LC records at all
            alerts.push({
              id: `stale-lc-${matter.id}`,
              type: 'Stale LC Financials',
              matterId: matter.id,
              matterName: matter.matter_name,
              matterNumber: matter.matter_number,
              cmNumber,
              clientName,
              currency: feeCurrency,
              message: `No LC financials recorded`,
            });
          } else {
            // Check if any LC has stale data (no update or 10+ days old)
            const staleLCs = localCounsels.filter((lc: any) => {
              if (!lc.last_updated) return true;
              const daysSinceUpdate = differenceInDays(today, parseISO(lc.last_updated));
              return daysSinceUpdate >= 10;
            });
            
            if (staleLCs.length > 0) {
              alerts.push({
                id: `stale-lc-${matter.id}`,
                type: 'Stale LC Financials',
                matterId: matter.id,
                matterName: matter.matter_name,
                matterNumber: matter.matter_number,
                cmNumber,
                clientName,
                currency: feeCurrency,
                message: `${staleLCs.length} LC firm${staleLCs.length > 1 ? 's' : ''} not updated in 10+ days`,
              });
            }
          }
        }
    });


      // Generate pipeline alerts
      pipelineMatters?.forEach(matter => {
        const clientName = matter.clients?.name || 'Unknown Client';
        const cmNumber = matter.cm_number && matter.cm_number.trim() !== '' 
          ? matter.cm_number 
          : '[CM number required]';

        if (matter.submission_deadline) {
          const deadline = parseISO(matter.submission_deadline);
          const daysUntilDeadline = differenceInDays(deadline, today);
          
          if (!matter.submitted) {
            // Not yet submitted - check if deadline is within 7 days
            if (daysUntilDeadline <= 7 && daysUntilDeadline >= 0) {
              const daysText = daysUntilDeadline === 0 
                ? 'Due today!' 
                : `Due in ${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'}`;
              pipelineAlerts.push({
                id: `rfp-${matter.id}`,
                type: 'RFP Deadline Soon',
                matterId: matter.id,
                matterName: matter.matter_name,
                cmNumber,
                clientName,
                message: daysText,
              });
            }
          } else if (!matter.pipeline_outcome || matter.pipeline_outcome === 'Pending') {
            // Submitted but no decision yet - check if we should follow up
            if (isAfter(today, deadline)) {
              const daysSinceDeadline = differenceInDays(today, deadline);
              const weeksSince = Math.floor(daysSinceDeadline / 7);
              if (weeksSince >= 1) {
                pipelineAlerts.push({
                  id: `decision-${matter.id}`,
                  type: 'Awaiting Decision',
                  matterId: matter.id,
                  matterName: matter.matter_name,
                  cmNumber,
                  clientName,
                  message: `${weeksSince} week${weeksSince === 1 ? '' : 's'} since submission`,
                });
              }
            }
          }
        }
      });

      const avgCollectionRate = totalBilledUsd > 0 ? (totalPaidUsd / totalBilledUsd) * 100 : 100;

      // Build historical trend data from all snapshots
      // Create a map of matter_id to exchange_rate for currency conversion
      const matterExchangeRates = new Map<string, number>();
      liveMatters?.forEach(matter => {
        matterExchangeRates.set(matter.id, Number(matter.exchange_rate) || 1);
      });

      // Group all snapshots by date and aggregate (excluding excluded matters)
      const trendByDate = new Map<string, { wip: number; billed: number; paid: number }>();
      snapshots?.forEach(snap => {
        // Skip excluded matters for trend data
        if (excludedSet.has(snap.matter_id)) return;
        
        const dateKey = snap.as_of_date;
        const exchangeRate = matterExchangeRates.get(snap.matter_id) || 1;
        
        const existing = trendByDate.get(dateKey) || { wip: 0, billed: 0, paid: 0 };
        existing.wip += (Number(snap.wip_amount) || 0) * exchangeRate;
        existing.billed += (Number(snap.billed_amount) || 0) * exchangeRate;
        existing.paid += (Number(snap.paid_amount) || 0) * exchangeRate;
        trendByDate.set(dateKey, existing);
      });



      // Better sorting approach - use the original date keys
      const sortedTrendData: TrendDataPoint[] = Array.from(trendByDate.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([dateStr, values]) => ({
          date: format(parseISO(dateStr), 'MMM d'),
          rawDate: dateStr,
          wip: Math.round(values.wip),
          billed: Math.round(values.billed),
          paid: Math.round(values.paid),
        }));

      return {
        totalBudget: totalBmFeesUsd,
        totalWip: totalWipUsd,
        totalBilled: totalBilledUsd,
        totalPaid: totalPaidUsd,
        avgCollectionRate,
        openMattersCount: liveMatters?.length || 0,
      alerts: alerts.sort((a, b) => {
        const priority: Record<string, number> = { 'Over Budget': 1, 'Near Budget': 2, 'Poor Collection': 3, 'High WIP': 4, 'Stale Financials': 5, 'Stale LC Financials': 6 };
        return (priority[a.type] || 99) - (priority[b.type] || 99);
        }),
        pipelineAlerts: pipelineAlerts.sort((a, b) => {
          // RFP deadlines first
          if (a.type === 'RFP Deadline Soon' && b.type !== 'RFP Deadline Soon') return -1;
          if (a.type !== 'RFP Deadline Soon' && b.type === 'RFP Deadline Soon') return 1;
          return 0;
        }),
        trendData: sortedTrendData,
        liveMatters: liveMattersForUI,
      } as DashboardStats;
    },
    enabled: !!user,
  });
}
