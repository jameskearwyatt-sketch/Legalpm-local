import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export type TollingAnalysisType = 'tolling_vs_bible' | 'tolling_vs_termsheet' | 'termsheet_vs_bible';
export type TollingPerspective = 'offtaker' | 'generator';
export type TollingConfidenceLevel = 'high' | 'medium' | 'review_required';

export interface TollingAnalysis {
  id: string;
  user_id: string;
  analysis_type: TollingAnalysisType;
  perspective: TollingPerspective;
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
  tolling_type: string | null;
  facility_stage: string | null;
  complexity_score: number | null;
  key_risk_areas: string[];
  counterparty_type: string | null;
  offtaker_name: string | null;
  generator_name: string | null;
  offtaker_normalized: string | null;
  generator_normalized: string | null;
  // Applied-context trace: which learnings / precedents shaped this analysis
  applied_learning_ids: string[];
  applied_precedent_ids: string[];
  applied_gold_standard_ids: string[];
  // Telemetry
  model_used: string | null;
  analysis_duration_ms: number | null;
  input_token_count: number | null;
  output_token_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface TollingExtractedPosition {
  id: string;
  analysis_id: string;
  user_id: string;
  category: string;
  position_summary: string;
  source_text: string | null;
  confidence: TollingConfidenceLevel;
  bible_reference: string | null;
  comparison_position: string | null;
  variance_notes: string | null;
  previous_position: string | null;
  change_summary: string | null;
  change_type: string | null;
  market_benchmark: string | null;
  created_at: string;
}

export interface TollingPrecedent {
  id: string;
  user_id: string;
  source_analysis_id: string | null;
  category: string;
  position_summary: string;
  project_name: string;
  jurisdiction: string | null;
  perspective: TollingPerspective;
  banked_at: string;
  is_gold_standard: boolean;
  template_name: string | null;
  template_description: string | null;
  tolling_type: string | null;
  facility_stage: string | null;
  source_text: string | null;
  confidence: TollingConfidenceLevel;
  market_position: string | null;
  party_favorability: string | null;
  offtaker_name: string | null;
  generator_name: string | null;
  offtaker_normalized: string | null;
  generator_normalized: string | null;
}

export function useTollingAnalyses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading, error } = useQuery({
    queryKey: ['tolling-analyses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('tolling_analyses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as TollingAnalysis[];
    },
    enabled: !!user,
  });

  const createAnalysis = useMutation({
    mutationFn: async (analysis: Omit<TollingAnalysis, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_agreed' | 'agreed_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tolling_analyses')
        .insert({ ...analysis, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TollingAnalysis;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tolling-analyses'] }),
    onError: (error) => toast.error('Failed to create analysis: ' + error.message),
  });

  const updateAnalysis = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TollingAnalysis> & { id: string }) => {
      const { data, error } = await supabase
        .from('tolling_analyses')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TollingAnalysis;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tolling-analyses'] }),
    onError: (error) => toast.error('Failed to update analysis: ' + error.message),
  });

  const deleteAnalysis = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tolling_analyses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tolling-analyses'] });
      toast.success('Analysis deleted');
    },
    onError: (error) => toast.error('Failed to delete analysis: ' + error.message),
  });

  return { analyses: analyses || [], isLoading, error, createAnalysis, updateAnalysis, deleteAnalysis };
}

export function useTollingPositions(analysisId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: positions, isLoading, error } = useQuery({
    queryKey: ['tolling-positions', analysisId],
    queryFn: async () => {
      if (!analysisId) return [];
      const { data, error } = await supabase
        .from('tolling_extracted_positions')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('category');
      if (error) throw error;
      return data as unknown as TollingExtractedPosition[];
    },
    enabled: !!analysisId,
  });

  const createPositions = useMutation({
    mutationFn: async (newPositions: Omit<TollingExtractedPosition, 'id' | 'created_at'>[]) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tolling_extracted_positions')
        .insert(newPositions.map(p => ({ ...p, user_id: user.id })) as any)
        .select();
      if (error) throw error;
      return data as unknown as TollingExtractedPosition[];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tolling-positions'] }),
  });

  return { positions: positions || [], isLoading, error, createPositions };
}

export function useTollingPrecedentBank() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: precedents, isLoading, error } = useQuery({
    queryKey: ['tolling-precedent-bank', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('tolling_precedent_bank')
        .select('*')
        .order('banked_at', { ascending: false });
      if (error) throw error;
      return data as unknown as TollingPrecedent[];
    },
    enabled: !!user,
  });

  const goldStandardPrecedents = precedents?.filter(p => p.is_gold_standard) || [];

  const bankPositions = useMutation({
    mutationFn: async (newPrecedents: Omit<TollingPrecedent, 'id' | 'banked_at'>[]) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tolling_precedent_bank')
        .insert(newPrecedents.map(p => ({
          ...p,
          user_id: user.id,
          is_gold_standard: p.is_gold_standard || false,
          template_name: p.template_name || null,
          template_description: p.template_description || null,
        })) as any)
        .select();
      if (error) throw error;
      return data as unknown as TollingPrecedent[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tolling-precedent-bank'] });
      toast.success('Positions banked to tolling precedent library');
    },
    onError: (error) => toast.error('Failed to bank positions: ' + error.message),
  });

  const deletePrecedent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tolling_precedent_bank').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tolling-precedent-bank'] });
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
  }, [goldStandardPrecedents]);

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
  };
}
