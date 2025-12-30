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
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
  };
}

export interface MatterWithFinancials extends Matter {
  latest_snapshot?: {
    wip_amount: number;
    billed_amount: number;
    paid_amount: number;
    as_of_date: string;
  };
  remaining_budget: number;
  budget_used_percent: number;
  collection_rate: number;
  headroom: number;
  headroom_percent: number;
  total_paid_ar_wip: number;
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
          clients (id, name)
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

      // Create a map of matter_id to latest snapshot
      const snapshotMap = new Map<string, any>();
      snapshots?.forEach(snap => {
        if (!snapshotMap.has(snap.matter_id)) {
          snapshotMap.set(snap.matter_id, snap);
        }
      });

      // Combine matters with their financial data
      return matters?.map(matter => {
        const snapshot = snapshotMap.get(matter.id);
        const wipAmount = snapshot?.wip_amount || 0;
        const billedAmount = snapshot?.billed_amount || 0;
        const paidAmount = snapshot?.paid_amount || 0;
        const budget = matter.agreed_budget_amount || 0;
        const feeUpperEnd = matter.fee_amount_upper_end || 0;
        
        const totalUsed = billedAmount + wipAmount;
        const remainingBudget = budget - totalUsed;
        const budgetUsedPercent = budget > 0 ? (totalUsed / budget) * 100 : 0;
        const collectionRate = billedAmount > 0 ? (paidAmount / billedAmount) * 100 : 0;
        
        // Headroom calculation: Fee Amount - (AR + WIP) - paid is subset of billed
        const headroom = feeUpperEnd - totalUsed;
        const headroomPercent = feeUpperEnd > 0 ? (headroom / feeUpperEnd) * 100 : 0;

        return {
          ...matter,
          latest_snapshot: snapshot ? {
            wip_amount: wipAmount,
            billed_amount: billedAmount,
            paid_amount: paidAmount,
            as_of_date: snapshot.as_of_date,
          } : undefined,
          remaining_budget: remainingBudget,
          budget_used_percent: budgetUsedPercent,
          collection_rate: collectionRate,
          headroom,
          headroom_percent: headroomPercent,
          total_paid_ar_wip: totalUsed, // Budget burn = WIP + Billed
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
          clients (id, name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Matter | null;
    },
    enabled: !!user && !!id,
  });
}
