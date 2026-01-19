import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { RateCard, DEFAULT_RATE_CARD } from './usePricingProposals';
import { Json } from '@/integrations/supabase/types';

export interface UserSettings {
  id: string;
  user_id: string;
  default_currency: string;
  near_budget_threshold: number;
  poor_collection_threshold: number;
  wip_warning_threshold: number;
  use_billed_only_for_burn: boolean;
  default_rate_card: RateCard | null;
  created_at: string;
  updated_at: string;
}

function parseRateCard(value: Json | null): RateCard | null {
  if (!value) return null;
  try {
    if (typeof value === 'string') {
      return JSON.parse(value) as RateCard;
    }
    // Validate it has the expected structure
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as unknown as RateCard;
    }
    return null;
  } catch {
    return null;
  }
}

export function useUserSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user settings
  const settingsQuery = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        default_rate_card: parseRateCard(data.default_rate_card),
      } as UserSettings;
    },
    enabled: !!user,
  });

  // Update settings
  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<Pick<UserSettings, 'default_currency' | 'near_budget_threshold' | 'poor_collection_threshold' | 'wip_warning_threshold' | 'use_billed_only_for_burn' | 'default_rate_card'>>) => {
      const { error } = await supabase
        .from('user_settings')
        .update(updates as any)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings', user?.id] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update settings', description: error.message, variant: 'destructive' });
    },
  });

  // Save default rate card
  const saveDefaultRateCard = useMutation({
    mutationFn: async (rateCard: RateCard) => {
      const { error } = await supabase
        .from('user_settings')
        .update({ default_rate_card: rateCard as any })
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings', user?.id] });
      toast({ title: 'Default rates saved', description: 'These rates will be used for all new pricing proposals' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save default rates', description: error.message, variant: 'destructive' });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSettings,
    saveDefaultRateCard,
    // Convenience getters with fallbacks
    defaultCurrency: settingsQuery.data?.default_currency || 'GBP',
    defaultRateCard: settingsQuery.data?.default_rate_card || DEFAULT_RATE_CARD,
  };
}
