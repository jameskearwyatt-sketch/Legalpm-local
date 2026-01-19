import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

// AFA Types
export type AFAType = 
  | 'fee_cap'
  | 'blended_rate'
  | 'fixed_fee_whole'
  | 'fixed_fee_phase'
  | 'fee_collar'
  | 'milestone'
  | 'monthly_retainer'
  | 'discounted_rates'
  | 'success_fee';

export const AFA_TYPE_LABELS: Record<AFAType, string> = {
  fee_cap: 'Fee Cap',
  blended_rate: 'Blended Hourly Rate',
  fixed_fee_whole: 'Fixed Fee (Whole Matter)',
  fixed_fee_phase: 'Fixed Fee by Phase',
  fee_collar: 'Fee Collar',
  milestone: 'Milestone-Based Fees',
  monthly_retainer: 'Monthly Retainer',
  discounted_rates: 'Discounted Rates',
  success_fee: 'Success Fee / Uplift',
};

export const AFA_TYPE_DESCRIPTIONS: Record<AFAType, string> = {
  fee_cap: 'Time-based billing with a maximum total fee',
  blended_rate: 'Single hourly rate applied across all timekeepers',
  fixed_fee_whole: 'One fixed price for the defined scope',
  fixed_fee_phase: 'Separate fixed fees for selected workstreams/categories',
  fee_collar: 'Target fee with upside/downside sharing bands',
  milestone: 'Fees payable on defined deliverables',
  monthly_retainer: 'Fixed monthly fee covering defined scope',
  discounted_rates: 'Discount applied to standard rates',
  success_fee: 'Optional uplift linked to defined outcome (add-on only)',
};

// Configuration interfaces for each AFA type
export interface FeeCapConfig {
  capType: 'amount' | 'percentage';
  capAmount: number;
  capPercentageAbove: number;
}

export interface BlendedRateConfig {
  calculatedRate: number;
  manualRate: number | null;
  useManual: boolean;
}

export interface FixedFeeWholeConfig {
  riskPremiumPercent: number;
  adjustedFee: number | null;
}

export interface FixedFeePhaseConfig {
  roundToNearest1000: boolean;
  phases: Array<{
    category: string;
    baseAmount: number;
    adjustmentPercent: number; // +/- percentage (e.g., 5 for +5%, -10 for -10%)
    isIncluded: boolean;
  }>;
}

export interface FeeCollarConfig {
  targetFee: number;
  collarWidth: number; // percentage (e.g., 10 for ±10%)
  upsideSharePercent: number; // firm's share if under target
  downsideSharePercent: number; // firm's share if over target
}

export interface MilestoneConfig {
  milestones: Array<{
    id: string;
    name: string;
    description: string;
    percentOfTotal: number;
    amount: number;
  }>;
}

export interface MonthlyRetainerConfig {
  monthlyFee: number;
  durationMonths: number;
  includedCategories: string[];
  excludedCategories: string[];
}

export interface DiscountedRatesConfig {
  discountPercent: number;
}

export interface SuccessFeeConfig {
  baseAfaType: AFAType | null;
  successCondition: string;
  upliftPercent: number;
  upliftAmount: number;
}

export type AFAConfig = 
  | FeeCapConfig
  | BlendedRateConfig
  | FixedFeeWholeConfig
  | FixedFeePhaseConfig
  | FeeCollarConfig
  | MilestoneConfig
  | MonthlyRetainerConfig
  | DiscountedRatesConfig
  | SuccessFeeConfig;

export interface ProposalAFA {
  id: string;
  proposal_id: string;
  user_id: string;
  afa_type: AFAType;
  is_enabled: boolean;
  config: AFAConfig;
  client_price: number;
  effective_rate: number;
  margin_impact_percent: number;
  client_narrative: string | null;
  is_selected_for_export: boolean;
  created_at: string;
  updated_at: string;
}

// Risk indicator thresholds
export interface RiskIndicator {
  level: 'green' | 'amber' | 'red';
  message: string;
}

export function calculateRiskIndicator(
  baselineEstimate: number,
  clientPrice: number
): RiskIndicator {
  const discount = ((baselineEstimate - clientPrice) / baselineEstimate) * 100;
  
  if (discount > 25) {
    return {
      level: 'red',
      message: `Discount exceeds 25% (${discount.toFixed(1)}%)`
    };
  }
  
  if (discount > 15) {
    return {
      level: 'amber',
      message: `Discount exceeds 15% (${discount.toFixed(1)}%)`
    };
  }
  
  return {
    level: 'green',
    message: 'Within acceptable parameters'
  };
}

function parseAFAConfig(json: Json | null, afaType: AFAType): AFAConfig {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return getDefaultConfig(afaType);
  }
  return json as unknown as AFAConfig;
}

export function getDefaultConfig(afaType: AFAType): AFAConfig {
  switch (afaType) {
    case 'fee_cap':
      return { capType: 'percentage', capAmount: 0, capPercentageAbove: 10 };
    case 'blended_rate':
      return { calculatedRate: 0, manualRate: null, useManual: false };
    case 'fixed_fee_whole':
      return { riskPremiumPercent: 5, adjustedFee: null };
    case 'fixed_fee_phase':
      return { roundToNearest1000: false, phases: [] };
    case 'fee_collar':
      return { targetFee: 0, collarWidth: 10, upsideSharePercent: 50, downsideSharePercent: 50 };
    case 'milestone':
      return { milestones: [] };
    case 'monthly_retainer':
      return { monthlyFee: 0, durationMonths: 6, includedCategories: [], excludedCategories: [] };
    case 'discounted_rates':
      return { discountPercent: 10 };
    case 'success_fee':
      return { baseAfaType: null, successCondition: '', upliftPercent: 10, upliftAmount: 0 };
  }
}

export function useProposalAFAs(proposalId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch AFAs for this proposal
  const afasQuery = useQuery({
    queryKey: ['proposal-afas', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_proposal_afas')
        .select('*')
        .eq('proposal_id', proposalId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(row => ({
        ...row,
        afa_type: row.afa_type as AFAType,
        config: parseAFAConfig(row.config, row.afa_type as AFAType),
      })) as ProposalAFA[];
    },
    enabled: !!user && !!proposalId,
  });

  // Create or update an AFA
  const upsertAFA = useMutation({
    mutationFn: async (afa: Partial<ProposalAFA> & { afa_type: AFAType }) => {
      const existing = afasQuery.data?.find(a => a.afa_type === afa.afa_type);
      
      if (existing) {
        const { error } = await supabase
          .from('pricing_proposal_afas')
          .update({
            is_enabled: afa.is_enabled,
            config: afa.config as unknown as Json,
            client_price: afa.client_price || 0,
            effective_rate: afa.effective_rate || 0,
            margin_impact_percent: afa.margin_impact_percent || 0,
            client_narrative: afa.client_narrative || null,
            is_selected_for_export: afa.is_selected_for_export ?? false,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pricing_proposal_afas')
          .insert({
            proposal_id: proposalId!,
            user_id: user!.id,
            afa_type: afa.afa_type,
            is_enabled: afa.is_enabled ?? false,
            config: (afa.config || getDefaultConfig(afa.afa_type)) as unknown as Json,
            client_price: afa.client_price || 0,
            effective_rate: afa.effective_rate || 0,
            margin_impact_percent: afa.margin_impact_percent || 0,
            client_narrative: afa.client_narrative || null,
            is_selected_for_export: afa.is_selected_for_export ?? false,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-afas', proposalId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save AFA', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle AFA enabled status
  const toggleAFA = useMutation({
    mutationFn: async ({ afaType, enabled }: { afaType: AFAType; enabled: boolean }) => {
      const existing = afasQuery.data?.find(a => a.afa_type === afaType);
      
      if (existing) {
        const { error } = await supabase
          .from('pricing_proposal_afas')
          .update({ is_enabled: enabled })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pricing_proposal_afas')
          .insert({
            proposal_id: proposalId!,
            user_id: user!.id,
            afa_type: afaType,
            is_enabled: enabled,
            config: getDefaultConfig(afaType) as unknown as Json,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-afas', proposalId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to toggle AFA', description: error.message, variant: 'destructive' });
    },
  });

  // Delete an AFA
  const deleteAFA = useMutation({
    mutationFn: async (afaId: string) => {
      const { error } = await supabase
        .from('pricing_proposal_afas')
        .delete()
        .eq('id', afaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-afas', proposalId] });
      toast({ title: 'AFA removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to remove AFA', description: error.message, variant: 'destructive' });
    },
  });

  // Select AFA for export
  const selectForExport = useMutation({
    mutationFn: async ({ afaId, selected }: { afaId: string; selected: boolean }) => {
      const { error } = await supabase
        .from('pricing_proposal_afas')
        .update({ is_selected_for_export: selected })
        .eq('id', afaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-afas', proposalId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update selection', description: error.message, variant: 'destructive' });
    },
  });

  return {
    afas: afasQuery.data || [],
    isLoading: afasQuery.isLoading,
    error: afasQuery.error,
    upsertAFA,
    toggleAFA,
    deleteAFA,
    selectForExport,
  };
}
