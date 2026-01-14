import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

export interface LocalCounselRateCard {
  partner?: { rate: number };
  seniorAssociate?: { rate: number };
  associate?: { rate: number };
  trainee?: { rate: number };
}

export interface LocalCounselLibraryEntry {
  id: string;
  user_id: string;
  firm_name: string;
  country: string;
  currency: string;
  rate_card: LocalCounselRateCard | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLocalCounselLibraryInput {
  firm_name: string;
  country: string;
  currency?: string;
  rate_card?: LocalCounselRateCard | null;
}

export interface UpdateLocalCounselLibraryInput {
  id: string;
  firm_name?: string;
  country?: string;
  currency?: string;
  rate_card?: LocalCounselRateCard | null;
}

export function useLocalCounselLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all local counsel library entries
  const libraryQuery = useQuery({
    queryKey: ['local-counsel-library'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('local_counsel_library')
        .select('*')
        .order('country', { ascending: true })
        .order('firm_name', { ascending: true });

      if (error) throw error;
      return (data || []).map(entry => ({
        ...entry,
        rate_card: parseRateCard(entry.rate_card),
      })) as LocalCounselLibraryEntry[];
    },
  });

  // Create new local counsel
  const createEntry = useMutation({
    mutationFn: async (input: CreateLocalCounselLibraryInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('local_counsel_library')
        .insert({
          user_id: userData.user.id,
          firm_name: input.firm_name,
          country: input.country,
          currency: input.currency || 'GBP',
          rate_card: input.rate_card as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-counsel-library'] });
      toast({ title: 'Local counsel added to library' });
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast({ title: 'This firm already exists for this country', variant: 'destructive' });
      } else {
        toast({ title: 'Failed to add local counsel', variant: 'destructive' });
      }
    },
  });

  // Update local counsel
  const updateEntry = useMutation({
    mutationFn: async (input: UpdateLocalCounselLibraryInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('local_counsel_library')
        .update({
          ...updates,
          rate_card: updates.rate_card as unknown as Json,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-counsel-library'] });
      toast({ title: 'Local counsel updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update local counsel', variant: 'destructive' });
    },
  });

  // Delete local counsel
  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('local_counsel_library')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-counsel-library'] });
      toast({ title: 'Local counsel removed from library' });
    },
    onError: () => {
      toast({ title: 'Failed to remove local counsel', variant: 'destructive' });
    },
  });

  // Get entries grouped by country
  const entriesByCountry = libraryQuery.data?.reduce((acc, entry) => {
    if (!acc[entry.country]) {
      acc[entry.country] = [];
    }
    acc[entry.country].push(entry);
    return acc;
  }, {} as Record<string, LocalCounselLibraryEntry[]>) || {};

  // Get unique countries
  const countries = [...new Set(libraryQuery.data?.map(e => e.country) || [])].sort();

  return {
    library: libraryQuery.data || [],
    entriesByCountry,
    countries,
    isLoading: libraryQuery.isLoading,
    error: libraryQuery.error,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}

function parseRateCard(value: Json | null): LocalCounselRateCard | null {
  if (!value) return null;
  try {
    if (typeof value === 'string') {
      return JSON.parse(value) as LocalCounselRateCard;
    }
    return value as LocalCounselRateCard;
  } catch {
    return null;
  }
}
