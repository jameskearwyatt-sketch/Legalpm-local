import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { embedAndStore, embedText, matchLearnings } from '@/lib/analyst/semanticRetrieval';

export interface ITSupplyLearning {
  id: string;
  user_id: string;
  analysis_id: string | null;
  category: string;
  original_position: string;
  corrected_position: string;
  correction_reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useITSupplyLearnings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: learnings, isLoading, error } = useQuery({
    queryKey: ['it-supply-learnings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('it_supply_learnings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as ITSupplyLearning[];
    },
    enabled: !!user,
  });

  const activeLearnings = learnings?.filter(l => l.is_active) || [];

  const createLearning = useMutation({
    mutationFn: async (learning: Omit<ITSupplyLearning, 'id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('it_supply_learnings')
        .insert({ ...learning, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      const embedSource = [learning.category, learning.original_position, learning.corrected_position, learning.correction_reason ?? '']
        .filter(Boolean).join('\n');
      void embedAndStore('it_supply', 'learning', (data as { id: string }).id, embedSource);
      return data as unknown as ITSupplyLearning;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['it-supply-learnings'] });
      toast.success('Learning saved');
    },
    onError: (error) => toast.error('Failed to save learning: ' + error.message),
  });

  const deleteLearning = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('it_supply_learnings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['it-supply-learnings'] });
      toast.success('Learning removed');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('it_supply_learnings')
        .update({ is_active } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ITSupplyLearning;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['it-supply-learnings'] });
      toast.success(data.is_active ? 'Learning reactivated' : 'Learning deactivated');
    },
  });

  const formatLearningsForPrompt = (override?: ITSupplyLearning[]): string => {
    const source = override ?? activeLearnings;
    if (source.length === 0) return '';
    const byCategory: Record<string, ITSupplyLearning[]> = {};
    for (const l of source) {
      if (!byCategory[l.category]) byCategory[l.category] = [];
      byCategory[l.category].push(l);
    }
    let prompt = '\n\n## 🎓 USER CORRECTIONS & LEARNINGS (CRITICAL)\n\n';
    prompt += 'The user has provided the following corrections to previous analyses. You MUST apply these learnings:\n\n';
    for (const [category, categoryLearnings] of Object.entries(byCategory)) {
      prompt += `### ${category}\n`;
      for (const l of categoryLearnings) {
        prompt += `⚠️ CORRECTION: Original: "${l.original_position}" → Corrected: "${l.corrected_position}"\n`;
        if (l.correction_reason) prompt += `   Reason: ${l.correction_reason}\n`;
        prompt += '\n';
      }
    }
    return prompt;
  };

  const getRelevantLearnings = async (
    queryText: string,
    k: number = 10,
  ): Promise<{ learnings: ITSupplyLearning[]; usedSemanticRetrieval: boolean }> => {
    const embedding = await embedText(queryText);
    const matched = await matchLearnings<{ id: string }>('it_supply', embedding, k);
    if (matched && matched.length > 0) {
      const byId = new Map(activeLearnings.map(l => [l.id, l]));
      const hydrated = matched.map(m => byId.get(m.id)).filter((l): l is ITSupplyLearning => !!l);
      if (hydrated.length > 0) {
        return { learnings: hydrated, usedSemanticRetrieval: true };
      }
    }
    return { learnings: activeLearnings, usedSemanticRetrieval: false };
  };

  return {
    learnings: learnings || [],
    activeLearnings,
    isLoading,
    error,
    createLearning,
    deleteLearning,
    toggleActive,
    formatLearningsForPrompt,
    getRelevantLearnings,
  };
}
