import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface ReportConfig {
  dateRange?: { start: string; end: string };
  groupBy?: 'month' | 'quarter';
  practiceAreas?: string[];
}

export interface SavedReport {
  id: string;
  user_id: string;
  name: string;
  report_type: string;
  config: ReportConfig;
  created_at: string;
  updated_at: string;
}

export function useSavedReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ['saved-reports', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_reports' as never)
        .select('*')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SavedReport[];
    },
    enabled: !!user,
  });

  const createReport = useMutation({
    mutationFn: async (input: { name: string; report_type: string; config: ReportConfig }) => {
      const { error } = await supabase
        .from('saved_reports' as never)
        .insert({ ...input, user_id: user!.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      toast({ title: 'Report configuration saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save report', description: error.message, variant: 'destructive' });
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saved_reports' as never)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      toast({ title: 'Saved report deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete report', description: error.message, variant: 'destructive' });
    },
  });

  return {
    savedReports: reportsQuery.data || [],
    isLoading: reportsQuery.isLoading,
    createReport,
    deleteReport,
  };
}
