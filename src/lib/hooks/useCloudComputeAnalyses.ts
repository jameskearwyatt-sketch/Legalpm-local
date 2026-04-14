import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { embedAndStore, embedText, matchPrecedents } from '@/lib/analyst/semanticRetrieval';

export type CloudComputeAnalysisType = 'agreement_vs_bible' | 'termsheet_vs_bible';
export type CloudComputePerspective = 'tenant' | 'provider';
export type CloudComputeConfidenceLevel = 'high' | 'medium' | 'review_required';

export interface CloudComputeAnalysis {
  id: string;
  user_id: string;
  analysis_type: CloudComputeAnalysisType;
  perspective: CloudComputePerspective;
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
  service_type: string | null;
  deployment_model: string | null;
  complexity_score: number | null;
  key_risk_areas: string[];
  counterparty_type: string | null;
  tenant_name: string | null;
  provider_name: string | null;
  tenant_normalized: string | null;
  provider_normalized: string | null;
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

export interface CloudComputeExtractedPosition {
  id: string;
  analysis_id: string;
  user_id: string;
  category: string;
  position_summary: string;
  source_text: string | null;
  confidence: CloudComputeConfidenceLevel;
  bible_reference: string | null;
  comparison_position: string | null;
  variance_notes: string | null;
  previous_position: string | null;
  change_summary: string | null;
  change_type: string | null;
  market_benchmark: string | null;
  created_at: string;
}

export interface CloudComputePrecedent {
  id: string;
  user_id: string;
  source_analysis_id: string | null;
  category: string;
  position_summary: string;
  project_name: string;
  jurisdiction: string | null;
  perspective: CloudComputePerspective;
  banked_at: string;
  is_gold_standard: boolean;
  template_name: string | null;
  template_description: string | null;
  service_type: string | null;
  deployment_model: string | null;
  source_text: string | null;
  confidence: CloudComputeConfidenceLevel;
  market_position: string | null;
  party_favorability: string | null;
  tenant_name: string | null;
  provider_name: string | null;
  tenant_normalized: string | null;
  provider_normalized: string | null;
}

export function useCloudComputeAnalyses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading, error } = useQuery({
    queryKey: ['cloud-compute-analyses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('cloud_compute_analyses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CloudComputeAnalysis[];
    },
    enabled: !!user,
  });

  const createAnalysis = useMutation({
    mutationFn: async (analysis: Omit<CloudComputeAnalysis, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_agreed' | 'agreed_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('cloud_compute_analyses')
        .insert({ ...analysis, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CloudComputeAnalysis;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cloud-compute-analyses'] }),
    onError: (error) => toast.error('Failed to create analysis: ' + error.message),
  });

  const updateAnalysis = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CloudComputeAnalysis> & { id: string }) => {
      const { data, error } = await supabase
        .from('cloud_compute_analyses')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CloudComputeAnalysis;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cloud-compute-analyses'] }),
    onError: (error) => toast.error('Failed to update analysis: ' + error.message),
  });

  const deleteAnalysis = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cloud_compute_analyses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloud-compute-analyses'] });
      toast.success('Analysis deleted');
    },
    onError: (error) => toast.error('Failed to delete analysis: ' + error.message),
  });

  return { analyses: analyses || [], isLoading, error, createAnalysis, updateAnalysis, deleteAnalysis };
}

export function useCloudComputePositions(analysisId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: positions, isLoading, error } = useQuery({
    queryKey: ['cloud-compute-positions', analysisId],
    queryFn: async () => {
      if (!analysisId) return [];
      const { data, error } = await supabase
        .from('cloud_compute_extracted_positions')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('category');
      if (error) throw error;
      return data as unknown as CloudComputeExtractedPosition[];
    },
    enabled: !!analysisId,
  });

  const createPositions = useMutation({
    mutationFn: async (newPositions: Omit<CloudComputeExtractedPosition, 'id' | 'created_at'>[]) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('cloud_compute_extracted_positions')
        .insert(newPositions.map(p => ({ ...p, user_id: user.id })) as any)
        .select();
      if (error) throw error;
      return data as unknown as CloudComputeExtractedPosition[];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cloud-compute-positions'] }),
  });

  return { positions: positions || [], isLoading, error, createPositions };
}

export function useCloudComputePrecedentBank() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: precedents, isLoading, error } = useQuery({
    queryKey: ['cloud-compute-precedent-bank', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('cloud_compute_precedent_bank')
        .select('*')
        .order('banked_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CloudComputePrecedent[];
    },
    enabled: !!user,
  });

  const goldStandardPrecedents = precedents?.filter(p => p.is_gold_standard) || [];

  const bankPositions = useMutation({
    mutationFn: async (newPrecedents: Omit<CloudComputePrecedent, 'id' | 'banked_at'>[]) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('cloud_compute_precedent_bank')
        .insert(newPrecedents.map(p => ({
          ...p,
          user_id: user.id,
          is_gold_standard: p.is_gold_standard || false,
          template_name: p.template_name || null,
          template_description: p.template_description || null,
        })) as any)
        .select();
      if (error) throw error;
      const rows = data as unknown as CloudComputePrecedent[];
      for (const row of rows) {
        const embedSource = [
          row.category,
          row.position_summary,
          row.project_name,
          row.template_name ?? '',
          row.template_description ?? '',
          row.market_position ?? '',
        ].filter(Boolean).join('\n');
        void embedAndStore('cloud_compute', 'precedent', row.id, embedSource);
      }
      return rows;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloud-compute-precedent-bank'] });
      toast.success('Positions banked to cloud compute precedent library');
    },
    onError: (error) => toast.error('Failed to bank positions: ' + error.message),
  });

  const deletePrecedent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cloud_compute_precedent_bank').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloud-compute-precedent-bank'] });
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

  const getRelevantPrecedents = async (
    queryText: string,
    k: number = 10,
    onlyGoldStandard: boolean = false,
  ): Promise<{ precedents: CloudComputePrecedent[]; usedSemanticRetrieval: boolean }> => {
    const pool = onlyGoldStandard ? goldStandardPrecedents : (precedents || []);
    const embedding = await embedText(queryText);
    const matched = await matchPrecedents<{ id: string }>('cloud_compute', embedding, k, 0.3, onlyGoldStandard);
    if (matched && matched.length > 0) {
      const byId = new Map(pool.map(p => [p.id, p]));
      const hydrated = matched.map(m => byId.get(m.id)).filter((p): p is CloudComputePrecedent => !!p);
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
