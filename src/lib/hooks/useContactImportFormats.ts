import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export type ContactFieldType = 
  | 'full_name' 
  | 'first_name' 
  | 'last_name' 
  | 'email' 
  | 'company' 
  | 'job_title' 
  | 'country' 
  | 'city' 
  | 'gender' 
  | 'linkedin_url' 
  | 'relationship_owner' 
  | 'sectors'
  | 'ignore';

export interface ContactColumnMappings {
  full_name?: number;
  first_name?: number;
  last_name?: number;
  email?: number;
  company?: number;
  job_title?: number;
  country?: number;
  city?: number;
  gender?: number;
  linkedin_url?: number;
  relationship_owner?: number;
  sectors?: number;
}

export interface ContactImportFormat {
  id: string;
  user_id: string;
  format_name: string;
  column_mappings: ContactColumnMappings;
  header_signature: string | null;
  sample_headers: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useContactImportFormats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all saved formats for this user
  const formatsQuery = useQuery({
    queryKey: ['contact-import-formats', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_import_formats')
        .select('*')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as ContactImportFormat[];
    },
    enabled: !!user,
  });

  const saveFormat = useMutation({
    mutationFn: async (input: {
      format_name: string;
      column_mappings: ContactColumnMappings;
      header_signature: string;
      sample_headers: string[];
    }) => {
      // Check if format with this signature already exists
      const { data: existing } = await supabase
        .from('contact_import_formats')
        .select('id')
        .eq('user_id', user!.id)
        .eq('header_signature', input.header_signature)
        .maybeSingle();

      const mappingsJson = input.column_mappings as unknown as Record<string, number>;
      const headersJson = input.sample_headers as unknown as string[];

      if (existing) {
        // Update existing format
        const { data, error } = await supabase
          .from('contact_import_formats')
          .update({
            format_name: input.format_name,
            column_mappings: mappingsJson,
            sample_headers: headersJson,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new format
        const { data, error } = await supabase
          .from('contact_import_formats')
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
      queryClient.invalidateQueries({ queryKey: ['contact-import-formats'] });
      toast.success('Contact format saved - will be auto-recognized next time');
    },
    onError: (error: Error) => {
      toast.error('Failed to save format', { description: error.message });
    },
  });

  const deleteFormat = useMutation({
    mutationFn: async (formatId: string) => {
      const { error } = await supabase
        .from('contact_import_formats')
        .delete()
        .eq('id', formatId)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-import-formats'] });
      toast.success('Format deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete format', { description: error.message });
    },
  });

  // Check if uploaded file matches any saved format
  const findMatchingFormat = (headers: string[]): ContactImportFormat | null => {
    if (!formatsQuery.data?.length) return null;
    const uploadedSignature = createHeaderSignature(headers);
    return formatsQuery.data.find(f => f.header_signature === uploadedSignature) || null;
  };

  // Create signature from headers
  const createHeaderSignature = (headers: string[]): string => {
    return headers.join('|').toLowerCase().trim();
  };

  return {
    formats: formatsQuery.data || [],
    isLoading: formatsQuery.isLoading,
    saveFormat,
    deleteFormat,
    findMatchingFormat,
    createHeaderSignature,
  };
}
