import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface Assumption {
  id: string;
  matter_id: string;
  user_id: string;
  label: string;
  assumption_text: string;
  source_document: string | null;
  is_standard: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAssumptionInput {
  matter_id: string;
  label: string;
  assumption_text: string;
  source_document?: string;
  is_standard?: boolean;
}

export interface UpdateAssumptionInput {
  id: string;
  label?: string;
  assumption_text?: string;
  is_standard?: boolean;
}

// Refined assumption categories with clear, non-overlapping definitions
export const ASSUMPTION_LABELS = [
  "Document Drafting",
  "Document Negotiation", 
  "Transaction Structure",
  "Transaction Timeline",
  "Due Diligence Scope",
  "Counterparty Conduct",
  "Third Party Approvals",
  "Regulatory & Compliance",
  "Jurisdiction & Governing Law",
  "Financing Arrangements",
  "Disputes & Litigation",
  "Staffing & Resourcing",
  "Client Responsibilities",
  "Excluded Work",
  "Other"
] as const;

export type AssumptionLabel = typeof ASSUMPTION_LABELS[number];

export function useAssumptions(matterId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: assumptions = [], isLoading, error } = useQuery({
    queryKey: ['assumptions', matterId],
    queryFn: async () => {
      if (!matterId) return [];
      
      const { data, error } = await supabase
        .from('matter_assumptions')
        .select('*')
        .eq('matter_id', matterId)
        .order('label', { ascending: true });

      if (error) throw error;
      return data as Assumption[];
    },
    enabled: !!matterId && !!user,
  });

  const createAssumption = useMutation({
    mutationFn: async (input: CreateAssumptionInput) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('matter_assumptions')
        .insert({
          ...input,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assumptions', matterId] });
    },
    onError: (error) => {
      console.error('Error creating assumption:', error);
      toast.error('Failed to create assumption');
    },
  });

  const createBulkAssumptions = useMutation({
    mutationFn: async (inputs: Omit<CreateAssumptionInput, 'matter_id'>[]) => {
      if (!user || !matterId) throw new Error('Not authenticated or no matter ID');
      
      const records = inputs.map(input => ({
        ...input,
        matter_id: matterId,
        user_id: user.id,
      }));

      const { data, error } = await supabase
        .from('matter_assumptions')
        .insert(records)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assumptions', matterId] });
      toast.success('Assumptions imported successfully');
    },
    onError: (error) => {
      console.error('Error creating bulk assumptions:', error);
      toast.error('Failed to import assumptions');
    },
  });

  const updateAssumption = useMutation({
    mutationFn: async ({ id, ...input }: UpdateAssumptionInput) => {
      const { data, error } = await supabase
        .from('matter_assumptions')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assumptions', matterId] });
      toast.success('Assumption updated');
    },
    onError: (error) => {
      console.error('Error updating assumption:', error);
      toast.error('Failed to update assumption');
    },
  });

  const deleteAssumption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('matter_assumptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assumptions', matterId] });
      toast.success('Assumption deleted');
    },
    onError: (error) => {
      console.error('Error deleting assumption:', error);
      toast.error('Failed to delete assumption');
    },
  });

  const deleteAllAssumptions = useMutation({
    mutationFn: async () => {
      if (!matterId) throw new Error('No matter ID');
      
      const { error } = await supabase
        .from('matter_assumptions')
        .delete()
        .eq('matter_id', matterId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assumptions', matterId] });
    },
    onError: (error) => {
      console.error('Error deleting all assumptions:', error);
      toast.error('Failed to delete assumptions');
    },
  });

  return {
    assumptions,
    isLoading,
    error,
    createAssumption,
    createBulkAssumptions,
    updateAssumption,
    deleteAssumption,
    deleteAllAssumptions,
  };
}
