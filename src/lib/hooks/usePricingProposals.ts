import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { BUDGET_CATEGORIES } from './useBudgetVersions';
import { Json } from '@/integrations/supabase/types';

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

export interface ProposalAssumptions {
  negotiatedDocsDecay: number;
  ddDecay: number;
  numMeetings: number;
  meetingHoursPartner: number;
  meetingHoursAssociate: number;
  numNegotiationTurns: number;
  afaDiscount: number;
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

export const DEFAULT_ASSUMPTIONS: ProposalAssumptions = {
  negotiatedDocsDecay: 0.5,
  ddDecay: 0.35,
  numMeetings: 0,
  meetingHoursPartner: 3,
  meetingHoursAssociate: 2,
  numNegotiationTurns: 3,
  afaDiscount: 0,
};

export interface PricingProposal {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  description: string | null;
  currency: string;
  status: 'Draft' | 'Agreed';
  current_version: number;
  rate_card: RateCard | null;
  work_phases: WorkPhase[] | null;
  assumptions: ProposalAssumptions | null;
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
  pricing_method: 'ai_suggested' | 'pricing_tool' | 'manual' | 'iterative';
  category: string | null;
  lc_firm_name: string | null;
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
}

export interface DraftProposalItem {
  id?: string;
  work_item: string;
  provider: 'Baker McKenzie' | 'Local Counsel';
  fee_amount: number;
  pricing_method: 'ai_suggested' | 'pricing_tool' | 'manual' | 'iterative';
  category?: string | null;
  lc_firm_name?: string;
  is_optional?: boolean;
  is_included?: boolean;
  ai_rationale?: string | null;
  partner_hours?: number;
  associate_hours?: number;
  num_turns?: number;
  item_type?: 'documentation' | 'negotiation' | 'due_diligence' | 'meeting';
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
      })) as PricingProposal[];
    },
    enabled: !!user,
  });

  // Create new proposal
  const createProposal = useMutation({
    mutationFn: async (input: CreateProposalInput) => {
      // Create proposal
      const { data: proposal, error: proposalError } = await supabase
        .from('pricing_proposals')
        .insert({
          user_id: user!.id,
          client_id: input.client_id,
          name: input.name,
          description: input.description || null,
          currency: input.currency || 'GBP',
        })
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
    mutationFn: async (updates: Partial<Pick<PricingProposal, 'name' | 'description' | 'currency' | 'status' | 'rate_card' | 'work_phases' | 'assumptions'>>) => {
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
        const itemsToInsert = items.map((item, index) => ({
          version_id: version.id,
          proposal_id: proposalId!,
          user_id: user!.id,
          work_item: item.work_item,
          provider: item.provider,
          fee_amount: item.fee_amount,
          pricing_method: item.pricing_method,
          category: item.category || null,
          lc_firm_name: item.provider === 'Local Counsel' ? (item.lc_firm_name || null) : null,
          is_optional: item.is_optional ?? false,
          is_included: item.is_included ?? true,
          sort_order: index,
          ai_rationale: item.ai_rationale || null,
          partner_hours: item.partner_hours ?? 0,
          associate_hours: item.associate_hours ?? 0,
          num_turns: item.num_turns ?? 1,
          item_type: item.item_type ?? 'documentation',
        }));

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
      toast({ title: 'Version saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save version', description: error.message, variant: 'destructive' });
    },
  });

  // Mark as agreed and optionally send to matter
  const markAsAgreed = useMutation({
    mutationFn: async ({ matterId, createNewMatter }: { matterId?: string; createNewMatter?: boolean }) => {
      // Update proposal status
      await supabase
        .from('pricing_proposals')
        .update({ status: 'Agreed' })
        .eq('id', proposalId!);

      // If sending to a matter
      if (matterId && latestVersion) {
        const items = await fetchVersionItems(latestVersion.id);
        
        // Create budget version for the matter
        const { data: budgetVersion, error: budgetVersionError } = await supabase
          .from('budget_versions')
          .insert({
            matter_id: matterId,
            user_id: user!.id,
            version_number: 1,
            total_amount: latestVersion.total_amount,
            bm_total: latestVersion.bm_total,
            local_counsel_total: latestVersion.local_counsel_total,
            notes: `Imported from pricing proposal: ${proposalQuery.data?.name}`,
          })
          .select()
          .single();

        if (budgetVersionError) throw budgetVersionError;

        // Create budget line items
        if (items.length > 0) {
          const lineItems = items.map((item, index) => ({
            budget_version_id: budgetVersion.id,
            matter_id: matterId,
            user_id: user!.id,
            work_item: item.work_item,
            provider: item.provider,
            fee_amount: item.fee_amount,
            category: item.category,
            lc_firm_name: item.lc_firm_name,
            is_optional: item.is_optional,
            is_included: item.is_included,
            sort_order: index,
          }));

          await supabase
            .from('budget_line_items')
            .insert(lineItems);
        }

        // Update matter totals
        await supabase
          .from('matters')
          .update({
            fee_amount_upper_end: latestVersion.total_amount,
            bm_fee_component: latestVersion.bm_total,
            local_counsel_fee: latestVersion.local_counsel_total,
          })
          .eq('id', matterId);
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

  return {
    proposal: proposalQuery.data,
    versions: versionsQuery.data || [],
    latestVersion,
    items: itemsQuery.data || [],
    isLoading: proposalQuery.isLoading || versionsQuery.isLoading,
    isLoadingItems: itemsQuery.isLoading,
    error: proposalQuery.error,
    updateProposal,
    saveVersion,
    markAsAgreed,
    fetchVersionItems,
  };
}
