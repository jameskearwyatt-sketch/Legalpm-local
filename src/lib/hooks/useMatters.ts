import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { WipShapingProposal } from './useWipShapingProposals';

export type MatterCategory = 'Live' | 'Pipeline' | 'Closed' | 'Lost';
export type MatterStage = 'Pre-Start' | 'Term Sheet' | 'Documentation - Start' | 'Documentation - Close' | 'Closing Process' | 'Paused' | 'Closed' | 'Won' | 'Pending' | 'Lost';
export type FeeType = 'Discounted Rates with Cap' | 'Discounted Rates with Estimate' | 'Discounted Rates with Partial Cap' | 'Rack Rates with Cap' | 'Rack Rates with Estimate';
export type MatterSource = 'RfP' | 'Direct from Client' | 'Internal Referral';
export type PipelineOutcome = 'Won' | 'Lost' | 'Pending';

export interface Matter {
  id: string;
  user_id: string;
  client_id: string;
  matter_name: string;
  matter_number: string;
  practice_area: string | null;
  status: 'Open' | 'On Hold' | 'Closed';
  aml_kyc_complete: boolean;
  assignment_letter_signed: boolean;
  matter_open: boolean;
  lead_partner: string | null;
  matter_managing_attorney: string | null;
  start_date: string | null;
  target_close_date: string | null;
  currency: string;
  budget_type: 'Fixed' | 'Cap' | 'Estimate' | 'Retainer' | 'Hourly';
  agreed_budget_amount: number;
  budget_notes: string | null;
  fee_earner_mix_notes: string | null;
  billing_terms: string | null;
  category: MatterCategory;
  current_stage: MatterStage | null;
  fee_amount_upper_end: number;
  local_counsel_fee: number;
  local_counsel_billing: 'Direct' | 'Disb' | null;
  bm_fee_component: number;
  exchange_rate: number;
  fee_currency: string;
  fee_type: FeeType | null;
  source: MatterSource | null;
  originator: string | null;
  deal_currency: string | null;
  deal_value: number | null;
  cm_number: string | null;
  conflicts_check: boolean;
  opportunity_receipt_date: string | null;
  clarifications_date: string | null;
  submission_deadline: string | null;
  submitted: boolean;
  decision_date: string | null;
  pipeline_outcome: PipelineOutcome | null;
  different_billing_currency: boolean;
  agreed_billing_amount: number;
  quote_currency: string | null;
  billing_currency: string | null;
  is_multi_client: boolean;
  pay_full_time_costs: boolean;
  progress: number;
  jurisdictions: string[];
  matter_display_name: string | null;
  on_hold_months: number;
  show_shaping_proposal: boolean;
  lc_wip: number;
  lc_billed: number;
  lc_last_updated: string | null;
  manual_budget_amount: number;
  use_manual_budget: boolean;
  rate_modifier: string | null;
  rate_modifier_value: number | null;
  rate_modifier_scope: string | null;
  pricing_model: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
    display_name?: string | null;
  };
}

export interface LocalCounselBrief {
  id: string;
  firm_name: string;
  billing_mode: 'Direct' | 'Disb' | null;
  allocated_budget: number;
  wip_amount: number;
  billed_amount: number;
}

export interface SnapshotHistoryPoint {
  as_of_date: string;
  wip_amount: number;
  wip_write_off_amount: number;
  accounts_receivable: number;
  paid_amount: number;
}

export interface MatterWithFinancials extends Matter {
  latest_snapshot?: {
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
    as_of_date: string;
    update_source?: string | null;
  };
  // Actual snapshot data - NEVER contains WIP shaping proposal data
  // Use this for comparisons (e.g., Master WIP import) to ensure accurate system figures
  actual_snapshot?: {
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
    as_of_date: string;
    update_source?: string | null;
  };
  // All historical snapshots for sparkline charts
  snapshot_history?: SnapshotHistoryPoint[];
  remaining_budget: number;
  budget_used_percent: number;
  collection_rate: number;
  headroom: number;
  headroom_percent: number;
  bm_headroom: number;
  bm_headroom_percent: number;
  lc_headroom_percent: number;
  total_paid_ar_wip: number;
  local_counsels?: LocalCounselBrief[];
  effective_fee_upper_end: number;
  effective_bm_fee: number;
  effective_local_counsel_fee: number;
  effective_currency: string;
  mandated_rate: number;
  selected_proposal: WipShapingProposal | null;
}

export interface CreateMatterInput {
  client_id: string;
  matter_name: string;
  matter_number: string;
  practice_area?: string;
  status?: 'Open' | 'On Hold' | 'Closed';
  aml_kyc_complete?: boolean;
  assignment_letter_signed?: boolean;
  matter_open?: boolean;
  lead_partner?: string;
  matter_managing_attorney?: string;
  start_date?: string;
  target_close_date?: string;
  currency?: string;
  budget_type?: 'Fixed' | 'Cap' | 'Estimate' | 'Retainer' | 'Hourly';
  agreed_budget_amount?: number;
  budget_notes?: string;
  fee_earner_mix_notes?: string;
  billing_terms?: string;
  // New fields
  category?: MatterCategory;
  current_stage?: MatterStage | null;
  fee_amount_upper_end?: number;
  local_counsel_fee?: number;
  local_counsel_billing?: 'Direct' | 'Disb' | null;
  bm_fee_component?: number;
  exchange_rate?: number;
  fee_currency?: string;
  fee_type?: FeeType | null;
  source?: MatterSource | null;
  originator?: string;
  deal_currency?: string;
  deal_value?: number;
  cm_number?: string;
  conflicts_check?: boolean;
  opportunity_receipt_date?: string;
  clarifications_date?: string;
  submission_deadline?: string;
  submitted?: boolean;
  decision_date?: string;
  pipeline_outcome?: PipelineOutcome | null;
  jurisdictions?: string[];
  // Manual budget override
  use_manual_budget?: boolean;
  manual_budget_amount?: number;
  // Multi-client flag
  is_multi_client?: boolean;
}

export function useMatters() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mattersQuery = useQuery({
    queryKey: ['matters', user?.id],
    queryFn: async () => {
      const { data: matters, error: mattersError } = await supabase
        .from('matters')
        .select(`
          *,
          clients (id, name, display_name)
        `)
        .order('updated_at', { ascending: false });

      if (mattersError) throw mattersError;

      // Get latest snapshots for all matters
      const matterIds = matters?.map(m => m.id) || [];
      
      if (matterIds.length === 0) return [];

      // Get snapshots limited to last 6 months for sparkline history performance
      // This prevents loading unbounded snapshot history for long-running matters
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const cutoffDate = sixMonthsAgo.toISOString().split('T')[0];

      const { data: snapshots } = await supabase
        .from('financial_snapshots')
        .select('*')
        .in('matter_id', matterIds)
        .gte('as_of_date', cutoffDate)
        .order('as_of_date', { ascending: false });

      // Also fetch the single latest snapshot per matter in case it's older than 6 months
      // (matters that haven't been updated recently)
      const coveredMatterIds = new Set(snapshots?.map(s => s.matter_id) || []);
      const uncoveredMatterIds = matterIds.filter(id => !coveredMatterIds.has(id));
      let latestOnlySnapshots: typeof snapshots = [];
      if (uncoveredMatterIds.length > 0) {
        const { data: oldSnapshots } = await supabase
          .from('financial_snapshots')
          .select('*')
          .in('matter_id', uncoveredMatterIds)
          .order('as_of_date', { ascending: false });
        // Deduplicate to only the latest per matter
        const seen = new Set<string>();
        latestOnlySnapshots = (oldSnapshots || []).filter(s => {
          if (seen.has(s.matter_id)) return false;
          seen.add(s.matter_id);
          return true;
        });
      }

      const allSnapshots = [...(snapshots || []), ...latestOnlySnapshots];
      
      // Get all local counsel data for aggregation
      const { data: localCounsels } = await supabase
        .from('matter_local_counsels')
        .select('*')
        .in('matter_id', matterIds);
      
      // Get selected WIP shaping proposals for matters with show_shaping_proposal enabled
      const { data: selectedProposals } = await supabase
        .from('wip_shaping_proposals')
        .select('*')
        .in('matter_id', matterIds)
        .eq('is_selected', true);

      // Create a map of matter_id to latest snapshot
      const snapshotMap = new Map<string, any>();
      // Also create a map of matter_id to ALL snapshots for sparkline history
      const snapshotHistoryMap = new Map<string, SnapshotHistoryPoint[]>();
      allSnapshots?.forEach(snap => {
        if (!snapshotMap.has(snap.matter_id)) {
          snapshotMap.set(snap.matter_id, snap);
        }
        // Add to history map
        const history = snapshotHistoryMap.get(snap.matter_id) || [];
        history.push({
          as_of_date: snap.as_of_date,
          wip_amount: snap.wip_amount || 0,
          wip_write_off_amount: snap.wip_write_off_amount || 0,
          accounts_receivable: snap.accounts_receivable || 0,
          paid_amount: snap.paid_amount || 0,
        });
        snapshotHistoryMap.set(snap.matter_id, history);
      });
      
      // Create a map of matter_id to aggregated LC financials and full LC list
      const lcAggregateMap = new Map<string, { totalWip: number; totalBilled: number; totalAllocated: number }>();
      const lcListMap = new Map<string, LocalCounselBrief[]>();
      localCounsels?.forEach(lc => {
        const existing = lcAggregateMap.get(lc.matter_id) || { totalWip: 0, totalBilled: 0, totalAllocated: 0 };
        lcAggregateMap.set(lc.matter_id, {
          totalWip: existing.totalWip + (lc.wip_amount || 0),
          totalBilled: existing.totalBilled + (lc.billed_amount || 0),
          totalAllocated: existing.totalAllocated + (lc.allocated_budget || 0),
        });
        // Also store the full LC list per matter
        const existingList = lcListMap.get(lc.matter_id) || [];
        existingList.push({
          id: lc.id,
          firm_name: lc.firm_name,
          billing_mode: lc.billing_mode as 'Direct' | 'Disb' | null,
          allocated_budget: lc.allocated_budget || 0,
          wip_amount: lc.wip_amount || 0,
          billed_amount: lc.billed_amount || 0,
        });
        lcListMap.set(lc.matter_id, existingList);
      });
      
      // Create a map of matter_id to selected WIP shaping proposal
      const selectedProposalMap = new Map<string, any>();
      selectedProposals?.forEach(proposal => {
        selectedProposalMap.set(proposal.matter_id, proposal);
      });

      // Combine matters with their financial data
      return matters?.map(matter => {
        const snapshot = snapshotMap.get(matter.id);
        const selectedProposal = selectedProposalMap.get(matter.id);
        const showProposalData = matter.show_shaping_proposal && selectedProposal;
        
        // Use proposal data if enabled, otherwise use snapshot
        // IMPORTANT: For proposals, wip_amount is RAW and we subtract write-off to get NET
        // For snapshots (imported data), wip_amount IS already NET - write-off is tracked separately for realization only
        const wipWriteOffAmount = showProposalData ? selectedProposal.wip_write_off_amount : (snapshot?.wip_write_off_amount || 0);
        
        // For proposals: wip_amount is RAW, need to subtract write-off
        // For snapshots: wip_amount IS NET (report already reduced it), don't subtract again
        const wipAmount = showProposalData 
          ? selectedProposal.wip_amount - selectedProposal.wip_write_off_amount
          : (snapshot?.wip_amount || 0);
        const billedAmount = showProposalData ? selectedProposal.billed_amount : (snapshot?.billed_amount || 0);
        // For proposals, accounts_receivable is already the adjusted value (raw AR - AR write-off)
        const accountsReceivable = showProposalData ? selectedProposal.accounts_receivable : (snapshot?.accounts_receivable || 0);
        const paidAmount = showProposalData ? selectedProposal.paid_amount : (snapshot?.paid_amount || 0);
        const budget = matter.agreed_budget_amount || 0;
        const feeUpperEnd = matter.fee_amount_upper_end || 0;
        
        // Local counsel financials - prefer aggregated from matter_local_counsels table
        const matterAny = matter as any;
        const lcAggregate = lcAggregateMap.get(matter.id);
        const localCounsels = lcListMap.get(matter.id) || [];
        const localCounselBilling = matterAny.local_counsel_billing;
        
        // Use aggregated LC data from the new table if available, otherwise fall back to old fields
        const lcWip = lcAggregate?.totalWip ?? (matterAny.lc_wip || 0);
        const lcBilled = lcAggregate?.totalBilled ?? (matterAny.lc_billed || 0);
        
        // Check for different billing currency scenario
        const differentBillingCurrency = matterAny.different_billing_currency ?? false;
        const quoteCurrency = matterAny.quote_currency || matter.fee_currency;
        const billingCurrency = matterAny.billing_currency || matter.fee_currency;
        const agreedBillingAmount = matterAny.agreed_billing_amount || 0;
        
        // Note: mandatedRate was previously used to convert from quote to billing currency
        // during budget creation. All stored values are now in billing currency, so we
        // only keep mandatedRate for legacy compatibility but don't use it for display.
        const mandatedRate = (differentBillingCurrency && feeUpperEnd > 0 && agreedBillingAmount > 0)
          ? agreedBillingAmount / feeUpperEnd
          : 1;
        
        // All budget values are now stored in billing currency - no conversion needed
        const effectiveFeeUpperEnd = differentBillingCurrency && agreedBillingAmount > 0 
          ? agreedBillingAmount 
          : feeUpperEnd;
        
        // Check for manual budget override
        const useManualBudget = matterAny.use_manual_budget ?? false;
        const manualBudgetAmount = matterAny.manual_budget_amount ?? 0;
        
        // BM and LC fees are already stored in billing currency
        // Use manual budget if enabled, otherwise use calculated from line items
        const calculatedBmFee = matter.bm_fee_component;
        const effectiveBmFee = useManualBudget ? manualBudgetAmount : calculatedBmFee;
        const effectiveLocalCounselFee = matter.local_counsel_fee;
        const effectiveCurrency = differentBillingCurrency && agreedBillingAmount > 0
          ? billingCurrency
          : matter.fee_currency;
        
        // Financial snapshots are stored in BILLING currency - no conversion needed
        // The mandatedRate only applies to budget/quote figures, NOT to financial snapshots
        const effectiveWipAmount = wipAmount;
        const effectiveBilledAmount = billedAmount;
        const effectiveAccountsReceivable = accountsReceivable;
        const effectivePaidAmount = paidAmount;
        const effectiveWipWriteOffAmount = wipWriteOffAmount;
        
        // BM budget burn = WIP + AR + Paid
        // Each value is mutually exclusive: WIP → AR (when billed) → Paid (when collected)
        const bmTotalUsed = effectiveWipAmount + effectiveAccountsReceivable + effectivePaidAmount;
        
        // LC financial data - also stored in billing currency, no conversion needed
        const effectiveLcWip = lcWip;
        const effectiveLcBilled = lcBilled;
        // Check if any local counsel has 'Disb' billing mode, or fallback to matter-level setting
        const hasDisb = localCounselBilling === 'Disb' || 
          localCounsels.some(lc => lc.billing_mode === 'Disb');
        const lcTotalUsed = hasDisb ? (effectiveLcWip + effectiveLcBilled) : 0;
        
        // Total budget burn includes both BM and LC (when in Disb mode)
        const totalUsed = bmTotalUsed + lcTotalUsed;
        
        const remainingBudget = budget - totalUsed;
        const budgetUsedPercent = budget > 0 ? (totalUsed / budget) * 100 : 0;
        const collectionRate = effectiveBilledAmount > 0 ? (effectivePaidAmount / effectiveBilledAmount) * 100 : 0;
        
        // BM Headroom (BM Budget - BM Used)
        const bmHeadroom = effectiveBmFee - bmTotalUsed;
        const bmHeadroomPercent = effectiveBmFee > 0 ? (bmHeadroom / effectiveBmFee) * 100 : 0;
        
        // LC Headroom (LC Budget - LC Used) - only relevant for Disb mode
        const lcHeadroom = effectiveLocalCounselFee - lcTotalUsed;
        const lcHeadroomPercent = effectiveLocalCounselFee > 0 ? (lcHeadroom / effectiveLocalCounselFee) * 100 : 0;
        
        // Total Headroom (Total Budget - Total Used)
        const headroom = effectiveFeeUpperEnd - totalUsed;
        const headroomPercent = effectiveFeeUpperEnd > 0 ? (headroom / effectiveFeeUpperEnd) * 100 : 0;

        return {
          ...matter,
          latest_snapshot: snapshot ? {
            wip_amount: effectiveWipAmount, // Net WIP (after write-offs) in billing currency
            wip_write_off_amount: effectiveWipWriteOffAmount,
            billed_amount: effectiveBilledAmount,
            accounts_receivable: effectiveAccountsReceivable,
            paid_amount: effectivePaidAmount,
            as_of_date: snapshot.as_of_date,
            update_source: snapshot.update_source,
          } : undefined,
          // ACTUAL snapshot - never contains proposal data, always the real system figures
          // Use this for Master WIP import comparisons to ensure accurate tracking
          // IMPORTANT: For snapshots, wip_amount IS already NET (report already reduced it)
          // The write-off is stored separately for realization tracking only
          actual_snapshot: snapshot ? {
            wip_amount: snapshot.wip_amount || 0, // Already NET WIP from real snapshot
            wip_write_off_amount: snapshot.wip_write_off_amount || 0,
            billed_amount: snapshot.billed_amount || 0,
            accounts_receivable: snapshot.accounts_receivable || 0,
            paid_amount: snapshot.paid_amount || 0,
            as_of_date: snapshot.as_of_date,
            update_source: snapshot.update_source,
          } : undefined,
          remaining_budget: remainingBudget,
          budget_used_percent: budgetUsedPercent,
          collection_rate: collectionRate,
          headroom,
          headroom_percent: headroomPercent,
          bm_headroom: bmHeadroom,
          bm_headroom_percent: bmHeadroomPercent,
          lc_headroom_percent: lcHeadroomPercent,
          total_paid_ar_wip: totalUsed, // Budget burn = WIP only (WIP stays until paid)
          // Add effective values for display
          effective_fee_upper_end: effectiveFeeUpperEnd,
          effective_bm_fee: effectiveBmFee,
          effective_local_counsel_fee: effectiveLocalCounselFee,
          effective_currency: effectiveCurrency,
          mandated_rate: mandatedRate,
          quote_currency: quoteCurrency,
          billing_currency: billingCurrency,
          different_billing_currency: differentBillingCurrency,
          agreed_billing_amount: agreedBillingAmount,
          // Override legacy lc_wip/lc_billed with aggregated values from matter_local_counsels (in billing currency)
          lc_wip: effectiveLcWip,
          lc_billed: effectiveLcBilled,
          // Include full local counsels list for per-LC billing mode display
          local_counsels: localCounsels,
          // Include proposal info for highlighting in master table
          selected_proposal: selectedProposal || null,
          show_shaping_proposal: matter.show_shaping_proposal || false,
          // Include snapshot history for sparkline charts
          snapshot_history: snapshotHistoryMap.get(matter.id) || [],
        } as MatterWithFinancials;
      }) || [];
    },
    enabled: !!user,
  });

  const createMatter = useMutation({
    mutationFn: async (input: CreateMatterInput) => {
      // Check if there's an existing matter for this client with a client-wide rate modifier
      // Only apply if the new matter is not multi-client
      let rateModifierOverride: { 
        rate_modifier?: string; 
        rate_modifier_value?: number; 
        rate_modifier_scope?: string;
      } = {};
      
      if (input.client_id && !input.is_multi_client) {
        const { data: existingMatter } = await supabase
          .from('matters')
          .select('rate_modifier, rate_modifier_value, rate_modifier_scope')
          .eq('client_id', input.client_id)
          .eq('user_id', user!.id)
          .eq('rate_modifier_scope', 'all_client_matters')
          .limit(1)
          .maybeSingle();
        
        if (existingMatter && existingMatter.rate_modifier && 
            (existingMatter.rate_modifier === 'discounted_rates' || existingMatter.rate_modifier === 'blended_hourly_rate')) {
          rateModifierOverride = {
            rate_modifier: existingMatter.rate_modifier,
            rate_modifier_value: existingMatter.rate_modifier_value,
            rate_modifier_scope: existingMatter.rate_modifier_scope,
          };
        }
      }
      
      const { data, error } = await supabase
        .from('matters')
        .insert({
          ...input,
          ...rateModifierOverride,
          user_id: user!.id,
          created_by: user!.id,
          updated_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      toast({ title: 'Matter created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create matter', description: error.message, variant: 'destructive' });
    },
  });

  const updateMatter = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateMatterInput> & { id: string } & { 
      rate_modifier?: string | null;
      rate_modifier_value?: number | null;
      rate_modifier_scope?: string | null;
    }) => {
      // First, update the current matter
      const { data, error } = await supabase
        .from('matters')
        .update({ ...input, updated_by: user!.id })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Check if we need to propagate rate modifier to other client matters
      // Use the updated matter's data to check the scope (in case input didn't explicitly include it)
      const effectiveScope = input.rate_modifier_scope ?? data.rate_modifier_scope;
      const effectiveModifier = input.rate_modifier ?? data.rate_modifier;
      const effectiveValue = input.rate_modifier_value ?? data.rate_modifier_value;
      
      if (effectiveScope === 'all_client_matters' && 
          (effectiveModifier === 'discounted_rates' || effectiveModifier === 'blended_hourly_rate')) {
        
        // Get the client_id and user_id from the updated matter
        const clientId = data.client_id;
        const userId = data.user_id;
        
        if (clientId && userId) {
          // Find all other matters for this client where the client is the SOLE client (not multi-client)
          // Exclude the current matter, and ensure they belong to the same user (for RLS compliance)
          const { data: otherMatters, error: fetchError } = await supabase
            .from('matters')
            .select('id')
            .eq('client_id', clientId)
            .eq('user_id', userId)
            .eq('is_multi_client', false)
            .neq('id', id);
          
          if (!fetchError && otherMatters && otherMatters.length > 0) {
            // Update all those matters with the same rate modifier settings
            const otherMatterIds = otherMatters.map(m => m.id);
            
            const { error: updateError } = await supabase
              .from('matters')
              .update({
                rate_modifier: effectiveModifier,
                rate_modifier_value: effectiveValue,
                rate_modifier_scope: effectiveScope,
                updated_by: user!.id,
              })
              .in('id', otherMatterIds);
            
            if (updateError) {
              console.error('Failed to propagate rate modifier to other matters:', updateError);
            }
          }
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['matter', variables.id] });
      // Show a more informative message when propagating
      const effectiveScope = variables.rate_modifier_scope;
      if (effectiveScope === 'all_client_matters') {
        toast({ title: 'Rate modifier applied to all client matters' });
      } else {
        toast({ title: 'Matter updated successfully' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update matter', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMatter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('matters')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      toast({ title: 'Matter deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete matter', description: error.message, variant: 'destructive' });
    },
  });

  return {
    matters: mattersQuery.data || [],
    isLoading: mattersQuery.isLoading,
    error: mattersQuery.error,
    createMatter,
    updateMatter,
    deleteMatter,
  };
}

export function useMatter(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['matter', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matters')
        .select(`
          *,
          clients (id, name, display_name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Matter | null;
    },
    enabled: !!user && !!id,
  });
}
