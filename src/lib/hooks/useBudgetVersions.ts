import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface BudgetLineItem {
  id: string;
  budget_version_id: string;
  matter_id: string;
  user_id: string;
  work_item: string;
  provider: 'Baker McKenzie' | 'Local Counsel';
  fee_amount: number;
  sort_order: number;
  lc_firm_name: string | null;
  is_optional: boolean;
  is_included: boolean;
  category: string | null;
  wip_amount: number;
  wip_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export const BUDGET_CATEGORIES = [
  'Due Diligence',
  'Documentation',
  'Negotiations', 
  'Meetings',
  'Regulatory',
  'Closing',
  'Tax',
  'Legal Opinions',
  'Other'
] as const;

export type BudgetCategory = typeof BUDGET_CATEGORIES[number];

export interface BudgetVersion {
  id: string;
  matter_id: string;
  user_id: string;
  version_number: number;
  total_amount: number;
  bm_total: number;
  local_counsel_total: number;
  notes: string | null;
  finalized_at: string;
  created_at: string;
  line_items?: BudgetLineItem[];
}

export interface DraftLineItem {
  id?: string;
  work_item: string;
  provider: 'Baker McKenzie' | 'Local Counsel';
  fee_amount: number;
  lc_firm_name?: string;
  is_optional?: boolean;
  is_included?: boolean;
  category?: string | null;
  wip_amount?: number;
  wip_updated_at?: string | null;
}

export interface FinalizeBudgetInput {
  matter_id: string;
  line_items: DraftLineItem[];
  notes?: string;
}

export function useBudgetVersions(matterId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all budget versions for a matter
  const versionsQuery = useQuery({
    queryKey: ['budget-versions', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_versions')
        .select('*')
        .eq('matter_id', matterId!)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return data as BudgetVersion[];
    },
    enabled: !!user && !!matterId,
  });

  // Fetch line items for a specific version
  const fetchLineItems = async (versionId: string): Promise<BudgetLineItem[]> => {
    const { data, error } = await supabase
      .from('budget_line_items')
      .select('*')
      .eq('budget_version_id', versionId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data as BudgetLineItem[];
  };

  // Get the latest version
  const latestVersion = versionsQuery.data?.[0];

  // Fetch line items for latest version
  const latestLineItemsQuery = useQuery({
    queryKey: ['budget-line-items', latestVersion?.id],
    queryFn: () => fetchLineItems(latestVersion!.id),
    enabled: !!user && !!latestVersion?.id,
  });

  // Finalize budget (create new version)
  const finalizeBudget = useMutation({
    mutationFn: async (input: FinalizeBudgetInput) => {
      // Calculate totals - only include items that are not optional OR are optional and included
      const includedItems = input.line_items.filter(item => 
        !item.is_optional || (item.is_optional && item.is_included !== false)
      );
      const bmTotal = includedItems
        .filter(item => item.provider === 'Baker McKenzie')
        .reduce((sum, item) => sum + item.fee_amount, 0);
      const localCounselTotal = includedItems
        .filter(item => item.provider === 'Local Counsel')
        .reduce((sum, item) => sum + item.fee_amount, 0);
      const totalAmount = bmTotal + localCounselTotal;

      // Get next version number
      const existingVersions = versionsQuery.data || [];
      const nextVersionNumber = existingVersions.length > 0 
        ? Math.max(...existingVersions.map(v => v.version_number)) + 1 
        : 1;

      // Create version
      const { data: version, error: versionError } = await supabase
        .from('budget_versions')
        .insert({
          matter_id: input.matter_id,
          user_id: user!.id,
          version_number: nextVersionNumber,
          total_amount: totalAmount,
          bm_total: bmTotal,
          local_counsel_total: localCounselTotal,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (versionError) throw versionError;

      // Create line items
      if (input.line_items.length > 0) {
        const lineItemsToInsert = input.line_items.map((item, index) => ({
          budget_version_id: version.id,
          matter_id: input.matter_id,
          user_id: user!.id,
          work_item: item.work_item,
          provider: item.provider,
          fee_amount: item.fee_amount,
          sort_order: index,
          lc_firm_name: item.provider === 'Local Counsel' ? (item.lc_firm_name || null) : null,
          is_optional: item.is_optional ?? false,
          is_included: item.is_included ?? true,
          category: item.category || null,
        }));

        const { error: itemsError } = await supabase
          .from('budget_line_items')
          .insert(lineItemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Update the matters table with new budget totals
      const { error: matterError } = await supabase
        .from('matters')
        .update({
          fee_amount_upper_end: totalAmount,
          bm_fee_component: bmTotal,
          local_counsel_fee: localCounselTotal,
        })
        .eq('id', input.matter_id);

      if (matterError) throw matterError;

      return version;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budget-versions', variables.matter_id] });
      queryClient.invalidateQueries({ queryKey: ['budget-line-items'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['matter', variables.matter_id] });
      toast({ title: 'Budget finalized successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to finalize budget', description: error.message, variant: 'destructive' });
    },
  });

  // Delete a budget version
  const deleteBudgetVersion = useMutation({
    mutationFn: async (versionId: string) => {
      // Get the version to delete
      const versionToDelete = versionsQuery.data?.find(v => v.id === versionId);
      if (!versionToDelete) throw new Error('Version not found');

      // Delete the version (line items will cascade delete)
      const { error: deleteError } = await supabase
        .from('budget_versions')
        .delete()
        .eq('id', versionId);

      if (deleteError) throw deleteError;

      // Get remaining versions after deletion
      const remainingVersions = (versionsQuery.data || []).filter(v => v.id !== versionId);

      // Update matters table with the previous version's totals, or zero if no versions left
      if (remainingVersions.length > 0) {
        // Sort by version number to get the new latest
        const newLatest = remainingVersions.sort((a, b) => b.version_number - a.version_number)[0];
        const { error: matterError } = await supabase
          .from('matters')
          .update({
            fee_amount_upper_end: newLatest.total_amount,
            bm_fee_component: newLatest.bm_total,
            local_counsel_fee: newLatest.local_counsel_total,
          })
          .eq('id', matterId!);

        if (matterError) throw matterError;
      } else {
        // No versions left, reset to zero
        const { error: matterError } = await supabase
          .from('matters')
          .update({
            fee_amount_upper_end: 0,
            bm_fee_component: 0,
            local_counsel_fee: 0,
          })
          .eq('id', matterId!);

        if (matterError) throw matterError;
      }

      return versionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-versions', matterId] });
      queryClient.invalidateQueries({ queryKey: ['budget-line-items'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['matter', matterId] });
      toast({ title: 'Budget version deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete budget version', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle is_included for an optional line item (quick toggle without full budget update)
  const toggleLineItemIncluded = useMutation({
    mutationFn: async ({ lineItemId, isIncluded }: { lineItemId: string; isIncluded: boolean }) => {
      const { error } = await supabase
        .from('budget_line_items')
        .update({ is_included: isIncluded })
        .eq('id', lineItemId);

      if (error) throw error;

      // Recalculate and update matter totals based on current line items
      if (latestVersion) {
        const { data: allItems, error: fetchError } = await supabase
          .from('budget_line_items')
          .select('*')
          .eq('budget_version_id', latestVersion.id);

        if (fetchError) throw fetchError;

        // Update the item in memory for calculation
        const updatedItems = (allItems || []).map(item => 
          item.id === lineItemId ? { ...item, is_included: isIncluded } : item
        );

        // Calculate new totals - only include items that are not optional OR are optional and included
        const includedItems = updatedItems.filter(item => 
          !item.is_optional || (item.is_optional && item.is_included)
        );
        const bmTotal = includedItems
          .filter(item => item.provider === 'Baker McKenzie')
          .reduce((sum, item) => sum + Number(item.fee_amount), 0);
        const localCounselTotal = includedItems
          .filter(item => item.provider === 'Local Counsel')
          .reduce((sum, item) => sum + Number(item.fee_amount), 0);
        const totalAmount = bmTotal + localCounselTotal;

        // Update budget version totals
        await supabase
          .from('budget_versions')
          .update({
            total_amount: totalAmount,
            bm_total: bmTotal,
            local_counsel_total: localCounselTotal,
          })
          .eq('id', latestVersion.id);

        // Update matter totals
        await supabase
          .from('matters')
          .update({
            fee_amount_upper_end: totalAmount,
            bm_fee_component: bmTotal,
            local_counsel_fee: localCounselTotal,
          })
          .eq('id', matterId!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-line-items'] });
      queryClient.invalidateQueries({ queryKey: ['budget-versions', matterId] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['matter', matterId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to toggle item', description: error.message, variant: 'destructive' });
    },
  });

  // Update is_optional flag for a line item
  const updateLineItemOptional = useMutation({
    mutationFn: async ({ lineItemId, isOptional }: { lineItemId: string; isOptional: boolean }) => {
      // When marking as optional, default to not included. When unmarking, set to included.
      const { error } = await supabase
        .from('budget_line_items')
        .update({ 
          is_optional: isOptional,
          is_included: isOptional ? false : true 
        })
        .eq('id', lineItemId);

      if (error) throw error;

      // Recalculate totals after changing optional status
      if (latestVersion) {
        const { data: allItems, error: fetchError } = await supabase
          .from('budget_line_items')
          .select('*')
          .eq('budget_version_id', latestVersion.id);

        if (fetchError) throw fetchError;

        // Update the item in memory for calculation
        const updatedItems = (allItems || []).map(item => 
          item.id === lineItemId ? { ...item, is_optional: isOptional, is_included: isOptional ? false : true } : item
        );

        const includedItems = updatedItems.filter(item => 
          !item.is_optional || (item.is_optional && item.is_included)
        );
        const bmTotal = includedItems
          .filter(item => item.provider === 'Baker McKenzie')
          .reduce((sum, item) => sum + Number(item.fee_amount), 0);
        const localCounselTotal = includedItems
          .filter(item => item.provider === 'Local Counsel')
          .reduce((sum, item) => sum + Number(item.fee_amount), 0);
        const totalAmount = bmTotal + localCounselTotal;

        await supabase
          .from('budget_versions')
          .update({
            total_amount: totalAmount,
            bm_total: bmTotal,
            local_counsel_total: localCounselTotal,
          })
          .eq('id', latestVersion.id);

        await supabase
          .from('matters')
          .update({
            fee_amount_upper_end: totalAmount,
            bm_fee_component: bmTotal,
            local_counsel_fee: localCounselTotal,
          })
          .eq('id', matterId!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-line-items'] });
      queryClient.invalidateQueries({ queryKey: ['budget-versions', matterId] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['matter', matterId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update item', description: error.message, variant: 'destructive' });
    },
  });

  return {
    versions: versionsQuery.data || [],
    latestVersion,
    latestLineItems: latestLineItemsQuery.data || [],
    isLoading: versionsQuery.isLoading,
    isLoadingLineItems: latestLineItemsQuery.isLoading,
    error: versionsQuery.error,
    finalizeBudget,
    deleteBudgetVersion,
    fetchLineItems,
    toggleLineItemIncluded,
    updateLineItemOptional,
  };
}
