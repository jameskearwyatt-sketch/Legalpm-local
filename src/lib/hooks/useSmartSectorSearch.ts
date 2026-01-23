import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SmartSearchMatch {
  contactId: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface SmartSearchResult {
  matches: SmartSearchMatch[];
  queryUnderstanding: string;
  totalAnalyzed: number;
}

export interface SmartSearchState {
  isActive: boolean;
  query: string;
  matches: Map<string, SmartSearchMatch>;
  queryUnderstanding: string;
  isDeepSearchPending: boolean;
  deepSearchComplete: boolean;
}

export function useSmartSectorSearch() {
  const [searchState, setSearchState] = useState<SmartSearchState>({
    isActive: false,
    query: "",
    matches: new Map(),
    queryUnderstanding: "",
    isDeepSearchPending: false,
    deepSearchComplete: false,
  });

  const quickSearchMutation = useMutation({
    mutationFn: async (query: string): Promise<SmartSearchResult> => {
      const { data, error } = await supabase.functions.invoke('smart-sector-search', {
        body: { query, deepSearch: false }
      });

      if (error) throw error;
      return data as SmartSearchResult;
    },
    onSuccess: (data, query) => {
      const matchMap = new Map<string, SmartSearchMatch>();
      data.matches.forEach(m => matchMap.set(m.contactId, m));
      
      setSearchState({
        isActive: true,
        query,
        matches: matchMap,
        queryUnderstanding: data.queryUnderstanding,
        isDeepSearchPending: false,
        deepSearchComplete: false,
      });

      if (data.matches.length === 0) {
        toast.info(`No contacts found matching "${query}"`);
      } else {
        toast.success(`Found ${data.matches.length} contacts matching "${query}"`);
      }
    },
    onError: (error: Error) => {
      console.error("Smart search error:", error);
      const message = error.message?.includes("busy") || error.message?.includes("429")
        ? "AI service is busy. Please wait a moment and try again."
        : error.message || "Smart search failed";
      toast.error(message);
    }
  });

  const deepSearchMutation = useMutation({
    mutationFn: async (query: string): Promise<SmartSearchResult> => {
      const { data, error } = await supabase.functions.invoke('smart-sector-search', {
        body: { query, deepSearch: true }
      });

      if (error) throw error;
      return data as SmartSearchResult;
    },
    onSuccess: (data, query) => {
      const matchMap = new Map<string, SmartSearchMatch>();
      data.matches.forEach(m => matchMap.set(m.contactId, m));
      
      setSearchState(prev => ({
        ...prev,
        matches: matchMap,
        queryUnderstanding: data.queryUnderstanding,
        isDeepSearchPending: false,
        deepSearchComplete: true,
      }));

      toast.success(`Deep search complete: ${data.matches.length} contacts found`);
    },
    onError: (error: Error) => {
      console.error("Deep search error:", error);
      setSearchState(prev => ({ ...prev, isDeepSearchPending: false }));
      const message = error.message?.includes("busy") || error.message?.includes("429")
        ? "AI service is busy. Please wait a moment and try again."
        : error.message || "Deep search failed";
      toast.error(message);
    }
  });

  const executeQuickSearch = useCallback((query: string) => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    quickSearchMutation.mutate(query.trim());
  }, [quickSearchMutation]);

  const executeDeepSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    
    setSearchState(prev => ({ ...prev, isDeepSearchPending: true }));
    toast.info("Deep search started. This will take longer but provides more thorough results.");
    deepSearchMutation.mutate(query.trim());
  }, [deepSearchMutation]);

  const clearSearch = useCallback(() => {
    setSearchState({
      isActive: false,
      query: "",
      matches: new Map(),
      queryUnderstanding: "",
      isDeepSearchPending: false,
      deepSearchComplete: false,
    });
  }, []);

  const getMatchForContact = useCallback((contactId: string): SmartSearchMatch | undefined => {
    return searchState.matches.get(contactId);
  }, [searchState.matches]);

  const isContactMatched = useCallback((contactId: string): boolean => {
    return searchState.matches.has(contactId);
  }, [searchState.matches]);

  return {
    searchState,
    isSearching: quickSearchMutation.isPending,
    isDeepSearching: deepSearchMutation.isPending,
    executeQuickSearch,
    executeDeepSearch,
    clearSearch,
    getMatchForContact,
    isContactMatched,
  };
}
