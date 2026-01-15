import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface ColumnMappings {
  matter_number?: number;
  matter_name?: number;
  client_name?: number;
  wip?: number;
  accounts_receivable?: number;
  total_billed?: number;
  total_paid?: number;
}

export interface ReportFormat {
  id: string;
  user_id: string;
  format_name: string;
  column_mappings: ColumnMappings;
  header_signature: string | null;
  sample_headers: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useReportFormats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const formatQuery = useQuery({
    queryKey: ['report-format', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_report_formats')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as ReportFormat | null;
    },
    enabled: !!user,
  });

  const saveFormat = useMutation({
    mutationFn: async (input: {
      format_name: string;
      column_mappings: ColumnMappings;
      header_signature: string;
      sample_headers: string[];
    }) => {
      // Upsert - update if exists, insert if not
      const { data: existing } = await supabase
        .from('user_report_formats')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      // Cast to Json compatible type
      const mappingsJson = input.column_mappings as unknown as Record<string, number>;
      const headersJson = input.sample_headers as unknown as string[];

      if (existing) {
        const { data, error } = await supabase
          .from('user_report_formats')
          .update({
            format_name: input.format_name,
            column_mappings: mappingsJson,
            header_signature: input.header_signature,
            sample_headers: headersJson,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('user_report_formats')
          .insert([{
            user_id: user!.id,
            format_name: input.format_name,
            column_mappings: mappingsJson,
            header_signature: input.header_signature,
            sample_headers: headersJson,
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-format'] });
      toast.success('Report format saved');
    },
    onError: (error: Error) => {
      toast.error('Failed to save format', { description: error.message });
    },
  });

  const deleteFormat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('user_report_formats')
        .delete()
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-format'] });
      toast.success('Report format deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete format', { description: error.message });
    },
  });

  // Check if uploaded file matches saved format
  const checkFormatMatch = (headers: string[]): boolean => {
    if (!formatQuery.data?.header_signature) return false;
    const uploadedSignature = headers.join('|').toLowerCase().trim();
    return uploadedSignature === formatQuery.data.header_signature;
  };

  // Create signature from headers
  const createHeaderSignature = (headers: string[]): string => {
    return headers.join('|').toLowerCase().trim();
  };

  return {
    format: formatQuery.data,
    isLoading: formatQuery.isLoading,
    saveFormat,
    deleteFormat,
    checkFormatMatch,
    createHeaderSignature,
  };
}
