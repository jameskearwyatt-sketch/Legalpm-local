import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { BUDGET_CATEGORIES } from './useBudgetVersions';
import { Json } from '@/integrations/supabase/types';
import { applyAFAFilters } from '@/lib/afaFilterUtils';
import { ProposalAFA } from './useProposalAFAs';

export interface RateCard {
  partner: { rate: number; cost: number };
  seniorAssociate: { rate: number; cost: number };
  associate: { rate: number; cost: number };
  trainee: { rate: number; cost: number };
}

export interface WorkPhase {
  id: string;
  name: string;
  description: string;
  partnerHours: number;
  seniorAssociateHours: number;
  associateHours: number;
  traineeHours: number;
}

export type EstimationMethod = 'pyramid' | 'partner-heavy' | 'junior-heavy';

// New types for figure selection settings
export type FigureType = 'lower' | 'midpoint' | 'upper';
export type SendToMatterFigure = 'midpoint' | 'upper' | 'afa';

export interface ExportFigureSettings {
  lower: boolean;
  midpoint: boolean;
  upper: boolean;
}

export interface ProposalAssumptions {
  negotiatedDocsDecay: number;
  ddDecay: number;
  numMeetings: number;
  meetingHoursPartner: number;
  meetingHoursAssociate: number;
  numNegotiationTurns: number;
  afaDiscount: number;
  estimationMethod: EstimationMethod;
  // New figure selection settings
  excelExportFigures?: ExportFigureSettings | null;
  afaBaseFigure?: FigureType | null;
  sendToMatterFigure?: SendToMatterFigure | null;
}

// Check if figure settings are complete (all three must be set)
export function areFigureSettingsComplete(assumptions: ProposalAssumptions | null): boolean {
  if (!assumptions) return false;
  
  const { excelExportFigures, afaBaseFigure, sendToMatterFigure } = assumptions;
  
  // Excel export: at least one figure must be selected
  const excelValid = excelExportFigures && 
    (excelExportFigures.lower || excelExportFigures.midpoint || excelExportFigures.upper);
  
  // AFA base: must be set
  const afaValid = afaBaseFigure !== null && afaBaseFigure !== undefined;
  
  // Send to matter: must be set
  const sendValid = sendToMatterFigure !== null && sendToMatterFigure !== undefined;
  
  return Boolean(excelValid && afaValid && sendValid);
}

export const DEFAULT_RATE_CARD: RateCard = {
  partner: { rate: 850, cost: 425 },
  seniorAssociate: { rate: 650, cost: 260 },
  associate: { rate: 450, cost: 180 },
  trainee: { rate: 250, cost: 100 },
};

export const DEFAULT_WORK_PHASES: WorkPhase[] = [
  { id: "1", name: "Initial Review & Kick-off", description: "Review materials, client meetings, team briefing", partnerHours: 4, seniorAssociateHours: 6, associateHours: 8, traineeHours: 4 },
  { id: "2", name: "Due Diligence", description: "Legal due diligence review and reporting", partnerHours: 8, seniorAssociateHours: 20, associateHours: 40, traineeHours: 20 },
  { id: "3", name: "Documentation - First Draft", description: "Drafting of transaction documents", partnerHours: 10, seniorAssociateHours: 30, associateHours: 40, traineeHours: 10 },
  { id: "4", name: "Negotiation & Mark-ups", description: "Negotiation rounds and document revisions", partnerHours: 15, seniorAssociateHours: 25, associateHours: 30, traineeHours: 5 },
  { id: "5", name: "Closing & Completion", description: "Closing mechanics, conditions precedent, completion", partnerHours: 6, seniorAssociateHours: 10, associateHours: 15, traineeHours: 8 },
  { id: "6", name: "Project Management", description: "Ongoing project management and coordination", partnerHours: 5, seniorAssociateHours: 8, associateHours: 5, traineeHours: 2 },
];

// Default assumptions - figure settings are null (must be explicitly set)
export const DEFAULT_ASSUMPTIONS: ProposalAssumptions = {
  negotiatedDocsDecay: 0.5,
  ddDecay: 0.35,
  numMeetings: 0,
  meetingHoursPartner: 3,
  meetingHoursAssociate: 2,
  numNegotiationTurns: 3,
  afaDiscount: 0,
  estimationMethod: 'pyramid',
  excelExportFigures: null,
  afaBaseFigure: null,
  sendToMatterFigure: null,
};

// Simple assumption value
export interface SimpleAssumptionValue {
  assumptionId: string;
  enabled: boolean;
  inputValue?: string;
  narrative: string;
}

// Document-specific config
export interface DocumentConfig {
  workItemName: string;
  turns?: number;
  whoDrafts?: 'we_draft' | 'they_draft';
  clientForm?: boolean;
}

export interface DocumentAssumptionsState {
  turnsEnabled: boolean;
  whoDraftsEnabled: boolean;
  clientFormEnabled: boolean;
  configs: DocumentConfig[];
}

export interface ScopeAssumptionsState {
  noAssumptionsApply: boolean;
  simpleAssumptions: SimpleAssumptionValue[];
  documentAssumptions: DocumentAssumptionsState;
  documentNarratives: string[];
}

export interface PricingProposal {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  description: string | null;
  currency: string;
  team_rate_currency: string | null;
  status: 'Draft' | 'Agreed';
  current_version: number;
  rate_card: RateCard | null;
  work_phases: WorkPhase[] | null;
  assumptions: ProposalAssumptions | null;
  scope_assumptions: ScopeAssumptionsState | null;
  linked_matter_id: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
  };
}

export interface PricingProposalVersion {
  id: string;
  proposal_id: string;
  user_id: string;
  version_number: number;
  total_amount: number;
  bm_total: number;
  local_counsel_total: number;
  notes: string | null;
  created_at: string;
}

export interface PricingProposalItem {
  id: string;
  version_id: string;
  proposal_id: string;
  user_id: string;
  work_item: string;
  provider: 'Baker McKenzie' | 'Local Counsel';
  fee_amount: number;
  fee_lower: number;
  fee_upper: number;
  pricing_method: 'ai_suggested' | 'pricing_tool' | 'manual';
  category: string | null;
  lc_firm_name: string | null;
  lc_country: string | null;
  lc_library_id: string | null;
  lc_currency: string | null;
  is_optional: boolean;
  is_included: boolean;
  sort_order: number;
  ai_rationale: string | null;
  partner_hours: number;
  associate_hours: number;
  num_turns: number;
  item_type: 'documentation' | 'negotiation' | 'due_diligence' | 'meeting';
  created_at: string;
  updated_at: string;
}

export interface CreateProposalInput {
  client_id: string;
  name: string;
  description?: string;
  currency?: string;
  team_rate_currency?: string;
  rate_card?: RateCard;
}

export interface DraftProposalItem {
  id?: string;
  work_item: string;
  detail?: string | null;
  provider: 'Baker McKenzie' | 'Local Counsel';
  fee_amount: number;
  fee_lower?: number;
  fee_upper?: number;
  pricing_method: 'ai_suggested' | 'pricing_tool' | 'manual';
  category?: string | null;
  phase_id?: string | null;
  lc_firm_name?: string;
  lc_country?: string | null;
  lc_library_id?: string | null;
  lc_currency?: string | null;
  is_optional?: boolean;
  is_included?: boolean;
  ai_rationale?: string | null;
  partner_hours?: number;
  associate_hours?: number;
  num_turns?: number;
  item_type?: 'documentation' | 'negotiation' | 'due_diligence' | 'meeting';
}

// Phase definition for grouping work items
export interface ProposalPhase {
  id: string;
  name: string;
  is_included: boolean;
}

// Helper to safely parse JSON columns
function parseJsonColumn<T>(value: Json | null, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    if (typeof value === 'string') {
      return JSON.parse(value) as T;
    }
    return value as T;
  } catch {
    return defaultValue;
  }
}

export { BUDGET_CATEGORIES };

export function usePricingProposals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all proposals
  const proposalsQuery = useQuery({
    queryKey: ['pricing-proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_proposals')
        .select(`
          *,
          client:clients(id, name)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Parse JSONB columns for each proposal
      return (data || []).map(d => ({
        ...d,
        rate_card: parseJsonColumn<RateCard>(d.rate_card, DEFAULT_RATE_CARD),
        work_phases: parseJsonColumn<WorkPhase[]>(d.work_phases, DEFAULT_WORK_PHASES),
        assumptions: parseJsonColumn<ProposalAssumptions>(d.assumptions, DEFAULT_ASSUMPTIONS),
        scope_assumptions: parseJsonColumn<ScopeAssumptionsState | null>(d.scope_assumptions, null),
      })) as PricingProposal[];
    },
    enabled: !!user,
  });

  // Create new proposal
  const createProposal = useMutation({
    mutationFn: async (input: CreateProposalInput) => {
      // Create proposal with user's defaults
      const { data: proposal, error: proposalError } = await supabase
        .from('pricing_proposals')
        .insert({
          user_id: user!.id,
          client_id: input.client_id,
          name: input.name,
          description: input.description || null,
          currency: input.currency || 'GBP',
          team_rate_currency: input.team_rate_currency || input.currency || 'GBP',
          rate_card: (input.rate_card || null) as any,
        } as any)
        .select()
        .single();

      if (proposalError) throw proposalError;

      // Create initial version
      const { error: versionError } = await supabase
        .from('pricing_proposal_versions')
        .insert({
          proposal_id: proposal.id,
          user_id: user!.id,
          version_number: 1,
        });

      if (versionError) throw versionError;

      return proposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-proposals'] });
      toast({ title: 'Proposal created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create proposal', description: error.message, variant: 'destructive' });
    },
  });

  // Delete proposal
  const deleteProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase
        .from('pricing_proposals')
        .delete()
        .eq('id', proposalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-proposals'] });
      toast({ title: 'Proposal deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete proposal', description: error.message, variant: 'destructive' });
    },
  });

  return {
    proposals: proposalsQuery.data || [],
    isLoading: proposalsQuery.isLoading,
    error: proposalsQuery.error,
    createProposal,
    deleteProposal,
  };
}

export function usePricingProposal(proposalId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch single proposal
  const proposalQuery = useQuery({
    queryKey: ['pricing-proposal', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_proposals')
        .select(`
          *,
          client:clients(id, name)
        `)
        .eq('id', proposalId!)
        .single();

      if (error) throw error;
      
      // Parse JSONB columns with defaults
      return {
        ...data,
        rate_card: parseJsonColumn<RateCard>(data.rate_card, DEFAULT_RATE_CARD),
        work_phases: parseJsonColumn<WorkPhase[]>(data.work_phases, DEFAULT_WORK_PHASES),
        assumptions: parseJsonColumn<ProposalAssumptions>(data.assumptions, DEFAULT_ASSUMPTIONS),
        scope_assumptions: parseJsonColumn<ScopeAssumptionsState | null>(data.scope_assumptions, null),
      } as PricingProposal;
    },
    enabled: !!user && !!proposalId,
  });

  // Fetch all versions
  const versionsQuery = useQuery({
    queryKey: ['pricing-proposal-versions', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_proposal_versions')
        .select('*')
        .eq('proposal_id', proposalId!)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return data as PricingProposalVersion[];
    },
    enabled: !!user && !!proposalId,
  });

  const latestVersion = versionsQuery.data?.[0];

  // Fetch items for latest version
  const itemsQuery = useQuery({
    queryKey: ['pricing-proposal-items', latestVersion?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_proposal_items')
        .select('*')
        .eq('version_id', latestVersion!.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as PricingProposalItem[];
    },
    enabled: !!user && !!latestVersion?.id,
  });

  // Fetch items for a specific version
  const fetchVersionItems = async (versionId: string): Promise<PricingProposalItem[]> => {
    const { data, error } = await supabase
      .from('pricing_proposal_items')
      .select('*')
      .eq('version_id', versionId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data as PricingProposalItem[];
  };

  // Update proposal details
  const updateProposal = useMutation({
    mutationFn: async (updates: Partial<Pick<PricingProposal, 'name' | 'description' | 'currency' | 'team_rate_currency' | 'status' | 'rate_card' | 'work_phases' | 'assumptions'>>) => {
      const { error } = await supabase
        .from('pricing_proposals')
        .update(updates as any)
        .eq('id', proposalId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['pricing-proposals'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update proposal', description: error.message, variant: 'destructive' });
    },
  });

  // Update current version (overwrites existing items)
  const updateCurrentVersion = useMutation({
    mutationFn: async ({ items, notes }: { items: DraftProposalItem[]; notes?: string }) => {
      if (!latestVersion) throw new Error('No version to update');

      // Calculate totals
      const includedItems = items.filter(item => 
        !item.is_optional || (item.is_optional && item.is_included !== false)
      );
      const bmTotal = includedItems
        .filter(item => item.provider === 'Baker McKenzie')
        .reduce((sum, item) => sum + item.fee_amount, 0);
      const localCounselTotal = includedItems
        .filter(item => item.provider === 'Local Counsel')
        .reduce((sum, item) => sum + item.fee_amount, 0);
      const totalAmount = bmTotal + localCounselTotal;

      // Update version totals and notes
      const { error: versionError } = await supabase
        .from('pricing_proposal_versions')
        .update({
          total_amount: totalAmount,
          bm_total: bmTotal,
          local_counsel_total: localCounselTotal,
          notes: notes || null,
        })
        .eq('id', latestVersion.id);

      if (versionError) throw versionError;

      // Delete existing items for this version
      const { error: deleteError } = await supabase
        .from('pricing_proposal_items')
        .delete()
        .eq('version_id', latestVersion.id);

      if (deleteError) throw deleteError;

      // Re-insert all items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => {
          // Calculate fee_lower and fee_upper based on pricing method
          const feeLower = item.fee_lower ?? (
            item.pricing_method === 'manual' 
              ? item.fee_amount 
              : Math.round(item.fee_amount * 0.9)
          );
          const feeUpper = item.fee_upper ?? (
            item.pricing_method === 'manual' 
              ? item.fee_amount 
              : Math.round(item.fee_amount * 1.1)
          );
          
          return {
            version_id: latestVersion.id,
            proposal_id: proposalId!,
            user_id: user!.id,
            work_item: item.work_item,
            provider: item.provider,
            fee_amount: item.fee_amount,
            fee_lower: feeLower,
            fee_upper: feeUpper,
            pricing_method: item.pricing_method,
            category: item.category || null,
            lc_firm_name: item.provider === 'Local Counsel' ? (item.lc_firm_name || null) : null,
            lc_country: item.provider === 'Local Counsel' ? (item.lc_country || null) : null,
            lc_library_id: item.provider === 'Local Counsel' ? (item.lc_library_id || null) : null,
            lc_currency: item.provider === 'Local Counsel' ? (item.lc_currency || null) : null,
            is_optional: item.is_optional ?? false,
            is_included: item.is_included ?? true,
            sort_order: index,
            ai_rationale: item.ai_rationale || null,
            partner_hours: item.partner_hours ?? 0,
            associate_hours: item.associate_hours ?? 0,
            num_turns: item.num_turns ?? 1,
            item_type: item.item_type ?? 'documentation',
          };
        });

        const { error: itemsError } = await supabase
          .from('pricing_proposal_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return latestVersion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal-versions', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal-items'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal', proposalId] });
      toast({ title: 'Current version updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update version', description: error.message, variant: 'destructive' });
    },
  });

  // Save new version with items
  const saveVersion = useMutation({
    mutationFn: async ({ items, notes }: { items: DraftProposalItem[]; notes?: string }) => {
      const nextVersionNumber = (versionsQuery.data?.length || 0) + 1;

      // Calculate totals
      const includedItems = items.filter(item => 
        !item.is_optional || (item.is_optional && item.is_included !== false)
      );
      const bmTotal = includedItems
        .filter(item => item.provider === 'Baker McKenzie')
        .reduce((sum, item) => sum + item.fee_amount, 0);
      const localCounselTotal = includedItems
        .filter(item => item.provider === 'Local Counsel')
        .reduce((sum, item) => sum + item.fee_amount, 0);
      const totalAmount = bmTotal + localCounselTotal;

      // Create new version
      const { data: version, error: versionError } = await supabase
        .from('pricing_proposal_versions')
        .insert({
          proposal_id: proposalId!,
          user_id: user!.id,
          version_number: nextVersionNumber,
          total_amount: totalAmount,
          bm_total: bmTotal,
          local_counsel_total: localCounselTotal,
          notes: notes || null,
        })
        .select()
        .single();

      if (versionError) throw versionError;

      // Create items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => {
          // Calculate fee_lower and fee_upper based on pricing method
          const feeLower = item.fee_lower ?? (
            item.pricing_method === 'manual' 
              ? item.fee_amount 
              : Math.round(item.fee_amount * 0.9)
          );
          const feeUpper = item.fee_upper ?? (
            item.pricing_method === 'manual' 
              ? item.fee_amount 
              : Math.round(item.fee_amount * 1.1)
          );
          
          return {
            version_id: version.id,
            proposal_id: proposalId!,
            user_id: user!.id,
            work_item: item.work_item,
            provider: item.provider,
            fee_amount: item.fee_amount,
            fee_lower: feeLower,
            fee_upper: feeUpper,
            pricing_method: item.pricing_method,
            category: item.category || null,
            lc_firm_name: item.provider === 'Local Counsel' ? (item.lc_firm_name || null) : null,
            lc_country: item.provider === 'Local Counsel' ? (item.lc_country || null) : null,
            lc_library_id: item.provider === 'Local Counsel' ? (item.lc_library_id || null) : null,
            lc_currency: item.provider === 'Local Counsel' ? (item.lc_currency || null) : null,
            is_optional: item.is_optional ?? false,
            is_included: item.is_included ?? true,
            sort_order: index,
            ai_rationale: item.ai_rationale || null,
            partner_hours: item.partner_hours ?? 0,
            associate_hours: item.associate_hours ?? 0,
            num_turns: item.num_turns ?? 1,
            item_type: item.item_type ?? 'documentation',
          };
        });

        const { error: itemsError } = await supabase
          .from('pricing_proposal_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Update proposal current_version
      await supabase
        .from('pricing_proposals')
        .update({ current_version: nextVersionNumber })
        .eq('id', proposalId!);

      return version;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal-versions', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal-items'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['pricing-proposals'] });
      toast({ title: 'New version saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save version', description: error.message, variant: 'destructive' });
    },
  });

  // Mark as agreed and optionally send to matter
  const markAsAgreed = useMutation({
    mutationFn: async ({ matterId, createNewMatter }: { matterId?: string; createNewMatter?: boolean }) => {
      // Update proposal status and link to matter
      await supabase
        .from('pricing_proposals')
        .update({ 
          status: 'Agreed',
          linked_matter_id: matterId || null
        })
        .eq('id', proposalId!);

      // If sending to a matter
      if (matterId && latestVersion) {
        const items = await fetchVersionItems(latestVersion.id);
        
        // Fetch enabled AFAs for this proposal
        const { data: afasData } = await supabase
          .from('pricing_proposal_afas')
          .select('*')
          .eq('proposal_id', proposalId!)
          .eq('is_enabled', true);
        
        const enabledAFAs: ProposalAFA[] = (afasData || []).map(afa => ({
          ...afa,
          afa_type: afa.afa_type as ProposalAFA['afa_type'],
          config: afa.config as unknown as ProposalAFA['config'],
          is_enabled: afa.is_enabled ?? false,
          client_price: afa.client_price ?? 0,
          effective_rate: afa.effective_rate ?? null,
          margin_impact_percent: afa.margin_impact_percent ?? null,
          client_narrative: afa.client_narrative ?? null,
          is_selected_for_export: afa.is_selected_for_export ?? false,
        }));
        
        // Get currency symbol for AFA filter (used in comments)
        const currency = proposalQuery.data?.currency || 'GBP';
        const currencySymbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
        
        // Calculate baseline total from items
        const baselineTotal = items.reduce((sum, item) => sum + (item.fee_amount || 0), 0);
        
        // Apply AFA filters to get adjusted items (with discounts, etc. applied)
        const filterResult = applyAFAFilters(items, enabledAFAs, baselineTotal, currencySymbol);
        
        // Helper: Round to nearest 1000 for client-facing budget figures
        const roundToNearest1000 = (value: number): number => Math.round(value / 1000) * 1000;
        
        // Use AFA-filtered items and calculate rounded totals
        let roundedBmTotal = 0;
        let roundedLcTotal = 0;
        const roundedItems = filterResult.items.map(item => {
          // AFA filter already rounds to nearest 1000, but ensure it's done
          const roundedFee = roundToNearest1000(item.fee_amount || 0);
          if (item.provider === 'Baker McKenzie') {
            roundedBmTotal += roundedFee;
          } else {
            roundedLcTotal += roundedFee;
          }
          return { ...item, fee_amount: roundedFee };
        });
        const roundedTotal = roundedBmTotal + roundedLcTotal;
        
        // Create budget version for the matter with rounded figures
        const { data: budgetVersion, error: budgetVersionError } = await supabase
          .from('budget_versions')
          .insert({
            matter_id: matterId,
            user_id: user!.id,
            version_number: 1,
            total_amount: roundedTotal,
            bm_total: roundedBmTotal,
            local_counsel_total: roundedLcTotal,
            notes: `Imported from pricing proposal: ${proposalQuery.data?.name}`,
          })
          .select()
          .single();

        if (budgetVersionError) throw budgetVersionError;

        // Create budget line items with rounded fee amounts (AFA-adjusted)
        if (roundedItems.length > 0) {
          const lineItems = roundedItems.map((item, index) => ({
            budget_version_id: budgetVersion.id,
            matter_id: matterId,
            user_id: user!.id,
            work_item: item.work_item,
            provider: item.provider,
            fee_amount: item.fee_amount, // Already AFA-adjusted and rounded
            category: item.category,
            lc_firm_name: item.provider === 'Local Counsel' ? (item.lc_firm_name || null) : null,
            lc_country: item.provider === 'Local Counsel' ? (item.lc_country || null) : null,
            lc_currency: item.provider === 'Local Counsel' ? (item.lc_currency || null) : null,
            lc_library_id: item.provider === 'Local Counsel' ? (item.lc_library_id || null) : null,
            is_optional: item.is_optional,
            is_included: item.is_included,
            sort_order: index,
          }));

          await supabase
            .from('budget_line_items')
            .insert(lineItems);
        }

        // Fetch current matter to check for different billing currency
        const { data: currentMatter } = await supabase
          .from('matters')
          .select('different_billing_currency, agreed_billing_amount, fee_amount_upper_end')
          .eq('id', matterId)
          .single();

        // Build update object with rounded totals
        const matterUpdate: Record<string, number> = {
          fee_amount_upper_end: roundedTotal,
          bm_fee_component: roundedBmTotal,
          local_counsel_fee: roundedLcTotal,
        };

        // Update agreed_billing_amount proportionally if different billing currency
        if (currentMatter?.different_billing_currency && 
            currentMatter.agreed_billing_amount > 0 && 
            currentMatter.fee_amount_upper_end > 0) {
          const mandatedRate = currentMatter.agreed_billing_amount / currentMatter.fee_amount_upper_end;
          matterUpdate.agreed_billing_amount = roundedTotal * mandatedRate;
        }

        // Update matter totals
        await supabase
          .from('matters')
          .update(matterUpdate)
          .eq('id', matterId);

        // Sync scope assumptions to matter_assumptions table
        const scopeAssumptions = proposalQuery.data?.scope_assumptions;
        if (scopeAssumptions && !scopeAssumptions.noAssumptionsApply) {
          // Collect all narratives: simple assumptions + document narratives
          const allNarratives: { label: string; narrative: string }[] = [];
          
          // Simple assumptions
          if (scopeAssumptions.simpleAssumptions) {
            scopeAssumptions.simpleAssumptions
              .filter(a => a.enabled && a.narrative)
              .forEach(a => {
                allNarratives.push({
                  label: a.assumptionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  narrative: a.narrative,
                });
              });
          }
          
          // Document narratives
          if (scopeAssumptions.documentNarratives) {
            scopeAssumptions.documentNarratives
              .filter(n => n && n.length > 0)
              .forEach((n, i) => {
                allNarratives.push({
                  label: `Documentation Assumption ${i + 1}`,
                  narrative: n,
                });
              });
          }

          if (allNarratives.length > 0) {
            // First, delete any existing assumptions from this pricing proposal source
            await supabase
              .from('matter_assumptions')
              .delete()
              .eq('matter_id', matterId)
              .eq('source_document', `Pricing Proposal: ${proposalQuery.data?.name}`);

            // Insert new assumptions
            const assumptionRecords = allNarratives.map(a => ({
              matter_id: matterId,
              user_id: user!.id,
              label: a.label,
              assumption_text: a.narrative,
              is_standard: false,
              source_document: `Pricing Proposal: ${proposalQuery.data?.name}`,
            }));

            await supabase
              .from('matter_assumptions')
              .insert(assumptionRecords);
          }
        }
      }

      return { matterId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['pricing-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['budget-versions'] });
      toast({ title: 'Proposal marked as agreed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update proposal', description: error.message, variant: 'destructive' });
    },
  });

  // Reactivate an agreed proposal - delete budget from matter and set back to draft
  const reactivateProposal = useMutation({
    mutationFn: async () => {
      const linkedMatterId = proposalQuery.data?.linked_matter_id;
      
      // If linked to a matter, delete the budget version(s) created from this proposal
      if (linkedMatterId) {
        // Get all budget versions for this matter that came from this proposal
        const { data: versions } = await supabase
          .from('budget_versions')
          .select('id')
          .eq('matter_id', linkedMatterId)
          .ilike('notes', `%Imported from pricing proposal: ${proposalQuery.data?.name}%`);

        if (versions && versions.length > 0) {
          // Delete budget line items first (they reference budget versions)
          for (const version of versions) {
            await supabase
              .from('budget_line_items')
              .delete()
              .eq('budget_version_id', version.id);
          }

          // Delete the budget versions
          for (const version of versions) {
            await supabase
              .from('budget_versions')
              .delete()
              .eq('id', version.id);
          }
        }

        // Get remaining versions after deletion
        const { data: remainingVersions } = await supabase
          .from('budget_versions')
          .select('*')
          .eq('matter_id', linkedMatterId)
          .order('version_number', { ascending: false });

        // Fetch current matter to check for different billing currency
        const { data: currentMatter } = await supabase
          .from('matters')
          .select('different_billing_currency, agreed_billing_amount, fee_amount_upper_end')
          .eq('id', linkedMatterId)
          .single();

        // Update matters table with the previous version's totals, or zero if no versions left
        if (remainingVersions && remainingVersions.length > 0) {
          const newLatest = remainingVersions[0];
          
          const matterUpdate: Record<string, number> = {
            fee_amount_upper_end: newLatest.total_amount,
            bm_fee_component: newLatest.bm_total,
            local_counsel_fee: newLatest.local_counsel_total,
          };

          // Update agreed_billing_amount proportionally if different billing currency
          if (currentMatter?.different_billing_currency && 
              currentMatter.agreed_billing_amount > 0 && 
              currentMatter.fee_amount_upper_end > 0) {
            const mandatedRate = currentMatter.agreed_billing_amount / currentMatter.fee_amount_upper_end;
            matterUpdate.agreed_billing_amount = newLatest.total_amount * mandatedRate;
          }

          await supabase
            .from('matters')
            .update(matterUpdate)
            .eq('id', linkedMatterId);
        } else {
          // No versions left, reset to zero
          const matterUpdate: Record<string, number> = {
            fee_amount_upper_end: 0,
            bm_fee_component: 0,
            local_counsel_fee: 0,
          };

          // Also reset agreed_billing_amount if different billing currency
          if (currentMatter?.different_billing_currency) {
            matterUpdate.agreed_billing_amount = 0;
          }

          await supabase
            .from('matters')
            .update(matterUpdate)
            .eq('id', linkedMatterId);
        }
      }

      // Reset proposal status to Draft and clear linked matter
      await supabase
        .from('pricing_proposals')
        .update({ 
          status: 'Draft',
          linked_matter_id: null
        })
        .eq('id', proposalId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['pricing-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['budget-versions'] });
      queryClient.invalidateQueries({ queryKey: ['budget-line-items'] });
      toast({ title: 'Proposal reactivated', description: 'You can now edit and resend this proposal' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to reactivate proposal', description: error.message, variant: 'destructive' });
    },
  });

  // Delete a specific version
  const deleteVersion = useMutation({
    mutationFn: async (versionId: string) => {
      // First delete all items for this version
      const { error: itemsError } = await supabase
        .from('pricing_proposal_items')
        .delete()
        .eq('version_id', versionId);

      if (itemsError) throw itemsError;

      // Then delete the version itself
      const { error: versionError } = await supabase
        .from('pricing_proposal_versions')
        .delete()
        .eq('id', versionId);

      if (versionError) throw versionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal-versions', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['pricing-proposal-items'] });
      toast({ title: 'Version deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete version', description: error.message, variant: 'destructive' });
    },
  });

  return {
    proposal: proposalQuery.data,
    versions: versionsQuery.data || [],
    latestVersion,
    items: itemsQuery.data || [],
    isLoading: proposalQuery.isLoading || versionsQuery.isLoading,
    isLoadingItems: itemsQuery.isLoading,
    error: proposalQuery.error,
    updateProposal,
    updateCurrentVersion,
    saveVersion,
    markAsAgreed,
    reactivateProposal,
    fetchVersionItems,
    deleteVersion,
  };
}
