import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { differenceInDays, parseISO, isAfter, format } from 'date-fns';
import { convertToUsd } from '@/lib/currencyUtils';
import { useExchangeRates } from './useExchangeRates';
import { getMatterClientDisplayName } from '@/lib/clientUtils';

export interface TrendDataPoint {
  date: string;
  rawDate: string; // Original ISO date for deletion
  wip: number;
  ar: number;
  paid: number;
}

export interface LiveMatter {
  id: string;
  matterName: string;
  clientName: string;
  bmFeeUsd: number;
  usedUsd: number;
}

export interface PipelineMatter {
  id: string;
  matterName: string;
  clientName: string;
  bmFeeUsd: number;
}

export interface ArTranche {
  estimatedDate: string;
  originalAmount: number;
  remainingAmount: number;
  ageDays: number;
}

export interface MatterBreakdown {
  id: string;
  matterName: string;
  clientName: string;
  wipAmount: number;
  arAmount: number;
  paidAmount: number;
  billedAmount: number;
  currency: string;
  arTranches: ArTranche[];
}

export interface MatterWriteOff {
  id: string;
  matterName: string;
  clientName: string;
  writeOffUsd: number;
  asOfDate: string; // ISO date — client attributes to FY using user's financial-year start
}

export interface MonthlyBurn {
  month: string;
  monthLabel: string;
  burnUsd: number;
  matterCount: number;
}

export interface DashboardStats {
  totalBudget: number;
  totalWip: number;
  totalBilled: number;
  totalPaid: number;
  totalWipWriteOff: number;
  avgCollectionRate: number;
  realizationRate: number;
  openMattersCount: number;
  pipelineMattersCount: number;
  totalPipelineValueUsd: number;
  alerts: Alert[];
  pipelineAlerts: PipelineAlert[];
  trendData: TrendDataPoint[];
  liveMatters: LiveMatter[];
  pipelineMatters: PipelineMatter[];
  hasActiveWipProposals: boolean;
  matterBreakdowns: MatterBreakdown[];
  writeOffsByMatter: MatterWriteOff[];
  avgMonthlyBurn3M: number;
  avgMonthlyBurn6M: number;
  avgMonthlyBurn12M: number;
  monthlyBurnData: MonthlyBurn[];
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

export interface AlertThresholds {
  nearBudgetPercent?: number;
  wipWarningAmount?: number;
  poorCollectionPercent?: number;
  staleDays?: number;
}

export function useDashboard(excludedMatterIds: string[] = [], excludedPipelineMatterIds: string[] = [], thresholds?: AlertThresholds) {
  const nearBudgetPct = thresholds?.nearBudgetPercent ?? 80;
  const wipWarning = thresholds?.wipWarningAmount ?? 50000;
  const poorCollectionPct = thresholds?.poorCollectionPercent ?? 60;
  const staleDaysThreshold = thresholds?.staleDays ?? 10;
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard', user?.id, [...excludedMatterIds].sort().join(','), [...excludedPipelineMatterIds].sort().join(','), nearBudgetPct, wipWarning, poorCollectionPct, staleDaysThreshold],
    queryFn: async () => {
      // Local-only edition: no network access, so use fixed default exchange
      // rates (expressed as "1 USD = X units of currency") for conversion.
      const ratesData = {
        rates: {
          'USD': 1,
          'GBP': 0.79,
          'EUR': 0.92,
          'CHF': 0.88,
          'AUD': 1.53,
          'CAD': 1.36,
          'SGD': 1.34,
          'Ringgit': 4.47,
          'SEK': 10.95,
        } as Record<string, number>,
      };
      // Calculate GBP to USD rate: if 1 USD = 0.74 GBP, then 1 GBP = 1/0.74 USD = 1.35 USD
      const gbpToUsdRate = ratesData?.rates?.GBP ? (1 / ratesData.rates.GBP) : 1.35;
      const liveRates = ratesData?.rates as Record<string, number> | undefined;
      
      // Get all Live matters with their clients
      const { data: liveMatters, error: mattersError } = await supabase
        .from('matters')
        .select(`
          *,
          clients (id, name, display_name),
          matter_local_counsels (id, last_updated)
        `)
        .eq('category', 'Live');

      if (mattersError) throw mattersError;

      // Get all Pipeline matters for pipeline alerts
      const { data: pipelineMatters, error: pipelineError } = await supabase
        .from('matters')
        .select(`
          *,
          clients (id, name, display_name)
        `)
        .eq('category', 'Pipeline');

      if (pipelineError) throw pipelineError;

      const matterIds = liveMatters?.map(m => m.id) || [];
      
      // Build live matters list for the UI (always includes all matters)
      // Each matter carries its BM-fee-in-USD so the dashboard can compute
      // filtered totals client-side without re-fetching.
      const liveMattersForUI: LiveMatter[] = (liveMatters || []).map(matter => {
        const bmFee = Number(matter.bm_fee_component) || 0;
        const exchangeRate = Number(matter.exchange_rate) || 1;
        const feeCurrency = matter.fee_currency || 'GBP';
        const differentBillingCurrency = matter.different_billing_currency || false;
        const agreedBillingAmount = Number(matter.agreed_billing_amount) || 0;
        const originalFeeUpperEnd = Number(matter.fee_amount_upper_end) || 0;
        let effectiveBmFee = bmFee;
        if (differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0) {
          const bmProportion = bmFee / originalFeeUpperEnd;
          effectiveBmFee = agreedBillingAmount * bmProportion;
        }
        return {
          id: matter.id,
          matterName: matter.matter_name,
          clientName: getMatterClientDisplayName(matter),
          bmFeeUsd: convertToUsd(effectiveBmFee, feeCurrency, exchangeRate, gbpToUsdRate, liveRates),
          usedUsd: 0,
        };
      });

      // Build pipeline matters list for the UI (always includes all matters)
      const pipelineMattersForUI: PipelineMatter[] = (pipelineMatters || []).map(matter => {
        const bmFee = Number(matter.bm_fee_component) || 0;
        const exchangeRate = Number(matter.exchange_rate) || 1;
        const feeCurrency = matter.fee_currency || 'GBP';
        return {
          id: matter.id,
          matterName: matter.matter_name,
          clientName: getMatterClientDisplayName(matter),
          bmFeeUsd: convertToUsd(bmFee, feeCurrency, exchangeRate, gbpToUsdRate, liveRates),
        };
      });

      if (matterIds.length === 0 && (!pipelineMatters || pipelineMatters.length === 0)) {
        return {
          totalBudget: 0,
          totalWip: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalWipWriteOff: 0,
          avgCollectionRate: 0,
          realizationRate: 0,
          openMattersCount: 0,
          pipelineMattersCount: 0,
          totalPipelineValueUsd: 0,
          alerts: [],
          pipelineAlerts: [],
          trendData: [],
          liveMatters: liveMattersForUI,
          pipelineMatters: pipelineMattersForUI,
          hasActiveWipProposals: false,
          matterBreakdowns: [],
          writeOffsByMatter: [],
          avgMonthlyBurn3M: 0,
          avgMonthlyBurn6M: 0,
          avgMonthlyBurn12M: 0,
          monthlyBurnData: [],
        } as DashboardStats;
      }

      // Create set of excluded matter IDs for quick lookup
      const excludedSet = new Set(excludedMatterIds);
      const excludedPipelineSet = new Set(excludedPipelineMatterIds);

      // Fetch ALL snapshots for live matters. The trend chart and burn computation
      // need full history (~14 months). Supabase/PostgREST caps rows per request
      // (default 1000, configurable per project). We paginate to guarantee completeness.
      let snapshots: any[] = [];
      if (matterIds.length > 0) {
        const PAGE_SIZE = 1000;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: page } = await supabase
            .from('financial_snapshots')
            .select('*')
            .in('matter_id', matterIds)
            .order('as_of_date', { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);
          if (page && page.length > 0) {
            snapshots = snapshots.concat(page);
            offset += page.length;
            hasMore = page.length === PAGE_SIZE;
          } else {
            hasMore = false;
          }
        }
      }

      // Get dated write-off events for each matter. Each event represents the
      // delta added to that matter's write-offs on a specific date, so the
      // dashboard can bucket them by financial year without guessing.
      let { data: writeOffEventRows } = matterIds.length > 0 ? await supabase
        .from('write_off_events' as never)
        .select('*')
        .in('matter_id', matterIds)
        .order('write_off_date', { ascending: false }) : { data: [] };

      // One-time backfill: if write_off_events is empty but snapshots have
      // write-offs, seed the table from the latest snapshot per matter.
      // This covers DBs where the trigger migration was applied after
      // snapshots already existed.
      if ((!writeOffEventRows || writeOffEventRows.length === 0) && snapshots && snapshots.length > 0) {
        const latestByMatter = new Map<string, typeof snapshots[0]>();
        snapshots.forEach(snap => {
          if (!latestByMatter.has(snap.matter_id)) latestByMatter.set(snap.matter_id, snap);
        });
        const toInsert: Array<Record<string, unknown>> = [];
        latestByMatter.forEach((snap) => {
          const wo = Number(snap.wip_write_off_amount) || 0;
          if (wo <= 0) return;
          const matter = (liveMatters || []).find(m => m.id === snap.matter_id);
          toInsert.push({
            matter_id: snap.matter_id,
            user_id: snap.user_id,
            write_off_amount: wo,
            fee_currency: matter?.fee_currency || 'GBP',
            exchange_rate: Number(matter?.exchange_rate) || 1,
            write_off_date: snap.as_of_date,
            source_snapshot_id: snap.id,
            description: 'Backfill: seeded from latest snapshot',
          });
        });
        if (toInsert.length > 0) {
          await supabase.from('write_off_events' as never).insert(toInsert as never);
          const { data: refetched } = await supabase
            .from('write_off_events' as never)
            .select('*')
            .in('matter_id', matterIds)
            .order('write_off_date', { ascending: false });
          writeOffEventRows = refetched;
        }
      }

      // Get selected WIP shaping proposals for matters that have show_shaping_proposal enabled
      const { data: wipProposals } = matterIds.length > 0 ? await supabase
        .from('wip_shaping_proposals')
        .select('*')
        .in('matter_id', matterIds)
        .eq('is_selected', true) : { data: [] };

      // Create a map of matter_id to selected proposal
      const proposalMap = new Map<string, any>();
      wipProposals?.forEach(proposal => {
        proposalMap.set(proposal.matter_id, proposal);
      });

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
      let totalWipWriteOffUsd = 0;
      let totalPipelineValueUsd = 0;
      let includedLiveCount = 0;
      let hasActiveWipProposals = false; // Track if any proposals are affecting WIP
      const alerts: Alert[] = [];
      const pipelineAlerts: PipelineAlert[] = [];
      const matterBreakdowns: MatterBreakdown[] = [];
      const writeOffsByMatter: MatterWriteOff[] = [];

      // Calculate total pipeline value (respecting excluded pipeline matters)
      let includedPipelineCount = 0;
      pipelineMatters?.forEach(matter => {
        // Skip excluded pipeline matters
        if (excludedPipelineSet.has(matter.id)) return;
        
        const bmFee = Number(matter.bm_fee_component) || 0;
        const exchangeRate = Number(matter.exchange_rate) || 1;
        const feeCurrency = matter.fee_currency || 'GBP';
        totalPipelineValueUsd += convertToUsd(bmFee, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
        includedPipelineCount++;
      });
      const today = new Date();

      liveMatters?.forEach(matter => {
        const snapshot = snapshotMap.get(matter.id);
        const proposal = proposalMap.get(matter.id);
        const isExcluded = excludedSet.has(matter.id);
        
        // Check if this matter has an active WIP shaping proposal
        const showProposalData = matter.show_shaping_proposal && proposal;
        if (showProposalData && !isExcluded) {
          hasActiveWipProposals = true;
        }
        
        // Use bm_fee_component as the BM fee and convert to USD using proper conversion
        const bmFee = Number(matter.bm_fee_component) || 0;
        const exchangeRate = Number(matter.exchange_rate) || 1;
        const feeCurrency = matter.fee_currency || 'GBP';
        const budget = Number(matter.fee_amount_upper_end) || 0;
        
        // Use proposal data if enabled for WIP display, otherwise use snapshot
        // IMPORTANT: For proposals, wip_amount is RAW and we subtract write-off to get NET
        // For snapshots (imported data), wip_amount IS already NET - don't subtract again
        const snapshotWipAmount = Number(snapshot?.wip_amount) || 0;
        const proposalRawWip = showProposalData ? Number(proposal.wip_amount) : 0;
        const proposalWipWriteOff = showProposalData ? Number(proposal.wip_write_off_amount) : 0;
        // For proposals: subtract write-off from raw. For snapshots: use as-is (already net)
        const wipAmount = showProposalData 
          ? proposalRawWip - proposalWipWriteOff 
          : snapshotWipAmount;
        
        // IMPORTANT: For realization rate calculation, ONLY use actual write-offs from snapshots
        // Proposal write-offs are provisional and should not affect collection/realization rates
        const actualWipWriteOffAmount = Number(snapshot?.wip_write_off_amount) || 0;
        
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

        // Per-matter USD burn (WIP + AR + Paid). Computed for ALL live matters
        // (not just included) so the dashboard tile can show "Used / Remaining"
        // for whichever subset the user toggles on.
        const accountsReceivablePre = Number(snapshot?.accounts_receivable) || 0;
        const usedNative = wipAmount + accountsReceivablePre + paidAmount;
        const usedUsdPerMatter = convertToUsd(usedNative, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
        const liveMatterEntry = liveMattersForUI.find(lm => lm.id === matter.id);
        if (liveMatterEntry) liveMatterEntry.usedUsd = usedUsdPerMatter;

        // Only include in financial totals if not excluded
        if (!isExcluded) {
          // Convert to USD using live rates for accuracy
          const wipUsd = convertToUsd(wipAmount, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
          const billedUsd = convertToUsd(billedAmount, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
          const paidUsd = convertToUsd(paidAmount, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
          
          totalBmFeesUsd += convertToUsd(effectiveBmFee, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
          totalWipUsd += wipUsd;
          totalBilledUsd += billedUsd;
          totalPaidUsd += paidUsd;
          // Only use ACTUAL write-offs for realization rate - never proposal write-offs
          totalWipWriteOffUsd += convertToUsd(actualWipWriteOffAmount, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
          includedLiveCount++;

          matterBreakdowns.push({
            id: matter.id,
            matterName: matter.matter_name,
            clientName: getMatterClientDisplayName(matter),
            wipAmount: wipAmount,
            arAmount: billedAmount - paidAmount,
            paidAmount: paidAmount,
            billedAmount: billedAmount,
            currency: feeCurrency,
            arTranches: [],
          });

          // Write-off entries for the FY breakdown are now built from the dated
          // write_off_events table below, outside this loop.
        }

        // Budget burn = WIP + AR + Paid (each value is mutually exclusive)
        const accountsReceivable = Number(snapshot?.accounts_receivable) || 0;
        const totalUsed = wipAmount + accountsReceivable + paidAmount;
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
        else if (budget > 0 && budgetUsedPercent >= nearBudgetPct && budgetUsedPercent <= 100) {
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
        if (wipAmount > wipWarning && billedAmount < wipAmount * 0.5) {
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
        if (billedAmount > 0 && collectionRate < poorCollectionPct) {
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
          if (daysSinceUpdate >= staleDaysThreshold) {
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
              return daysSinceUpdate >= staleDaysThreshold;
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
                message: `${staleLCs.length} LC firm${staleLCs.length > 1 ? 's' : ''} not updated in ${staleDaysThreshold}+ days`,
              });
            }
          }
        }
    });

      // Build the dated write-off entries for the FY breakdown from the
      // write_off_events table. Each event already has its own write_off_date
      // and currency snapshotted at the time of the event.
      const matterLookup = new Map<string, any>();
      (liveMatters ?? []).forEach((m: any) => matterLookup.set(m.id, m));
      (writeOffEventRows as any[] | null | undefined)?.forEach((evt: any) => {
        if (!evt || excludedSet.has(evt.matter_id)) return;
        const matter = matterLookup.get(evt.matter_id);
        if (!matter) return;
        const amount = Number(evt.write_off_amount) || 0;
        if (amount <= 0) return;
        const eventCurrency = evt.fee_currency || matter.fee_currency || 'GBP';
        const eventRate = Number(evt.exchange_rate) || Number(matter.exchange_rate) || 1;
        const usd = convertToUsd(amount, eventCurrency, eventRate, gbpToUsdRate, liveRates);
        writeOffsByMatter.push({
          id: matter.id,
          matterName: matter.matter_name,
          clientName: getMatterClientDisplayName(matter),
          writeOffUsd: usd,
          asOfDate: evt.write_off_date,
        });
      });

      // If write_off_events table is missing/empty (migration not applied),
      // derive dated entries by walking each matter's snapshot history to find
      // when write-offs actually increased. Positive deltas are recorded for
      // FY attribution, then scaled so the per-matter total matches the latest
      // snapshot's cumulative value — this prevents over-counting when
      // write-offs are corrected downward between snapshots.
      if (writeOffsByMatter.length === 0 && snapshots && snapshots.length > 0) {
        const snapshotsByMatter = new Map<string, typeof snapshots>();
        snapshots.forEach(snap => {
          const list = snapshotsByMatter.get(snap.matter_id) || [];
          list.push(snap);
          snapshotsByMatter.set(snap.matter_id, list);
        });

        snapshotsByMatter.forEach((matterSnaps, matterId) => {
          if (excludedSet.has(matterId)) return;
          const matter = matterLookup.get(matterId);
          if (!matter) return;

          matterSnaps.sort((a, b) => a.as_of_date.localeCompare(b.as_of_date));

          const latestSnap = matterSnaps[matterSnaps.length - 1];
          const latestWo = Number(latestSnap.wip_write_off_amount) || 0;
          if (latestWo <= 0) return;

          const feeCurrency = matter.fee_currency || 'GBP';
          const exchangeRate = Number(matter.exchange_rate) || 1;

          // Collect positive deltas to preserve FY attribution dates
          let prevWo = 0;
          const deltas: { date: string; amount: number }[] = [];
          matterSnaps.forEach(snap => {
            const currentWo = Number(snap.wip_write_off_amount) || 0;
            const delta = currentWo - prevWo;
            if (delta > 0) {
              deltas.push({ date: snap.as_of_date, amount: delta });
            }
            prevWo = currentWo;
          });

          // Scale proportionally so the total equals the latest cumulative,
          // correcting for any interim reductions/reversals
          const deltaSum = deltas.reduce((s, d) => s + d.amount, 0);
          const scaleFactor = deltaSum > 0 ? latestWo / deltaSum : 0;

          deltas.forEach(d => {
            writeOffsByMatter.push({
              id: matterId,
              matterName: matter.matter_name,
              clientName: getMatterClientDisplayName(matter),
              writeOffUsd: convertToUsd(d.amount * scaleFactor, feeCurrency, exchangeRate, gbpToUsdRate, liveRates),
              asOfDate: d.date,
            });
          });
        });
      }

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
      
      // Realization rate = Paid / (Billed + Write-offs)
      // This shows what percentage of resolved WIP (billed + written off) was collected
      // It can never exceed collection rate - at best they're equal (if no write-offs)
      const totalResolvedWip = totalBilledUsd + totalWipWriteOffUsd;
      const realizationRate = totalResolvedWip > 0 ? (totalPaidUsd / totalResolvedWip) * 100 : 100;

      // Build historical trend data from snapshot history. Important: the
      // dashboard trend is a portfolio view, not a sparse event log. When one
      // included matter has no row on a date that another matter does, we carry
      // forward that matter's latest known snapshot instead of dropping it from
      // the aggregate for that date. This avoids the exact "looks like deleted
      // Sweden data came back when other matters are added" behaviour caused by
      // summing only exact-date rows.
      const matterDataMap = new Map<string, { exchangeRate: number; feeCurrency: string }>();
      liveMatters?.forEach(matter => {
        matterDataMap.set(matter.id, {
          exchangeRate: Number(matter.exchange_rate) || 1,
          feeCurrency: matter.fee_currency || 'GBP',
        });
      });

      const includedLiveMatters = (liveMatters || []).filter(matter => !excludedSet.has(matter.id));
      const includedMatterIdsForTrend = new Set(includedLiveMatters.map(matter => matter.id));

      const snapshotsByMatter = new Map<string, any[]>();
      (snapshots || []).forEach(snap => {
        if (!includedMatterIdsForTrend.has(snap.matter_id)) return;
        const list = snapshotsByMatter.get(snap.matter_id) || [];
        list.push(snap);
        snapshotsByMatter.set(snap.matter_id, list);
      });
      snapshotsByMatter.forEach(list => list.sort((a, b) => a.as_of_date.localeCompare(b.as_of_date)));

      // AR aging: derive outstanding billing tranches per matter using FIFO.
      // Billing increases → new tranche. Billing decreases (recalled/corrected
      // bills) → remove from newest tranche LIFO. Payments → consume oldest
      // tranche FIFO. Final reconciliation against actual AR ensures tranches
      // always sum to the real outstanding balance.
      matterBreakdowns.forEach(breakdown => {
        if (breakdown.arAmount <= 0) return;
        const matterSnaps = snapshotsByMatter.get(breakdown.id);
        if (!matterSnaps || matterSnaps.length === 0) return;

        const tranches: { date: string; original: number; remaining: number }[] = [];
        let prevBilled = 0;
        let prevPaid = 0;

        for (const snap of matterSnaps) {
          const billed = Number(snap.billed_amount) || 0;
          const paid = Number(snap.paid_amount) || 0;
          const billingDelta = billed - prevBilled;
          if (billingDelta > 0) {
            tranches.push({ date: snap.as_of_date, original: billingDelta, remaining: billingDelta });
          } else if (billingDelta < 0) {
            // Bill recall/correction — remove from newest tranches (LIFO)
            let toRemove = Math.abs(billingDelta);
            for (let i = tranches.length - 1; i >= 0 && toRemove > 0; i--) {
              const consume = Math.min(tranches[i].remaining, toRemove);
              tranches[i].remaining -= consume;
              tranches[i].original -= consume;
              toRemove -= consume;
            }
          }
          let paymentDelta = paid - prevPaid;
          for (const t of tranches) {
            if (paymentDelta <= 0) break;
            const consume = Math.min(t.remaining, paymentDelta);
            t.remaining -= consume;
            paymentDelta -= consume;
          }
          prevBilled = billed;
          prevPaid = paid;
        }

        let activeTranches = tranches.filter(t => t.remaining > 0.01);

        // Reconcile: tranche total should equal the actual AR from the latest
        // snapshot. If it doesn't (rounding, edge cases, pre-history billing),
        // adjust so the displayed tranches are honest about what's real.
        const trancheSum = activeTranches.reduce((s, t) => s + t.remaining, 0);
        const actualAr = breakdown.arAmount;
        if (trancheSum > actualAr + 0.01) {
          // Tranches overstate AR — trim from newest (most likely corrected)
          let excess = trancheSum - actualAr;
          for (let i = activeTranches.length - 1; i >= 0 && excess > 0.01; i--) {
            const trim = Math.min(activeTranches[i].remaining, excess);
            activeTranches[i].remaining -= trim;
            excess -= trim;
          }
          activeTranches = activeTranches.filter(t => t.remaining > 0.01);
        }

        breakdown.arTranches = activeTranches.map(t => ({
          estimatedDate: t.date,
          originalAmount: t.original,
          remainingAmount: t.remaining,
          ageDays: differenceInDays(today, parseISO(t.date)),
        }));
      });

      const sortedTrendDates = Array.from(new Set(
        (snapshots || [])
          .filter(snap => includedMatterIdsForTrend.has(snap.matter_id))
          .map(snap => snap.as_of_date)
      )).sort((dateA, dateB) => dateA.localeCompare(dateB));

      const trendByDate = new Map<string, { wip: number; ar: number; paid: number; matterCount: number }>();
      const cursorByMatter = new Map<string, number>();
      const lastSnapshotByMatter = new Map<string, any | null>();

      sortedTrendDates.forEach(dateKey => {
        const values = { wip: 0, ar: 0, paid: 0, matterCount: 0 };

        includedLiveMatters.forEach(matter => {
          const matterSnaps = snapshotsByMatter.get(matter.id) || [];
          let cursor = cursorByMatter.get(matter.id) ?? 0;
          let lastSnap = lastSnapshotByMatter.get(matter.id) ?? null;

          while (cursor < matterSnaps.length && matterSnaps[cursor].as_of_date <= dateKey) {
            lastSnap = matterSnaps[cursor];
            cursor += 1;
          }

          cursorByMatter.set(matter.id, cursor);
          lastSnapshotByMatter.set(matter.id, lastSnap);

          if (!lastSnap) return;

          const matterData = matterDataMap.get(matter.id);
          const exchangeRate = matterData?.exchangeRate || 1;
          const feeCurrency = matterData?.feeCurrency || 'GBP';
          const billedUsd = convertToUsd(Number(lastSnap.billed_amount) || 0, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
          const paidUsd = convertToUsd(Number(lastSnap.paid_amount) || 0, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);

          values.wip += convertToUsd(Number(lastSnap.wip_amount) || 0, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
          values.ar += Math.max(billedUsd - paidUsd, 0);
          values.paid += paidUsd;
          values.matterCount += 1;
        });

        trendByDate.set(dateKey, values);
      });

      const sortedEntries = Array.from(trendByDate.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB));

      const sortedTrendData: TrendDataPoint[] = sortedEntries
        .map(([dateStr, values]) => ({
          date: format(parseISO(dateStr), 'MMM d'),
          rawDate: dateStr,
          wip: Math.round(values.wip),
          ar: Math.round(values.ar),
          paid: Math.round(values.paid),
        }));

      // --- Rolling burn / busyness computation ---
      // Reuses snapshotsByMatter (ASC-sorted per-matter lists built above for trend data)

      // 13 month-end anchors: [0] = end of current month, [12] = end of 12-months-ago
      const monthAnchors: string[] = [];
      for (let i = 0; i <= 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
        monthAnchors.push(format(d, 'yyyy-MM-dd'));
      }

      // For a matter's ASC-sorted snapshots, find the latest snapshot ≤ anchorKey
      const findLatestBefore = (matterSnaps: any[], anchorKey: string) => {
        let result: any = null;
        for (let i = matterSnaps.length - 1; i >= 0; i--) {
          if (matterSnaps[i].as_of_date <= anchorKey) {
            result = matterSnaps[i];
            break;
          }
        }
        return result;
      };

      // monthlyBurnUsd[0] = burn in most recent completed month, [11] = oldest
      const monthlyBurnUsd: number[] = new Array(12).fill(0);
      const monthlyMatterCounts: number[] = new Array(12).fill(0);

      includedLiveMatters.forEach(matter => {
        const matterSnaps = snapshotsByMatter.get(matter.id);
        if (!matterSnaps || matterSnaps.length === 0) return;
        const mData = matterDataMap.get(matter.id);
        const exchangeRate = mData?.exchangeRate || 1;
        const feeCurrency = mData?.feeCurrency || 'GBP';

        for (let m = 0; m < 12; m++) {
          const endAnchor = monthAnchors[m];
          const startAnchor = monthAnchors[m + 1];
          const endSnap = findLatestBefore(matterSnaps, endAnchor);
          if (!endSnap) continue;
          const startSnap = findLatestBefore(matterSnaps, startAnchor);
          if (startSnap && endSnap === startSnap) continue;
          const startWip = startSnap ? (Number(startSnap.wip_amount) || 0) : 0;
          const startBilled = startSnap ? (Number(startSnap.billed_amount) || 0) : 0;
          const startWriteOff = startSnap ? (Number(startSnap.wip_write_off_amount) || 0) : 0;
          const deltaWip = (Number(endSnap.wip_amount) || 0) - startWip;
          const deltaBilled = (Number(endSnap.billed_amount) || 0) - startBilled;
          const deltaWriteOff = (Number(endSnap.wip_write_off_amount) || 0) - startWriteOff;
          const burnNative = deltaWip + deltaBilled + deltaWriteOff;
          monthlyBurnUsd[m] += convertToUsd(burnNative, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
          monthlyMatterCounts[m] += 1;
        }
      });

      // Build monthly burn data array (oldest first for chart display)
      const monthlyBurnData: MonthlyBurn[] = [];
      for (let m = 11; m >= 0; m--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
        monthlyBurnData.push({
          month: format(monthDate, 'yyyy-MM'),
          monthLabel: format(monthDate, 'MMM yyyy'),
          burnUsd: Math.round(monthlyBurnUsd[m]),
          matterCount: monthlyMatterCounts[m],
        });
      }

      // Averages: sum of recent N months / N
      const sum3M = monthlyBurnUsd.slice(0, 3).reduce((s, v) => s + v, 0);
      const sum6M = monthlyBurnUsd.slice(0, 6).reduce((s, v) => s + v, 0);
      const sum12M = monthlyBurnUsd.reduce((s, v) => s + v, 0);
      const avgMonthlyBurn3M = sum3M / 3;
      const avgMonthlyBurn6M = sum6M / 6;
      const avgMonthlyBurn12M = sum12M / 12;

      return {
        totalBudget: totalBmFeesUsd,
        totalWip: totalWipUsd,
        totalBilled: totalBilledUsd,
        totalPaid: totalPaidUsd,
        totalWipWriteOff: totalWipWriteOffUsd,
        avgCollectionRate,
        realizationRate,
        openMattersCount: includedLiveCount,
        pipelineMattersCount: includedPipelineCount,
        totalPipelineValueUsd,
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
        pipelineMatters: pipelineMattersForUI,
        hasActiveWipProposals,
        matterBreakdowns: matterBreakdowns.sort((a, b) => b.wipAmount - a.wipAmount),
        writeOffsByMatter: writeOffsByMatter.sort((a, b) => b.writeOffUsd - a.writeOffUsd),
        avgMonthlyBurn3M,
        avgMonthlyBurn6M,
        avgMonthlyBurn12M,
        monthlyBurnData,
      } as DashboardStats;
    },
    enabled: !!user,
    // Charts must reflect snapshot mutations (deletes, edits) the instant the
    // user activates a filter combination. With a non-zero staleTime React
    // Query can serve a previously-cached result for the same key, so deleted
    // data momentarily reappears. staleTime: 0 forces a fresh fetch on every
    // activation while still caching within a single render pass.
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
