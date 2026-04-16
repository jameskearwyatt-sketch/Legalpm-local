/**
 * Generic factory for the analyst analyses/positions/precedent-bank hook trio.
 *
 * Collapses ~325 LOC × 4 analyst tools (Tolling, Carbon, IT Supply, Cloud Compute)
 * into a single configurable factory. PPA is deliberately out-of-scope because
 * its tables and flows (feedback edge function, extra learning columns, compare
 * drafts flow, etc.) diverge enough that sharing would hide real behaviour.
 *
 * Each analyst's `useXxxAnalyses.ts` becomes a thin call into this factory,
 * preserving its existing named exports so callers don't need to change.
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import {
  embedAndStore,
  embedText,
  matchPrecedents,
  type AnalystType,
} from '@/lib/analyst/semanticRetrieval';

export type ConfidenceLevel = 'high' | 'medium' | 'review_required';

/**
 * Fields every analyst analysis row shares. Domain-specific fields
 * (tolling_type, carbon_type, offtaker_name, etc.) are added by the
 * caller's type parameter.
 */
export interface BaseAnalystAnalysis {
  id: string;
  user_id: string;
  analysis_type: string;
  perspective: string;
  project_name: string;
  jurisdiction: string | null;
  document_file_name: string;
  document_file_url: string | null;
  comparison_file_name: string | null;
  comparison_file_url: string | null;
  is_agreed: boolean;
  agreed_at: string | null;
  notes: string | null;
  parent_analysis_id: string | null;
  version_number: number;
  is_comparison: boolean;
  complexity_score: number | null;
  key_risk_areas: string[];
  counterparty_type: string | null;
  applied_learning_ids: string[];
  applied_precedent_ids: string[];
  applied_gold_standard_ids: string[];
  model_used: string | null;
  analysis_duration_ms: number | null;
  input_token_count: number | null;
  output_token_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface BaseExtractedPosition {
  id: string;
  analysis_id: string;
  user_id: string;
  category: string;
  position_summary: string;
  source_text: string | null;
  confidence: ConfidenceLevel;
  bible_reference: string | null;
  comparison_position: string | null;
  variance_notes: string | null;
  previous_position: string | null;
  change_summary: string | null;
  change_type: string | null;
  market_benchmark: string | null;
  created_at: string;
}

export interface BaseAnalystPrecedent {
  id: string;
  user_id: string;
  source_analysis_id: string | null;
  category: string;
  position_summary: string;
  project_name: string;
  jurisdiction: string | null;
  perspective: string;
  banked_at: string;
  is_gold_standard: boolean;
  template_name: string | null;
  template_description: string | null;
  source_text: string | null;
  confidence: ConfidenceLevel;
  market_position: string | null;
  party_favorability: string | null;
}

export interface AnalysesHookConfig {
  analystType: AnalystType;
  analysesTable: string;
  positionsTable: string;
  precedentBankTable: string;
  analysesQueryKey: string;
  positionsQueryKey: string;
  precedentBankQueryKey: string;
  /** PL/pgSQL function name for the transactional analysis+positions insert */
  createWithPositionsRpc: string;
  /** Toast copy shown after successful precedent bank insertion */
  bankSuccessMessage: string;
}

export function createAnalysesHooks<
  TAnalysis extends BaseAnalystAnalysis = BaseAnalystAnalysis,
  TPosition extends BaseExtractedPosition = BaseExtractedPosition,
  TPrecedent extends BaseAnalystPrecedent = BaseAnalystPrecedent,
>(config: AnalysesHookConfig) {
  const {
    analystType,
    analysesTable,
    positionsTable,
    precedentBankTable,
    analysesQueryKey,
    positionsQueryKey,
    precedentBankQueryKey,
    createWithPositionsRpc,
    bankSuccessMessage,
  } = config;

  function useAnalyses() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: analyses, isLoading, error } = useQuery({
      queryKey: [analysesQueryKey, user?.id],
      queryFn: async () => {
        if (!user) return [];
        const { data, error } = await supabase
          .from(analysesTable as never)
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data as unknown as TAnalysis[];
      },
      enabled: !!user,
    });

    const createAnalysis = useMutation({
      mutationFn: async (
        analysis: Omit<TAnalysis, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_agreed' | 'agreed_at'>,
      ) => {
        if (!user) throw new Error('Not authenticated');
        const { data, error } = await supabase
          .from(analysesTable as never)
          .insert({ ...analysis, user_id: user.id } as never)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as TAnalysis;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [analysesQueryKey] }),
      onError: (error) => toast.error('Failed to create analysis: ' + error.message),
    });

    const updateAnalysis = useMutation({
      mutationFn: async ({ id, ...updates }: Partial<TAnalysis> & { id: string }) => {
        const { data, error } = await supabase
          .from(analysesTable as never)
          .update(updates as never)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as TAnalysis;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [analysesQueryKey] }),
      onError: (error) => toast.error('Failed to update analysis: ' + error.message),
    });

    const deleteAnalysis = useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from(analysesTable as never).delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [analysesQueryKey] });
        toast.success('Analysis deleted');
      },
      onError: (error) => toast.error('Failed to delete analysis: ' + error.message),
    });

    const createAnalysisWithPositions = useMutation({
      mutationFn: async (args: {
        analysis: Omit<TAnalysis, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_agreed' | 'agreed_at'>;
        positions: Omit<TPosition, 'id' | 'analysis_id' | 'user_id' | 'created_at'>[];
      }) => {
        if (!user) throw new Error('Not authenticated');
        const { data, error } = await (supabase.rpc as any)(createWithPositionsRpc, {
          analysis_data: args.analysis,
          positions_data: args.positions ?? [],
        });
        if (error) throw error;
        return data as unknown as TAnalysis;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [analysesQueryKey] });
        queryClient.invalidateQueries({ queryKey: [positionsQueryKey] });
      },
      onError: (error) => toast.error('Failed to save analysis: ' + error.message),
    });

    return {
      analyses: analyses || [],
      isLoading,
      error,
      createAnalysis,
      createAnalysisWithPositions,
      updateAnalysis,
      deleteAnalysis,
    };
  }

  function usePositions(analysisId: string | null) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: positions, isLoading, error } = useQuery({
      queryKey: [positionsQueryKey, analysisId],
      queryFn: async () => {
        if (!analysisId) return [];
        const { data, error } = await supabase
          .from(positionsTable as never)
          .select('*')
          .eq('analysis_id', analysisId)
          .order('category');
        if (error) throw error;
        return data as unknown as TPosition[];
      },
      enabled: !!analysisId,
    });

    const createPositions = useMutation({
      mutationFn: async (newPositions: Omit<TPosition, 'id' | 'created_at'>[]) => {
        if (!user) throw new Error('Not authenticated');
        const { data, error } = await supabase
          .from(positionsTable as never)
          .insert(newPositions.map(p => ({ ...p, user_id: user.id })) as never)
          .select();
        if (error) throw error;
        return data as unknown as TPosition[];
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [positionsQueryKey] }),
    });

    return { positions: positions || [], isLoading, error, createPositions };
  }

  function usePrecedentBank() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: precedents, isLoading, error } = useQuery({
      queryKey: [precedentBankQueryKey, user?.id],
      queryFn: async () => {
        if (!user) return [];
        const { data, error } = await supabase
          .from(precedentBankTable as never)
          .select('*')
          .order('banked_at', { ascending: false });
        if (error) throw error;
        return data as unknown as TPrecedent[];
      },
      enabled: !!user,
    });

    const goldStandardPrecedents = precedents?.filter(p => p.is_gold_standard) || [];

    const bankPositions = useMutation({
      mutationFn: async (newPrecedents: Omit<TPrecedent, 'id' | 'banked_at'>[]) => {
        if (!user) throw new Error('Not authenticated');
        const { data, error } = await supabase
          .from(precedentBankTable as never)
          .insert(newPrecedents.map(p => ({
            ...p,
            user_id: user.id,
            is_gold_standard: p.is_gold_standard || false,
            template_name: p.template_name || null,
            template_description: p.template_description || null,
          })) as never)
          .select();
        if (error) throw error;
        const rows = data as unknown as TPrecedent[];
        for (const row of rows) {
          const embedSource = [
            row.category,
            row.position_summary,
            row.project_name,
            row.template_name ?? '',
            row.template_description ?? '',
            row.market_position ?? '',
          ].filter(Boolean).join('\n');
          void embedAndStore(analystType, 'precedent', row.id, embedSource);
        }
        return rows;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [precedentBankQueryKey] });
        toast.success(bankSuccessMessage);
      },
      onError: (error) => toast.error('Failed to bank positions: ' + error.message),
    });

    const deletePrecedent = useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from(precedentBankTable as never).delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [precedentBankQueryKey] });
        toast.success('Precedent removed');
      },
    });

    const getCategoryStats = (category: string) => {
      const categoryPrecedents = precedents?.filter(p => p.category === category) || [];
      return { count: categoryPrecedents.length, positions: categoryPrecedents };
    };

    const uniqueProjectCount = useMemo(() => {
      const regular = precedents?.filter(p => !p.is_gold_standard) || [];
      return new Set(regular.map(p => p.project_name)).size;
    }, [precedents]);

    const uniqueTemplateCount = useMemo(() => {
      return new Set(goldStandardPrecedents.map(p => p.template_name || p.project_name)).size;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [precedents]);

    const getRelevantPrecedents = async (
      queryText: string,
      k: number = 10,
      onlyGoldStandard: boolean = false,
    ): Promise<{ precedents: TPrecedent[]; usedSemanticRetrieval: boolean }> => {
      const pool = onlyGoldStandard ? goldStandardPrecedents : (precedents || []);
      const embedding = await embedText(queryText);
      const matched = await matchPrecedents<{ id: string }>(analystType, embedding, k, 0.3, onlyGoldStandard);
      if (matched && matched.length > 0) {
        const byId = new Map(pool.map(p => [p.id, p]));
        const hydrated = matched.map(m => byId.get(m.id)).filter((p): p is TPrecedent => !!p);
        if (hydrated.length > 0) {
          return { precedents: hydrated, usedSemanticRetrieval: true };
        }
      }
      return { precedents: pool, usedSemanticRetrieval: false };
    };

    return {
      precedents: precedents || [],
      goldStandardPrecedents,
      isLoading,
      error,
      bankPositions,
      deletePrecedent,
      getCategoryStats,
      uniqueProjectCount,
      uniqueTemplateCount,
      getRelevantPrecedents,
    };
  }

  return { useAnalyses, usePositions, usePrecedentBank };
}
