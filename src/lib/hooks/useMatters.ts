import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

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
  // New fields
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
  // Billing currency fields
  different_billing_currency: boolean;
  agreed_billing_amount: number;
  quote_currency: string | null;
  billing_currency: string | null;
  is_multi_client: boolean;
  // Full time costs mode (no estimate/headroom tracking)
  pay_full_time_costs: boolean;
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

export interface MatterWithFinancials extends Matter {
  latest_snapshot?: {
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
    as_of_date: string;
  };
  remaining_budget: number;
  budget_used_percent: number;
  collection_rate: number;
  headroom: number;
  headroom_percent: number;
  total_paid_ar_wip: number;
  local_counsels?: LocalCounselBrief[];
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

      // Get the latest snapshot for each matter
      const { data: snapshots } = await supabase
        .from('financial_snapshots')
        .select('*')
        .in('matter_id', matterIds)
        .order('as_of_date', { ascending: false });
      
      // Get all local counsel data for aggregation
      const { data: localCounsels } = await supabase
        .from('matter_local_counsels')
        .select('*')
        .in('matter_id', matterIds);

      // Create a map of matter_id to latest snapshot
      const snapshotMap = new Map<string, any>();
      snapshots?.forEach(snap => {
        if (!snapshotMap.has(snap.matter_id)) {
          snapshotMap.set(snap.matter_id, snap);
        }
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

      // Combine matters with their financial data
      return matters?.map(matter => {
        const snapshot = snapshotMap.get(matter.id);
        const rawWipAmount = snapshot?.wip_amount || 0;
        const wipWriteOffAmount = snapshot?.wip_write_off_amount || 0;
        // Net WIP = raw WIP minus write-offs (write-offs reduce actual WIP)
        const wipAmount = rawWipAmount - wipWriteOffAmount;
        const billedAmount = snapshot?.billed_amount || 0;
        const accountsReceivable = snapshot?.accounts_receivable || 0;
        const paidAmount = snapshot?.paid_amount || 0;
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
        // BM and LC fees are already stored in billing currency
        const effectiveBmFee = matter.bm_fee_component;
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
        const lcTotalUsed = localCounselBilling === 'Disb' ? (effectiveLcWip + effectiveLcBilled) : 0;
        
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
          } : undefined,
          remaining_budget: remainingBudget,
          budget_used_percent: budgetUsedPercent,
          collection_rate: collectionRate,
          headroom,
          headroom_percent: headroomPercent,
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
        } as MatterWithFinancials;
      }) || [];
    },
    enabled: !!user,
  });

  const createMatter = useMutation({
    mutationFn: async (input: CreateMatterInput) => {
      const { data, error } = await supabase
        .from('matters')
        .insert({
          ...input,
          user_id: user!.id,
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
    mutationFn: async ({ id, ...input }: Partial<CreateMatterInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('matters')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      toast({ title: 'Matter updated successfully' });
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
