import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export type CarbonAnalysisType = 'carbon_vs_bible' | 'termsheet_vs_bible';
export type CarbonPerspective = 'buyer' | 'seller';
export type CarbonConfidenceLevel = 'high' | 'medium' | 'review_required';

export interface CarbonAnalysis {
  id: string;
  user_id: string;
  analysis_type: CarbonAnalysisType;
  perspective: CarbonPerspective;
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
  carbon_type: string | null;
  project_stage: string | null;
  complexity_score: number | null;
  key_risk_areas: string[];
  counterparty_type: string | null;
  buyer_name: string | null;
  seller_name: string | null;
  buyer_normalized: string | null;
  seller_normalized: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarbonExtractedPosition {
  id: string;
  analysis_id: string;
  user_id: string;
  category: string;
  position_summary: string;
  source_text: string | null;
  confidence: CarbonConfidenceLevel;
  bible_reference: string | null;
  comparison_position: string | null;
  variance_notes: string | null;
  previous_position: string | null;
  change_summary: string | null;
  change_type: string | null;
  market_benchmark: string | null;
  created_at: string;
}

export interface CarbonPrecedent {
  id: string;
  user_id: string;
  source_analysis_id: string | null;
  category: string;
  position_summary: string;
  project_name: string;
  jurisdiction: string | null;
  perspective: CarbonPerspective;
  banked_at: string;
  is_gold_standard: boolean;
  template_name: string | null;
  template_description: string | null;
  carbon_type: string | null;
  project_stage: string | null;
  source_text: string | null;
  confidence: CarbonConfidenceLevel;
  market_position: string | null;
  party_favorability: string | null;
  buyer_name: string | null;
  seller_name: string | null;
  buyer_normalized: string | null;
  seller_normalized: string | null;
}

export function useCarbonAnalyses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading, error } = useQuery({
    queryKey: ['carbon-analyses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('carbon_analyses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CarbonAnalysis[];
    },
    enabled: !!user,
  });

  const createAnalysis = useMutation({
    mutationFn: async (analysis: Omit<CarbonAnalysis, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_agreed' | 'agreed_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('carbon_analyses')
        .insert({ ...analysis, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CarbonAnalysis;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['carbon-analyses'] }),
    onError: (error) => toast.error('Failed to create analysis: ' + error.message),
  });

  const updateAnalysis = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CarbonAnalysis> & { id: string }) => {
      const { data, error } = await supabase
        .from('carbon_analyses')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CarbonAnalysis;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['carbon-analyses'] }),
    onError: (error) => toast.error('Failed to update analysis: ' + error.message),
  });

  const deleteAnalysis = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('carbon_analyses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carbon-analyses'] });
      toast.success('Analysis deleted');
    },
    onError: (error) => toast.error('Failed to delete analysis: ' + error.message),
  });

  return { analyses: analyses || [], isLoading, error, createAnalysis, updateAnalysis, deleteAnalysis };
}

export function useCarbonPositions(analysisId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: positions, isLoading, error } = useQuery({
    queryKey: ['carbon-positions', analysisId],
    queryFn: async () => {
      if (!analysisId) return [];
      const { data, error } = await supabase
        .from('carbon_extracted_positions')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('category');
      if (error) throw error;
      return data as unknown as CarbonExtractedPosition[];
    },
    enabled: !!analysisId,
  });

  const createPositions = useMutation({
    mutationFn: async (newPositions: Omit<CarbonExtractedPosition, 'id' | 'created_at'>[]) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('carbon_extracted_positions')
        .insert(newPositions.map(p => ({ ...p, user_id: user.id })) as any)
        .select();
      if (error) throw error;
      return data as unknown as CarbonExtractedPosition[];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['carbon-positions'] }),
  });

  return { positions: positions || [], isLoading, error, createPositions };
}

export function useCarbonPrecedentBank() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: precedents, isLoading, error } = useQuery({
    queryKey: ['carbon-precedent-bank', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('carbon_precedent_bank')
        .select('*')
        .order('banked_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CarbonPrecedent[];
    },
    enabled: !!user,
  });

  const goldStandardPrecedents = precedents?.filter(p => p.is_gold_standard) || [];

  const bankPositions = useMutation({
    mutationFn: async (newPrecedents: Omit<CarbonPrecedent, 'id' | 'banked_at'>[]) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('carbon_precedent_bank')
        .insert(newPrecedents.map(p => ({
          ...p,
          user_id: user.id,
          is_gold_standard: p.is_gold_standard || false,
          template_name: p.template_name || null,
          template_description: p.template_description || null,
        })) as any)
        .select();
      if (error) throw error;
      return data as unknown as CarbonPrecedent[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carbon-precedent-bank'] });
      toast.success('Positions banked to carbon credit precedent library');
    },
    onError: (error) => toast.error('Failed to bank positions: ' + error.message),
  });

  const deletePrecedent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('carbon_precedent_bank').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carbon-precedent-bank'] });
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
