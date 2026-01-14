import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { DraftLineItem } from './useBudgetVersions';

export interface BudgetDraft {
  id: string;
  matter_id: string;
  user_id: string;
  name: string;
  notes: string | null;
  line_items: DraftLineItem[];
  total_amount: number;
  bm_total: number;
  local_counsel_total: number;
  created_at: string;
  updated_at: string;
}

interface CreateDraftInput {
  matter_id: string;
  name?: string;
  notes?: string;
  line_items: DraftLineItem[];
}

export function useBudgetDrafts(matterId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all drafts for a matter
  const draftsQuery = useQuery({
    queryKey: ['budget-drafts', matterId],
    queryFn: async () => {
      if (!matterId) return [];
      
      const { data, error } = await supabase
        .from('budget_drafts')
        .select('*')
        .eq('matter_id', matterId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse line_items from JSONB
      return (data || []).map(draft => ({
        ...draft,
        line_items: (draft.line_items as unknown as DraftLineItem[]) || [],
      })) as BudgetDraft[];
    },
    enabled: !!matterId && !!user,
  });

  // Create a new draft
  const createDraft = useMutation({
    mutationFn: async (input: CreateDraftInput) => {
      if (!user) throw new Error('Not authenticated');

      // Calculate totals
      const validItems = input.line_items.filter(item => item.work_item.trim() !== '');
      const includedItems = validItems.filter(item => 
        !item.is_optional || (item.is_optional && item.is_included !== false)
      );
      
      const bmTotal = includedItems
        .filter(item => item.provider === 'Baker McKenzie')
        .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
      const localCounselTotal = includedItems
        .filter(item => item.provider === 'Local Counsel')
        .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
      const totalAmount = bmTotal + localCounselTotal;

      const { data, error } = await supabase
        .from('budget_drafts')
        .insert([{
          matter_id: input.matter_id,
          user_id: user.id,
          name: input.name || 'Draft Budget',
          notes: input.notes || null,
          line_items: JSON.parse(JSON.stringify(validItems)),
          total_amount: totalAmount,
          bm_total: bmTotal,
          local_counsel_total: localCounselTotal,
        }])
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        line_items: (data.line_items as unknown as DraftLineItem[]) || [],
      } as BudgetDraft;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-drafts', matterId] });
      toast.success('Draft saved for client discussion');
    },
    onError: (error) => {
      console.error('Failed to create draft:', error);
      toast.error('Failed to save draft');
    },
  });

  // Update an existing draft
  const updateDraft = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateDraftInput> & { id: string }) => {
      if (!user) throw new Error('Not authenticated');

      const updateData: Record<string, unknown> = {};
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.notes !== undefined) updateData.notes = input.notes;
      
      if (input.line_items) {
        const validItems = input.line_items.filter(item => item.work_item.trim() !== '');
        const includedItems = validItems.filter(item => 
          !item.is_optional || (item.is_optional && item.is_included !== false)
        );
        
        const bmTotal = includedItems
          .filter(item => item.provider === 'Baker McKenzie')
          .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
        const localCounselTotal = includedItems
          .filter(item => item.provider === 'Local Counsel')
          .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
        
        updateData.line_items = validItems as unknown as Record<string, unknown>[];
        updateData.total_amount = bmTotal + localCounselTotal;
        updateData.bm_total = bmTotal;
        updateData.local_counsel_total = localCounselTotal;
      }

      const { data, error } = await supabase
        .from('budget_drafts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        line_items: (data.line_items as unknown as DraftLineItem[]) || [],
      } as BudgetDraft;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-drafts', matterId] });
      toast.success('Draft updated');
    },
    onError: (error) => {
      console.error('Failed to update draft:', error);
      toast.error('Failed to update draft');
    },
  });

  // Delete a draft
  const deleteDraft = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from('budget_drafts')
        .delete()
        .eq('id', draftId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-drafts', matterId] });
      toast.success('Draft deleted');
    },
    onError: (error) => {
      console.error('Failed to delete draft:', error);
      toast.error('Failed to delete draft');
    },
  });

  return {
    drafts: draftsQuery.data || [],
    isLoading: draftsQuery.isLoading,
    createDraft,
    updateDraft,
    deleteDraft,
  };
}
