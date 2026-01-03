import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface TimeRecordingDraft {
  id: string;
  user_id: string;
  name: string;
  mode: 'single' | 'multi';
  single_date: string | null;
  date_range_from: string | null;
  date_range_to: string | null;
  grid_entries: any[];
  processed_output: any[] | null;
  is_polished: boolean;
  created_at: string;
  updated_at: string;
}

export function useTimeRecordingDrafts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: drafts, isLoading, refetch } = useQuery({
    queryKey: ['time-recording-drafts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('time_recording_drafts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as TimeRecordingDraft[];
    },
    enabled: !!user,
  });

  const saveDraft = useMutation({
    mutationFn: async (draft: {
      id?: string;
      name: string;
      mode: 'single' | 'multi';
      singleDate: Date | null;
      dateRangeFrom: Date | null;
      dateRangeTo: Date | null;
      gridEntries: any[];
      processedOutput: any[] | null;
      isPolished: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const payload = {
        user_id: user.id,
        name: draft.name,
        mode: draft.mode,
        single_date: draft.singleDate ? draft.singleDate.toISOString().split('T')[0] : null,
        date_range_from: draft.dateRangeFrom ? draft.dateRangeFrom.toISOString().split('T')[0] : null,
        date_range_to: draft.dateRangeTo ? draft.dateRangeTo.toISOString().split('T')[0] : null,
        grid_entries: draft.gridEntries,
        processed_output: draft.processedOutput,
        is_polished: draft.isPolished,
      };

      if (draft.id) {
        // Update existing draft
        const { data, error } = await supabase
          .from('time_recording_drafts')
          .update(payload)
          .eq('id', draft.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new draft
        const { data, error } = await supabase
          .from('time_recording_drafts')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-recording-drafts'] });
      toast({
        title: 'Draft saved',
        description: 'Your time recording has been saved.',
      });
    },
    onError: (error) => {
      console.error('Error saving draft:', error);
      toast({
        title: 'Error',
        description: 'Failed to save draft. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteDraft = useMutation({
    mutationFn: async (draftId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('time_recording_drafts')
        .delete()
        .eq('id', draftId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-recording-drafts'] });
      toast({
        title: 'Draft deleted',
        description: 'The draft has been removed.',
      });
    },
    onError: (error) => {
      console.error('Error deleting draft:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete draft. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteAllDrafts = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('time_recording_drafts')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-recording-drafts'] });
      toast({
        title: 'All drafts deleted',
        description: 'All your time recording drafts have been removed.',
      });
    },
    onError: (error) => {
      console.error('Error deleting all drafts:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete drafts. Please try again.',
        variant: 'destructive',
      });
    },
  });

  return {
    drafts: drafts || [],
    isLoading,
    refetch,
    saveDraft,
    deleteDraft,
    deleteAllDrafts,
  };
}
