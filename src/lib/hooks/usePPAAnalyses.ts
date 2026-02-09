import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export type PPAAnalysisType = 'ppa_vs_bible' | 'ppa_vs_termsheet' | 'termsheet_vs_bible';
export type PPAPerspective = 'buyer' | 'seller';
export type PPAConfidenceLevel = 'high' | 'medium' | 'review_required';
export type PPAStructureType = 'vppa' | 'physical' | 'sleeved' | 'private_wire';

export const PPA_STRUCTURE_LABELS: Record<PPAStructureType, string> = {
  vppa: 'Virtual PPA (VPPA / CFD)',
  physical: 'Physical PPA',
  sleeved: 'Sleeved PPA',
  private_wire: 'Private Wire Physical PPA',
};

export interface PPAAnalysis {
  id: string;
  user_id: string;
  analysis_type: PPAAnalysisType;
  perspective: PPAPerspective;
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
  created_at: string;
  updated_at: string;
  // New learning fields
  ppa_type: PPAStructureType | null;
  complexity_score: number | null;
  key_risk_areas: string[];
  counterparty_type: string | null;
  // Party names for searching
  buyer_name: string | null;
  seller_name: string | null;
  // Normalized names for intelligent grouping
  buyer_normalized: string | null;
  seller_normalized: string | null;
}

export type ChangeType = 'unchanged' | 'modified' | 'added' | 'removed';

export interface PPAExtractedPosition {
  id: string;
  analysis_id: string;
  user_id: string;
  category: string;
  position_summary: string;
  source_text: string | null;
  confidence: PPAConfidenceLevel;
  bible_reference: string | null;
  comparison_position: string | null;
  variance_notes: string | null;
  previous_position: string | null;
  change_summary: string | null;
  change_type: ChangeType | null;
  created_at: string;
  // New field for "What's Market?" benchmark
  market_benchmark: string | null;
}

export interface PPAPrecedent {
  id: string;
  user_id: string;
  source_analysis_id: string | null;
  category: string;
  position_summary: string;
  project_name: string;
  jurisdiction: string | null;
  perspective: PPAPerspective;
  banked_at: string;
  is_gold_standard: boolean;
  template_name: string | null;
  template_description: string | null;
  // New learning fields
  ppa_type: PPAStructureType | null;
  source_text: string | null;
  confidence: PPAConfidenceLevel;
  market_position: string | null;
  party_favorability: string | null;
  // Party names for searching
  buyer_name: string | null;
  seller_name: string | null;
  // Normalized names for intelligent grouping
  buyer_normalized: string | null;
  seller_normalized: string | null;
}

export function usePPAAnalyses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading, error } = useQuery({
    queryKey: ['ppa-analyses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('ppa_analyses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PPAAnalysis[];
    },
    enabled: !!user,
  });

  const createAnalysis = useMutation({
    mutationFn: async (analysis: Omit<PPAAnalysis, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_agreed' | 'agreed_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('ppa_analyses')
        .insert({ ...analysis, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as PPAAnalysis;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppa-analyses'] });
    },
    onError: (error) => {
      toast.error('Failed to create analysis: ' + error.message);
    },
  });

  const updateAnalysis = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PPAAnalysis> & { id: string }) => {
      const { data, error } = await supabase
        .from('ppa_analyses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as PPAAnalysis;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppa-analyses'] });
    },
    onError: (error) => {
      toast.error('Failed to update analysis: ' + error.message);
    },
  });

  const deleteAnalysis = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ppa_analyses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppa-analyses'] });
      toast.success('Analysis deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete analysis: ' + error.message);
    },
  });

  return {
    analyses: analyses || [],
    isLoading,
    error,
    createAnalysis,
    updateAnalysis,
    deleteAnalysis,
  };
}

export function usePPAPositions(analysisId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: positions, isLoading, error } = useQuery({
    queryKey: ['ppa-positions', analysisId],
    queryFn: async () => {
      if (!analysisId) return [];
      const { data, error } = await supabase
        .from('ppa_extracted_positions')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('category');
      
      if (error) throw error;
      return data as PPAExtractedPosition[];
    },
    enabled: !!analysisId,
  });

  const createPositions = useMutation({
    mutationFn: async (newPositions: Omit<PPAExtractedPosition, 'id' | 'created_at'>[]) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('ppa_extracted_positions')
        .insert(newPositions.map(p => ({ ...p, user_id: user.id })))
        .select();
      
      if (error) throw error;
      return data as PPAExtractedPosition[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppa-positions'] });
    },
  });

  return {
    positions: positions || [],
    isLoading,
    error,
    createPositions,
  };
}

export function usePPAPrecedentBank() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: precedents, isLoading, error } = useQuery({
    queryKey: ['ppa-precedent-bank', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('ppa_precedent_bank')
        .select('*')
        .order('banked_at', { ascending: false });
      
      if (error) throw error;
      return data as PPAPrecedent[];
    },
    enabled: !!user,
  });

  const bankPositions = useMutation({
    mutationFn: async (newPrecedents: Omit<PPAPrecedent, 'id' | 'banked_at'>[]) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('ppa_precedent_bank')
        .insert(newPrecedents.map(p => ({ 
          ...p, 
          user_id: user.id,
          is_gold_standard: p.is_gold_standard || false,
          template_name: p.template_name || null,
          template_description: p.template_description || null,
        })))
        .select();
      
      if (error) throw error;
      return data as PPAPrecedent[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppa-precedent-bank'] });
      toast.success('Positions banked to precedent library');
    },
    onError: (error) => {
      toast.error('Failed to bank positions: ' + error.message);
    },
  });

  // Get gold standard precedents (for analysis comparison)
  const goldStandardPrecedents = precedents?.filter(p => p.is_gold_standard) || [];

  const deletePrecedent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ppa_precedent_bank')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppa-precedent-bank'] });
      toast.success('Precedent removed');
    },
  });

  // Get statistics by category
  const getCategoryStats = (category: string) => {
    const categoryPrecedents = precedents?.filter(p => p.category === category) || [];
    return {
      count: categoryPrecedents.length,
      positions: categoryPrecedents,
    };
  };

  // Count unique projects (deals) - this is the true precedent count
  const uniqueProjectCount = useMemo(() => {
    const regularPrecedents = precedents?.filter(p => !p.is_gold_standard) || [];
    const uniqueProjects = new Set(regularPrecedents.map(p => p.project_name));
    return uniqueProjects.size;
  }, [precedents]);

  // Count unique gold standard templates
  const uniqueTemplateCount = useMemo(() => {
    const uniqueTemplates = new Set(goldStandardPrecedents.map(p => p.template_name || p.project_name));
    return uniqueTemplates.size;
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
