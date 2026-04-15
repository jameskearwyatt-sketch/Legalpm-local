import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { embedAndStore, embedText, matchLearnings } from '@/lib/analyst/semanticRetrieval';
 
 export interface PPALearning {
   id: string;
   user_id: string;
   category: string;
   original_position: string;
   user_feedback: string;
   corrected_position: string | null;
   source_analysis_id: string | null;
   source_position_id: string | null;
   project_context: string | null;
   jurisdiction: string | null;
   ppa_type: string | null;
   is_active: boolean;
   created_at: string;
   updated_at: string;
 }
 
 export function usePPALearnings() {
   const { user } = useAuth();
   const queryClient = useQueryClient();
 
   const { data: learnings, isLoading, error } = useQuery({
     queryKey: ['ppa-learnings', user?.id],
     queryFn: async () => {
       if (!user) return [];
       const { data, error } = await supabase
         .from('ppa_ai_learnings')
         .select('*')
         .order('created_at', { ascending: false });
       
       if (error) throw error;
       return data as PPALearning[];
     },
     enabled: !!user,
   });
 
   const activeLearnings = learnings?.filter(l => l.is_active) || [];
 
  const createLearning = useMutation({
    mutationFn: async (learning: Omit<PPALearning, 'id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('ppa_ai_learnings')
        .insert({ ...learning, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      // Fire-and-forget embedding write so similarity search picks this up
      // on future analyses. Does not block the mutation.
      const embedSource = [learning.category, learning.original_position, learning.corrected_position ?? '', learning.user_feedback ?? '']
        .filter(Boolean).join('\n');
      void embedAndStore('ppa', 'learning', data.id, embedSource);
      return data as PPALearning;
    },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['ppa-learnings'] });
       toast.success('Learning saved - AI will remember this correction');
     },
     onError: (error) => {
       toast.error('Failed to save learning: ' + error.message);
     },
   });
 
   const updateLearning = useMutation({
     mutationFn: async ({ id, ...updates }: Partial<PPALearning> & { id: string }) => {
       const { data, error } = await supabase
         .from('ppa_ai_learnings')
         .update(updates)
         .eq('id', id)
         .select()
         .single();
       
       if (error) throw error;
       return data as PPALearning;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['ppa-learnings'] });
     },
   });
 
   const deleteLearning = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('ppa_ai_learnings')
         .delete()
         .eq('id', id);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['ppa-learnings'] });
       toast.success('Learning removed');
     },
   });
 
   const toggleActive = useMutation({
     mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
       const { data, error } = await supabase
         .from('ppa_ai_learnings')
         .update({ is_active })
         .eq('id', id)
         .select()
         .single();
       
       if (error) throw error;
       return data as PPALearning;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ['ppa-learnings'] });
       toast.success(data.is_active ? 'Learning reactivated' : 'Learning deactivated');
     },
   });
 
   // Get learnings for a specific category (for use in analysis)
   const getLearningsForCategory = (category: string): PPALearning[] => {
     return activeLearnings.filter(l =>
       l.category.toLowerCase() === category.toLowerCase()
     );
   };

  /**
   * Semantic top-K retrieval: embed the query (e.g. the contract being
   * analysed) and ask the DB for the most relevant active learnings. Falls
   * back to all active learnings when semantic retrieval is unavailable
   * (no OPENAI_API_KEY configured, RPC failure, etc.) so the feature
   * degrades gracefully.
   */
  const getRelevantLearnings = async (
    queryText: string,
    k: number = 10,
  ): Promise<{ learnings: PPALearning[]; usedSemanticRetrieval: boolean }> => {
    const embedding = await embedText(queryText);
    const matched = await matchLearnings<{ id: string }>('ppa', embedding, k);
    if (matched && matched.length > 0) {
      const byId = new Map(activeLearnings.map(l => [l.id, l]));
      const hydrated = matched.map(m => byId.get(m.id)).filter((l): l is PPALearning => !!l);
      if (hydrated.length > 0) {
        return { learnings: hydrated, usedSemanticRetrieval: true };
      }
    }
    return { learnings: activeLearnings, usedSemanticRetrieval: false };
  };
 
   // Format learnings for inclusion in AI prompts. Optionally accepts an
   // override list (e.g. a semantically-retrieved top-K subset).
   const formatLearningsForPrompt = (override?: PPALearning[]): string => {
     const source = override ?? activeLearnings;
     if (source.length === 0) return '';

     const byCategory: Record<string, PPALearning[]> = {};
     for (const l of source) {
       if (!byCategory[l.category]) byCategory[l.category] = [];
       byCategory[l.category].push(l);
     }
     
     let prompt = '\n\n## 🎓 USER CORRECTIONS & LEARNINGS (CRITICAL)\n\n';
     prompt += 'The user has provided the following corrections to previous analyses. You MUST apply these learnings:\n\n';
     
     for (const [category, categoryLearnings] of Object.entries(byCategory)) {
       prompt += `### ${category}\n`;
       for (const l of categoryLearnings) {
         prompt += `⚠️ CORRECTION: "${l.user_feedback}"\n`;
         if (l.corrected_position) {
           prompt += `   CORRECT APPROACH: ${l.corrected_position}\n`;
         }
         if (l.project_context) {
           prompt += `   Context: From ${l.project_context}\n`;
         }
         prompt += '\n';
       }
     }
     
     return prompt;
   };
 
   return {
     learnings: learnings || [],
     activeLearnings,
     isLoading,
     error,
     createLearning,
     updateLearning,
     deleteLearning,
    toggleActive,
    getLearningsForCategory,
    formatLearningsForPrompt,
    getRelevantLearnings,
  };
 }