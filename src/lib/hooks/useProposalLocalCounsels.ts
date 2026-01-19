import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LocalCounsel } from './useLocalCounsels';

export interface ProposalLocalCounsel {
  id: string;
  proposal_id: string;
  local_counsel_id: string;
  firm_name: string;
  raw_wip_amount: number;
  raw_billed_amount: number;
  proposed_wip_amount: number;
  proposed_billed_amount: number;
  wip_write_off_amount: number;
  billed_write_off_amount: number;
  created_at: string;
  updated_at: string;
}

export interface LocalCounselProposalData {
  local_counsel_id: string;
  firm_name: string;
  raw_wip_amount: number;
  raw_billed_amount: number;
  proposed_wip_amount: number;
  proposed_billed_amount: number;
}

export function useProposalLocalCounsels(proposalId?: string) {
  const queryClient = useQueryClient();

  // Fetch all local counsel data for a proposal
  const proposalLcQuery = useQuery({
    queryKey: ['proposal-local-counsels', proposalId],
    queryFn: async () => {
      if (!proposalId) return [];
      const { data, error } = await supabase
        .from('wip_proposal_local_counsels')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('firm_name', { ascending: true });

      if (error) throw error;
      return data as ProposalLocalCounsel[];
    },
    enabled: !!proposalId,
  });

  // Save/update local counsel data for a proposal (batch operation)
  const saveProposalLocalCounsels = useMutation({
    mutationFn: async ({ 
      proposalId, 
      localCounselData 
    }: { 
      proposalId: string; 
      localCounselData: LocalCounselProposalData[] 
    }) => {
      // Delete existing entries for this proposal
      await supabase
        .from('wip_proposal_local_counsels')
        .delete()
        .eq('proposal_id', proposalId);

      // Insert new entries
      if (localCounselData.length > 0) {
        const insertData = localCounselData.map(lc => ({
          proposal_id: proposalId,
          local_counsel_id: lc.local_counsel_id,
          firm_name: lc.firm_name,
          raw_wip_amount: lc.raw_wip_amount,
          raw_billed_amount: lc.raw_billed_amount,
          proposed_wip_amount: lc.proposed_wip_amount,
          proposed_billed_amount: lc.proposed_billed_amount,
          wip_write_off_amount: lc.raw_wip_amount - lc.proposed_wip_amount,
          billed_write_off_amount: lc.raw_billed_amount - lc.proposed_billed_amount,
        }));

        const { error } = await supabase
          .from('wip_proposal_local_counsels')
          .insert(insertData);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal-local-counsels', variables.proposalId] });
    },
  });

  // Calculate aggregates from proposal local counsels
  const proposalLocalCounsels = proposalLcQuery.data || [];
  const totalProposedWip = proposalLocalCounsels.reduce((sum, lc) => sum + (lc.proposed_wip_amount || 0), 0);
  const totalProposedBilled = proposalLocalCounsels.reduce((sum, lc) => sum + (lc.proposed_billed_amount || 0), 0);
  const totalWipWriteOff = proposalLocalCounsels.reduce((sum, lc) => sum + (lc.wip_write_off_amount || 0), 0);
  const totalBilledWriteOff = proposalLocalCounsels.reduce((sum, lc) => sum + (lc.billed_write_off_amount || 0), 0);

  return {
    proposalLocalCounsels,
    isLoading: proposalLcQuery.isLoading,
    error: proposalLcQuery.error,
    saveProposalLocalCounsels,
    // Aggregates
    totalProposedWip,
    totalProposedBilled,
    totalWipWriteOff,
    totalBilledWriteOff,
    refetch: proposalLcQuery.refetch,
  };
}

// Helper to initialize proposal LC data from actual local counsels
export function initializeProposalLcData(localCounsels: LocalCounsel[]): LocalCounselProposalData[] {
  return localCounsels.map(lc => ({
    local_counsel_id: lc.id,
    firm_name: lc.firm_name,
    raw_wip_amount: lc.wip_amount || 0,
    raw_billed_amount: lc.billed_amount || 0,
    proposed_wip_amount: lc.wip_amount || 0,
    proposed_billed_amount: lc.billed_amount || 0,
  }));
}

// Helper to convert existing proposal LC data to form data
export function proposalLcToFormData(proposalLcs: ProposalLocalCounsel[]): LocalCounselProposalData[] {
  return proposalLcs.map(lc => ({
    local_counsel_id: lc.local_counsel_id,
    firm_name: lc.firm_name,
    raw_wip_amount: lc.raw_wip_amount,
    raw_billed_amount: lc.raw_billed_amount,
    proposed_wip_amount: lc.proposed_wip_amount,
    proposed_billed_amount: lc.proposed_billed_amount,
  }));
}
