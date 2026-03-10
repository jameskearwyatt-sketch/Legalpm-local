import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface AggregationDecision {
  id: string;
  user_id: string;
  matter_name: string;
  decision: 'aggregate' | 'separate';
  target_matter_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAggregationDecisions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ['aggregation-decisions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aggregation_decisions')
        .select('*')
        .eq('user_id', user!.id);

      if (error) throw error;
      return data as AggregationDecision[];
    },
    enabled: !!user,
  });

  const saveDecision = useMutation({
    mutationFn: async (input: {
      matter_name: string;
      decision: 'aggregate' | 'separate';
      target_matter_id: string | null;
    }) => {
      const { data, error } = await supabase
        .from('aggregation_decisions')
        .upsert(
          {
            user_id: user!.id,
            matter_name: input.matter_name,
            decision: input.decision,
            target_matter_id: input.target_matter_id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,matter_name' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aggregation-decisions'] });
    },
  });

  const findDecision = (matterName: string): AggregationDecision | undefined => {
    return decisions.find(d => d.matter_name === matterName);
  };

  return {
    decisions,
    isLoading,
    saveDecision,
    findDecision,
  };
}
