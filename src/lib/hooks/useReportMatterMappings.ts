import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReportMatterMapping {
  id: string;
  user_id: string;
  imported_matter_number: string | null;
  imported_matter_name: string | null;
  imported_client_name: string | null;
  mapped_matter_id: string;
  created_at: string;
  updated_at: string;
}

export function useReportMatterMappings() {
  const queryClient = useQueryClient();

  const mappingsQuery = useQuery({
    queryKey: ['report-matter-mappings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('report_matter_mappings')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as ReportMatterMapping[];
    },
  });

  const saveMapping = useMutation({
    mutationFn: async (mapping: {
      imported_matter_number: string | null;
      imported_matter_name: string | null;
      imported_client_name: string | null;
      mapped_matter_id: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('report_matter_mappings')
        .upsert(
          {
            user_id: user.id,
            imported_matter_number: mapping.imported_matter_number,
            imported_matter_name: mapping.imported_matter_name,
            imported_client_name: mapping.imported_client_name,
            mapped_matter_id: mapping.mapped_matter_id,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,imported_matter_number,imported_matter_name',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-matter-mappings'] });
    },
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('report_matter_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-matter-mappings'] });
    },
  });

  // Find a saved mapping for an imported matter
  const findMapping = (
    matterNumber: string | null,
    matterName: string | null
  ): ReportMatterMapping | undefined => {
    if (!mappingsQuery.data) return undefined;
    
    return mappingsQuery.data.find(
      (m) =>
        m.imported_matter_number === matterNumber &&
        m.imported_matter_name === matterName
    );
  };

  return {
    mappings: mappingsQuery.data || [],
    isLoading: mappingsQuery.isLoading,
    saveMapping,
    deleteMapping,
    findMapping,
  };
}
