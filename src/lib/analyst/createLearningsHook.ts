import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { embedAndStore, embedText, matchLearnings } from '@/lib/analyst/semanticRetrieval';
import type { AnalystType } from '@/lib/analyst/semanticRetrieval';

/**
 * Base shape shared by the four simple analyst learning tables
 * (tolling_learnings / carbon_learnings / it_supply_learnings /
 * cloud_compute_learnings). PPA uses a richer schema and is not
 * covered by this factory.
 */
export interface BaseAnalystLearning {
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

interface CreateLearningsHookConfig {
  /** Supabase table (e.g. 'tolling_learnings'). */
  tableName: string;
  /** React Query key prefix (e.g. 'tolling-learnings'). */
  queryKey: string;
  /** Analyst type used by semantic retrieval helpers. */
  analystType: AnalystType;
}

export interface LearningsHookResult<T extends BaseAnalystLearning> {
  learnings: T[];
  activeLearnings: T[];
  isLoading: boolean;
  error: Error | null;
  createLearning: ReturnType<typeof useMutation<T, Error, Omit<T, 'id' | 'created_at' | 'updated_at'>>>;
  deleteLearning: ReturnType<typeof useMutation<void, Error, string>>;
  toggleActive: ReturnType<typeof useMutation<T, Error, { id: string; is_active: boolean }>>;
  formatLearningsForPrompt: (override?: T[]) => string;
  getRelevantLearnings: (
    queryText: string,
    k?: number,
  ) => Promise<{ learnings: T[]; usedSemanticRetrieval: boolean }>;
}

/**
 * Factory that returns a hook matching the shape of the original
 * useTollingLearnings / useCarbonLearnings / useITSupplyLearnings /
 * useCloudComputeLearnings hooks. Typed via a generic T so callers
 * can extend BaseAnalystLearning with analyst-specific fields.
 */
export function createLearningsHook<T extends BaseAnalystLearning = BaseAnalystLearning>(
  config: CreateLearningsHookConfig,
): () => LearningsHookResult<T> {
  const { tableName, queryKey, analystType } = config;

  return function useAnalystLearnings(): LearningsHookResult<T> {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: learnings, isLoading, error } = useQuery({
      queryKey: [queryKey, user?.id],
      queryFn: async () => {
        if (!user) return [];
        const { data, error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from(tableName as any)
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data as unknown as T[];
      },
      enabled: !!user,
    });

    const activeLearnings = learnings?.filter(l => l.is_active) || [];

    const createLearning = useMutation<T, Error, Omit<T, 'id' | 'created_at' | 'updated_at'>>({
      mutationFn: async (learning) => {
        if (!user) throw new Error('Not authenticated');
        const { data, error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from(tableName as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert({ ...learning, user_id: user.id } as any)
          .select()
          .single();
        if (error) throw error;
        const embedSource = [
          learning.category,
          learning.original_position,
          learning.corrected_position,
          learning.correction_reason ?? '',
        ].filter(Boolean).join('\n');
        void embedAndStore(analystType, 'learning', (data as { id: string }).id, embedSource);
        return data as unknown as T;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        toast.success('Learning saved');
      },
      onError: (err) => toast.error('Failed to save learning: ' + err.message),
    });

    const deleteLearning = useMutation<void, Error, string>({
      mutationFn: async (id) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from(tableName as any).delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        toast.success('Learning removed');
      },
    });

    const toggleActive = useMutation<T, Error, { id: string; is_active: boolean }>({
      mutationFn: async ({ id, is_active }) => {
        const { data, error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from(tableName as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ is_active } as any)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as T;
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        toast.success(data.is_active ? 'Learning reactivated' : 'Learning deactivated');
      },
    });

    const formatLearningsForPrompt = (override?: T[]): string => {
      const source = override ?? activeLearnings;
      if (source.length === 0) return '';
      const byCategory: Record<string, T[]> = {};
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
    ): Promise<{ learnings: T[]; usedSemanticRetrieval: boolean }> => {
      const embedding = await embedText(queryText);
      const matched = await matchLearnings<{ id: string }>(analystType, embedding, k);
      if (matched && matched.length > 0) {
        const byId = new Map(activeLearnings.map(l => [l.id, l]));
        const hydrated = matched.map(m => byId.get(m.id)).filter((l): l is T => !!l);
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
      error: (error as Error | null) ?? null,
      createLearning,
      deleteLearning,
      toggleActive,
      formatLearningsForPrompt,
      getRelevantLearnings,
    };
  };
}
