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

export type EstimationMethod = 'pyramid' | 'partner-heavy' | 'junior-heavy';

export interface ProposalAssumptions {
  negotiatedDocsDecay: number;
  ddDecay: number;
  numMeetings: number;
  meetingHoursPartner: number;
  meetingHoursAssociate: number;
  numNegotiationTurns: number;
  afaDiscount: number;
  estimationMethod: EstimationMethod;
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
  estimationMethod: 'pyramid',
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
}

export interface DraftProposalItem {
  id?: string;
  work_item: string;
  provider: 'Baker McKenzie' | 'Local Counsel';
  fee_amount: number;
  fee_lower?: number;
  fee_upper?: number;
  pricing_method: 'ai_suggested' | 'pricing_tool' | 'manual';
  category?: string | null;
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

        // Build update object
        const matterUpdate: Record<string, number> = {
          fee_amount_upper_end: latestVersion.total_amount,
          bm_fee_component: latestVersion.bm_total,
          local_counsel_fee: latestVersion.local_counsel_total,
        };

        // Update agreed_billing_amount proportionally if different billing currency
        if (currentMatter?.different_billing_currency && 
            currentMatter.agreed_billing_amount > 0 && 
            currentMatter.fee_amount_upper_end > 0) {
          const mandatedRate = currentMatter.agreed_billing_amount / currentMatter.fee_amount_upper_end;
          matterUpdate.agreed_billing_amount = latestVersion.total_amount * mandatedRate;
        }

        // Update matter totals
        await supabase
          .from('matters')
          .update(matterUpdate)
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
