import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface LcWorkItemQuote {
  id: string;
  user_id: string;
  proposal_id: string;
  lc_library_id: string;
  work_item_key: string;
  fee_amount: number;
  fee_lower: number;
  fee_upper: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertQuoteInput {
  proposal_id: string;
  lc_library_id: string;
  work_item_key: string;
  fee_amount: number;
  fee_lower: number;
  fee_upper: number;
}

export function useLcWorkItemQuotes(proposalId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all quotes for a proposal
  const quotesQuery = useQuery({
    queryKey: ['lc-work-item-quotes', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_work_item_quotes')
        .select('*')
        .eq('proposal_id', proposalId!);

      if (error) throw error;
      return data as LcWorkItemQuote[];
    },
    enabled: !!user && !!proposalId,
  });

  // Get quotes grouped by firm
  const quotesByFirm = (quotesQuery.data || []).reduce((acc, quote) => {
    if (!acc[quote.lc_library_id]) {
      acc[quote.lc_library_id] = {};
    }
    acc[quote.lc_library_id][quote.work_item_key] = quote;
    return acc;
  }, {} as Record<string, Record<string, LcWorkItemQuote>>);

  // Upsert a quote (insert or update)
  const upsertQuote = useMutation({
    mutationFn: async (input: UpsertQuoteInput) => {
      // Check if quote exists
      const { data: existing } = await supabase
        .from('lc_work_item_quotes')
        .select('id')
        .eq('proposal_id', input.proposal_id)
        .eq('lc_library_id', input.lc_library_id)
        .eq('work_item_key', input.work_item_key)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('lc_work_item_quotes')
          .update({
            fee_amount: input.fee_amount,
            fee_lower: input.fee_lower,
            fee_upper: input.fee_upper,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('lc_work_item_quotes')
          .insert({
            user_id: user!.id,
            proposal_id: input.proposal_id,
            lc_library_id: input.lc_library_id,
            work_item_key: input.work_item_key,
            fee_amount: input.fee_amount,
            fee_lower: input.fee_lower,
            fee_upper: input.fee_upper,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lc-work-item-quotes', proposalId] });
    },
  });

  // Upsert multiple quotes at once (for batch saving)
  const upsertQuotes = useMutation({
    mutationFn: async (inputs: UpsertQuoteInput[]) => {
      for (const input of inputs) {
        const { data: existing } = await supabase
          .from('lc_work_item_quotes')
          .select('id')
          .eq('proposal_id', input.proposal_id)
          .eq('lc_library_id', input.lc_library_id)
          .eq('work_item_key', input.work_item_key)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('lc_work_item_quotes')
            .update({
              fee_amount: input.fee_amount,
              fee_lower: input.fee_lower,
              fee_upper: input.fee_upper,
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('lc_work_item_quotes')
            .insert({
              user_id: user!.id,
              proposal_id: input.proposal_id,
              lc_library_id: input.lc_library_id,
              work_item_key: input.work_item_key,
              fee_amount: input.fee_amount,
              fee_lower: input.fee_lower,
              fee_upper: input.fee_upper,
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lc-work-item-quotes', proposalId] });
    },
  });

  // Delete quotes for a specific firm
  const deleteQuotesForFirm = useMutation({
    mutationFn: async (lcLibraryId: string) => {
      const { error } = await supabase
        .from('lc_work_item_quotes')
        .delete()
        .eq('proposal_id', proposalId!)
        .eq('lc_library_id', lcLibraryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lc-work-item-quotes', proposalId] });
    },
  });

  // Get quotes for a specific firm
  const getQuotesForFirm = (lcLibraryId: string): Record<string, LcWorkItemQuote> => {
    return quotesByFirm[lcLibraryId] || {};
  };

  // Check if a firm has all required quotes for a set of work items
  const firmHasAllQuotes = (lcLibraryId: string, workItemKeys: string[]): boolean => {
    const firmQuotes = quotesByFirm[lcLibraryId] || {};
    return workItemKeys.every(key => key in firmQuotes);
  };

  // Get the total estimate for a firm across all work items
  const getFirmTotal = (lcLibraryId: string, workItemKeys: string[]): { lower: number; upper: number; amount: number } => {
    const firmQuotes = quotesByFirm[lcLibraryId] || {};
    let lower = 0;
    let upper = 0;
    let amount = 0;

    workItemKeys.forEach(key => {
      const quote = firmQuotes[key];
      if (quote) {
        lower += quote.fee_lower;
        upper += quote.fee_upper;
        amount += quote.fee_amount;
      }
    });

    return { lower, upper, amount };
  };

  return {
    quotes: quotesQuery.data || [],
    quotesByFirm,
    isLoading: quotesQuery.isLoading,
    upsertQuote,
    upsertQuotes,
    deleteQuotesForFirm,
    getQuotesForFirm,
    firmHasAllQuotes,
    getFirmTotal,
  };
}
