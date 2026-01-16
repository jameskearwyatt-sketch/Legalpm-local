import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface WipShapingProposal {
  id: string;
  matter_id: string;
  user_id: string;
  proposal_date: string;
  notes: string;
  wip_amount: number;
  wip_write_off_amount: number;
  billed_amount: number;
  paid_amount: number;
  accounts_receivable: number;
  status: 'active' | 'archived';
  is_selected: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProposalInput {
  matter_id: string;
  notes: string;
  wip_amount: number;
  wip_write_off_amount: number;
  billed_amount: number;
  paid_amount: number;
  accounts_receivable: number;
}

export interface UpdateProposalInput {
  id: string;
  notes?: string;
  wip_amount?: number;
  wip_write_off_amount?: number;
  billed_amount?: number;
  paid_amount?: number;
  accounts_receivable?: number;
  status?: 'active' | 'archived';
  is_selected?: boolean;
}

export function useWipShapingProposals(matterId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all proposals for a matter
  const proposalsQuery = useQuery({
    queryKey: ['wip-shaping-proposals', matterId],
    queryFn: async () => {
      if (!matterId) return [];
      const { data, error } = await supabase
        .from('wip_shaping_proposals')
        .select('*')
        .eq('matter_id', matterId)
        .order('proposal_date', { ascending: false });
      if (error) throw error;
      return data as WipShapingProposal[];
    },
    enabled: !!matterId,
  });

  // Get the currently selected proposal
  const selectedProposal = proposalsQuery.data?.find(p => p.is_selected) || null;

  // Create a new proposal
  const createProposal = useMutation({
    mutationFn: async (input: CreateProposalInput) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { data, error } = await supabase
        .from('wip_shaping_proposals')
        .insert({
          ...input,
          user_id: user.id,
          proposal_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wip-shaping-proposals', matterId] });
      toast.success('WIP shaping proposal created');
    },
    onError: (error) => {
      console.error('Failed to create proposal:', error);
      toast.error('Failed to create proposal');
    },
  });

  // Update an existing proposal
  const updateProposal = useMutation({
    mutationFn: async (input: UpdateProposalInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('wip_shaping_proposals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wip-shaping-proposals', matterId] });
      toast.success('Proposal updated');
    },
    onError: (error) => {
      console.error('Failed to update proposal:', error);
      toast.error('Failed to update proposal');
    },
  });

  // Select a proposal (and deselect others)
  const selectProposal = useMutation({
    mutationFn: async (proposalId: string | null) => {
      if (!matterId) throw new Error('Matter ID required');
      
      // First, deselect all proposals for this matter
      await supabase
        .from('wip_shaping_proposals')
        .update({ is_selected: false })
        .eq('matter_id', matterId);
      
      // Then select the specified one (if any)
      if (proposalId) {
        const { error } = await supabase
          .from('wip_shaping_proposals')
          .update({ is_selected: true })
          .eq('id', proposalId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wip-shaping-proposals', matterId] });
    },
    onError: (error) => {
      console.error('Failed to select proposal:', error);
      toast.error('Failed to select proposal');
    },
  });

  // Delete a proposal
  const deleteProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase
        .from('wip_shaping_proposals')
        .delete()
        .eq('id', proposalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wip-shaping-proposals', matterId] });
      toast.success('Proposal deleted');
    },
    onError: (error) => {
      console.error('Failed to delete proposal:', error);
      toast.error('Failed to delete proposal');
    },
  });

  // Archive a proposal
  const archiveProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase
        .from('wip_shaping_proposals')
        .update({ status: 'archived', is_selected: false })
        .eq('id', proposalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wip-shaping-proposals', matterId] });
      toast.success('Proposal archived');
    },
    onError: (error) => {
      console.error('Failed to archive proposal:', error);
      toast.error('Failed to archive proposal');
    },
  });

  return {
    proposals: proposalsQuery.data || [],
    activeProposals: (proposalsQuery.data || []).filter(p => p.status === 'active'),
    archivedProposals: (proposalsQuery.data || []).filter(p => p.status === 'archived'),
    selectedProposal,
    isLoading: proposalsQuery.isLoading,
    createProposal,
    updateProposal,
    selectProposal,
    deleteProposal,
    archiveProposal,
  };
}
