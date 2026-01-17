import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ClearableDateInput } from '@/components/ui/clearable-date-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useMatter, useMatters, MatterCategory, MatterStage, FeeType, MatterSource, PipelineOutcome } from '@/lib/hooks/useMatters';
import { useSnapshots } from '@/lib/hooks/useSnapshots';
import { useWipShapingProposals } from '@/lib/hooks/useWipShapingProposals';
import { useBudgetVersions } from '@/lib/hooks/useBudgetVersions';
import { useBudgetAmendments } from '@/lib/hooks/useBudgetAmendments';
import { useDetailedWipUpdates } from '@/lib/hooks/useDetailedWipUpdates';
import { BudgetSection } from '@/components/matters/BudgetSection';
import { EditableFinancialCell } from '@/components/matters/EditableFinancialCell';
import { AssumptionsSection } from '@/components/matters/AssumptionsSection';
import { useClients } from '@/lib/hooks/useClients';
import { useExchangeRates, getExchangeRate } from '@/lib/hooks/useExchangeRates';
import { formatCurrency } from '@/lib/currencyUtils';
import { useMatterClients, UpdateMatterClientInput } from '@/lib/hooks/useMatterClients';
import { useLocalCounsels } from '@/lib/hooks/useLocalCounsels';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getClientDisplayName, getMatterClientDisplayName } from '@/lib/clientUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BilledAmountCell } from '@/components/matters/BilledAmountCell';
import { 
  ArrowLeft, 
  Trash2, 
  Loader2,
  Save,
  RefreshCw,
  Pencil,
  Check,
  X,
  ChevronDown,
  FileText,
  History,
  Download,
  Eye,
  HelpCircle,
  Lightbulb
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { FinancialSnapshotUpdateDialog } from '@/components/matters/FinancialSnapshotUpdateDialog';
import { FinancialSnapshotHistoryModal } from '@/components/matters/FinancialSnapshotHistoryModal';
import { WipShapingProposalDialog } from '@/components/matters/WipShapingProposalDialog';
import { WipShapingProposalList } from '@/components/matters/WipShapingProposalList';
import { HighlightedFinancialValue } from '@/components/matters/HighlightedFinancialValue';
import { useMatterHighlightMovements } from '@/lib/hooks/useHighlightMovements';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { JurisdictionsMultiSelect } from '@/components/matters/JurisdictionsMultiSelect';
import { exportBudgetToExcel } from '@/lib/exportBudgetToExcel';

const practiceAreas = [
  'Voluntary Carbon', 'PPAs', 'Nuclear', 'SAF', 'Renewables',
  'Corporate & Commercial', 'Litigation & Dispute Resolution', 'Real Estate',
  'Employment', 'Banking & Finance', 'Energy & Infrastructure',
  'Intellectual Property', 'Private Client', 'Tax', 'Regulatory', 'Other',
];

const allCategories: MatterCategory[] = ['Live', 'Pipeline', 'Closed', 'Lost'];
const liveStages: MatterStage[] = ['Pre-Start', 'Term Sheet', 'Documentation - Start', 'Documentation - Close', 'Closing Process', 'Closed', 'Paused'];
const pipelineStages: MatterStage[] = ['Pending', 'Won', 'Lost'];
const allStages: MatterStage[] = [...liveStages, ...pipelineStages];
const feeTypes: FeeType[] = ['Discounted Rates with Cap', 'Discounted Rates with Estimate', 'Discounted Rates with Partial Cap', 'Rack Rates with Cap', 'Rack Rates with Estimate'];
const sources: MatterSource[] = ['RfP', 'Direct from Client', 'Internal Referral'];
const outcomes: PipelineOutcome[] = ['Won', 'Lost', 'Pending'];
const currencies = ['GBP', 'USD', 'EUR', 'Ringgit', 'CHF', 'AUD', 'CAD', 'SGD', 'SEK'];

// Inline editable component for multi-client matter details
interface EditableMatterClientsProps {
  matterClients: Array<{
    id: string;
    clients?: { name: string };
    cm_number: string | null;
    fee_percentage: number;
    is_master: boolean;
  }>;
  updateMatterClient: {
    mutateAsync: (input: UpdateMatterClientInput) => Promise<unknown>;
    isPending?: boolean;
  };
}

function EditableMatterClients({ matterClients, updateMatterClient }: EditableMatterClientsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCmNumber, setEditCmNumber] = useState('');
  const [editFeePercentage, setEditFeePercentage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = (mc: EditableMatterClientsProps['matterClients'][0]) => {
    setEditingId(mc.id);
    setEditCmNumber(mc.cm_number || '');
    setEditFeePercentage(mc.fee_percentage.toString());
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditCmNumber('');
    setEditFeePercentage('');
  };

  const saveChanges = async (mcId: string, originalCm: string | null, originalFee: number) => {
    const newCm = editCmNumber.trim() || null;
    const newFee = parseFloat(editFeePercentage) || 0;
    
    // Check if anything changed
    if (newCm === originalCm && newFee === originalFee) {
      cancelEditing();
      return;
    }

    setIsSaving(true);
    try {
      await updateMatterClient.mutateAsync({
        id: mcId,
        cm_number: newCm,
        fee_percentage: newFee,
      });
      toast.success('Client details updated');
      cancelEditing();
    } catch (error) {
      toast.error('Failed to update client details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {matterClients.map(mc => (
        <div key={mc.id} className="flex items-center gap-1 group">
          <span className="font-medium">{getClientDisplayName(mc.clients)}:</span>
          
          {editingId === mc.id ? (
            <>
              <Input
                value={editCmNumber}
                onChange={(e) => setEditCmNumber(e.target.value)}
                className="h-6 w-24 text-xs px-1"
                placeholder="C/M #"
              />
              <span className="mx-1">(</span>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={editFeePercentage}
                onChange={(e) => setEditFeePercentage(e.target.value)}
                className="h-6 w-14 text-xs px-1"
              />
              <span>%)</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-1"
                onClick={() => saveChanges(mc.id, mc.cm_number, mc.fee_percentage)}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-success" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={cancelEditing}
                disabled={isSaving}
              >
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </>
          ) : (
            <>
              <span>{mc.cm_number || '—'}</span>
              <span className="mx-1">({mc.fee_percentage}%)</span>
              {mc.is_master && <span className="text-primary text-xs">★ Master</span>}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => startEditing(mc)}
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default function MatterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: matter, isLoading: matterLoading } = useMatter(id!);
  const { deleteMatter, updateMatter } = useMatters();
  const { snapshots, upsertTodaySnapshot, deleteSnapshot } = useSnapshots(id);
  const { 
    proposals: wipProposals,
    activeProposals,
    archivedProposals,
    selectedProposal,
    createProposal,
    updateProposal,
    selectProposal,
    deleteProposal,
    archiveProposal,
  } = useWipShapingProposals(id);
  const { latestLineItems, versions: budgetVersions } = useBudgetVersions(id);
  const { amendments: budgetAmendments } = useBudgetAmendments(id);
  const { latestWipUpdate } = useDetailedWipUpdates(id);
  const { clients, isLoading: clientsLoading } = useClients();
  const { data: exchangeRatesData, refetch: refetchRates } = useExchangeRates();
  const { matterClients, updateMatterClient } = useMatterClients(id);
  const { 
    localCounsels, 
    updateLocalCounsel, 
    totalWip: lcTotalWip, 
    totalBilled: lcTotalBilled,
    totalAllocatedBudget: lcTotalAllocatedBudget,
    totalBurn: lcTotalBurn,
    isLoading: lcLoading 
  } = useLocalCounsels(id);

  // Calculate BM and LC WIP totals from budget line items (NOT from financial snapshots)
  const budgetLineItemTotals = useMemo(() => {
    // BM items
    const bmItems = latestLineItems.filter(item => item.provider === 'Baker McKenzie');
    const includedBmItems = bmItems.filter(item => !item.is_optional || item.is_included);
    
    const bmRawWip = includedBmItems.reduce((sum, item) => sum + (item.wip_amount || 0), 0);
    const bmWriteOff = includedBmItems.reduce((sum, item) => sum + (item.wip_write_off || 0), 0);
    const bmAdjustedWip = bmRawWip - bmWriteOff;
    
    // LC items (all non-BM providers)
    const lcItems = latestLineItems.filter(item => item.provider === 'Local Counsel');
    const includedLcItems = lcItems.filter(item => !item.is_optional || item.is_included);
    
    const lcRawWip = includedLcItems.reduce((sum, item) => sum + (item.wip_amount || 0), 0);
    const lcWriteOff = includedLcItems.reduce((sum, item) => sum + (item.wip_write_off || 0), 0);
    const lcAdjustedWip = lcRawWip - lcWriteOff;
    
    return { 
      bm: { rawWip: bmRawWip, writeOff: bmWriteOff, adjustedWip: bmAdjustedWip },
      lc: { rawWip: lcRawWip, writeOff: lcWriteOff, adjustedWip: lcAdjustedWip }
    };
  }, [latestLineItems]);
  
  // Fetch current user's profile for "Me" checkbox functionality
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showFinancialUpdateDialog, setShowFinancialUpdateDialog] = useState(false);
  const [showSnapshotHistory, setShowSnapshotHistory] = useState(false);
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [showProposalList, setShowProposalList] = useState(false);
  const [editingProposal, setEditingProposal] = useState<typeof selectedProposal>(null);
  
  // Highlight movements for individual matter
  const { highlightEnabled, toggleHighlight } = useMatterHighlightMovements(id || '');
  
  // Get previous snapshot for highlighting (second most recent snapshot)
  const previousSnapshot = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;
    // Snapshots are ordered by as_of_date desc, so [1] is the previous one
    return snapshots[1];
  }, [snapshots]);
  
  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Initialize form data when matter loads
  useEffect(() => {
    if (matter) {
      setFormData({
        client_id: matter.client_id,
        matter_name: matter.matter_name,
        matter_number: matter.matter_number,
        practice_area: matter.practice_area || '',
        aml_kyc_complete: matter.aml_kyc_complete || false,
        assignment_letter_signed: matter.assignment_letter_signed || false,
        matter_open: matter.matter_open || false,
        lead_partner: matter.lead_partner || '',
        start_date: matter.start_date || '',
        target_close_date: matter.target_close_date || '',
        currency: matter.currency,
        budget_type: matter.budget_type,
        agreed_budget_amount: matter.agreed_budget_amount,
        budget_notes: matter.budget_notes || '',
        fee_earner_mix_notes: matter.fee_earner_mix_notes || '',
        billing_terms: matter.billing_terms || '',
        category: matter.category || 'Live',
        current_stage: matter.current_stage || null,
        fee_amount_upper_end: matter.fee_amount_upper_end || 0,
        local_counsel_fee: matter.local_counsel_fee || 0,
        bm_fee_component: matter.bm_fee_component || 0,
        exchange_rate: matter.exchange_rate || 1.0,
        fee_currency: matter.fee_currency || 'GBP',
        fee_type: matter.fee_type || null,
        source: matter.source || null,
        originator: matter.originator || '',
        matter_managing_attorney: (matter as any).matter_managing_attorney || '',
        deal_currency: matter.deal_currency || '',
        deal_value: matter.deal_value || undefined,
        cm_number: matter.cm_number || '',
        conflicts_check: matter.conflicts_check || false,
        opportunity_receipt_date: matter.opportunity_receipt_date || '',
        clarifications_date: matter.clarifications_date || '',
        submission_deadline: matter.submission_deadline || '',
        submitted: matter.submitted || false,
        decision_date: matter.decision_date || '',
        pipeline_outcome: matter.pipeline_outcome || null,
        status: matter.status,
        // Billing currency fields
        different_billing_currency: matter.different_billing_currency || false,
        agreed_billing_amount: matter.agreed_billing_amount || 0,
        quote_currency: matter.quote_currency || matter.fee_currency || 'GBP',
        // Local counsel financial tracking
        local_counsel_billing: matter.local_counsel_billing || '',
        lc_wip: (matter as any).lc_wip || 0,
        lc_billed: (matter as any).lc_billed || 0,
        lc_last_updated: (matter as any).lc_last_updated || '',
        // Jurisdictions
        jurisdictions: (matter as any).jurisdictions || [],
        // Progress
        progress: (matter as any).progress || 0,
      });
      setHasChanges(false);
    }
  }, [matter]);

  // Auto-calculate BM fee component
  useEffect(() => {
    if (formData.fee_amount_upper_end !== undefined) {
      const feeUpper = formData.fee_amount_upper_end || 0;
      const localCounsel = formData.local_counsel_fee || 0;
      const newBmFee = feeUpper - localCounsel;
      if (formData.bm_fee_component !== newBmFee) {
        setFormData(prev => ({ ...prev, bm_fee_component: newBmFee }));
      }
    }
  }, [formData.fee_amount_upper_end, formData.local_counsel_fee]);

  // Auto-populate exchange rate when fee currency changes
  useEffect(() => {
    if (exchangeRatesData?.rates && formData.fee_currency && matter) {
      // Always force rate to 1 for same-currency (e.g., GBP to GBP)
      if (formData.fee_currency === 'GBP' && formData.exchange_rate !== 1) {
        setFormData(prev => ({ ...prev, exchange_rate: 1 }));
        setHasChanges(true);
        return;
      }
      
      // Only auto-update rate when currency changes
      const rate = getExchangeRate(exchangeRatesData.rates, formData.fee_currency);
      if (rate !== formData.exchange_rate && formData.fee_currency !== matter.fee_currency) {
        setFormData(prev => ({ ...prev, exchange_rate: rate }));
        setHasChanges(true);
      }
    }
  }, [formData.fee_currency, formData.exchange_rate, exchangeRatesData?.rates]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Use shared formatCurrency from currencyUtils - imported at top

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), 'dd MMM yyyy');
  };

  const handleSave = async () => {
    if (!matter) return;
    setIsSaving(true);
    
    try {
      // Compute status based on checkboxes: Open if all complete, ATTN (attention needed) otherwise
      const computedStatus = formData.aml_kyc_complete && formData.assignment_letter_signed && formData.matter_open
        ? 'Open' as const
        : 'On Hold' as const; // Database stores 'On Hold', displayed as 'ATTN'

      // Clean up empty date strings to null
      const cleanData = { ...formData };
      const dateFields = ['start_date', 'target_close_date', 'opportunity_receipt_date', 'clarifications_date', 'submission_deadline', 'decision_date', 'lc_last_updated'];
      dateFields.forEach(field => {
        if (cleanData[field] === '') {
          cleanData[field] = null;
        }
      });
      if (cleanData.deal_currency === '') cleanData.deal_currency = null;
      if (cleanData.local_counsel_billing === '') cleanData.local_counsel_billing = null;

      await updateMatter.mutateAsync({
        id: matter.id,
        ...cleanData,
        status: computedStatus,
      });
      
      setHasChanges(false);
      toast.success('Matter saved successfully');
    } catch (error) {
      toast.error('Failed to save matter');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMatter = async () => {
    await deleteMatter.mutateAsync(id!);
    navigate('/matters');
  };

  if (matterLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!matter) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <h2 className="text-xl font-medium text-foreground">Matter not found</h2>
          <Button asChild className="mt-4">
            <Link to="/matters">Back to Matters</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const latestSnapshot = snapshots[0];
  
  // Determine if we should show proposal values instead of real snapshot
  // Cast to any to access new show_shaping_proposal field (types will update after regeneration)
  const showProposalValues = (matter as any).show_shaping_proposal && selectedProposal;
  
  // Financial snapshots are stored in BILLING currency - no conversion needed
  // If showing proposal, use proposal values; otherwise use snapshot values
  const rawWipAmount = showProposalValues 
    ? selectedProposal.wip_amount 
    : (latestSnapshot?.wip_amount || 0);
  const wipWriteOffAmount = showProposalValues 
    ? selectedProposal.wip_write_off_amount 
    : (latestSnapshot?.wip_write_off_amount || 0);
  // Net WIP = raw WIP minus write-offs (write-offs reduce actual WIP)
  const wipAmount = rawWipAmount - wipWriteOffAmount;
  const billedAmount = showProposalValues 
    ? selectedProposal.billed_amount 
    : (latestSnapshot?.billed_amount || 0);
  const accountsReceivable = showProposalValues 
    ? selectedProposal.accounts_receivable 
    : (latestSnapshot?.accounts_receivable || 0);
  const paidAmount = showProposalValues 
    ? selectedProposal.paid_amount 
    : (latestSnapshot?.paid_amount || 0);
  
  // LC financial data - use aggregated data from useLocalCounsels hook
  const lcBillingMode = formData.local_counsel_billing || matter?.local_counsel_billing || '';
  const isLcDisbursement = lcBillingMode === 'Disb';
  
  // LC totals from hook (aggregated from matter_local_counsels table) - stored in billing currency
  const lcWip = lcTotalWip;
  const lcBilled = lcTotalBilled;
  
  // Calculate effective budget - account for billing currency conversion
  // The mandatedRate only applies to BUDGET figures (the original quote), NOT to financial snapshots
  const feeUpperEnd = formData.fee_amount_upper_end || matter.fee_amount_upper_end || 0;
  const agreedBillingAmount = formData.agreed_billing_amount || matter.agreed_billing_amount || 0;
  const differentBillingCurrency = formData.different_billing_currency ?? matter.different_billing_currency ?? false;
  const quoteCurrency = formData.quote_currency || matter.quote_currency || formData.fee_currency || matter.fee_currency || 'GBP';
  
  // Calculate mandated exchange rate if different billing currency is enabled
  // This rate ONLY applies to converting the original quote/budget figures, NOT financial snapshots
  const mandatedRate = (differentBillingCurrency && feeUpperEnd > 0 && agreedBillingAmount > 0)
    ? agreedBillingAmount / feeUpperEnd
    : 1;
  
  // Use effective values for display (in billing currency when applicable)
  const totalBudget = differentBillingCurrency && agreedBillingAmount > 0 
    ? agreedBillingAmount 
    : feeUpperEnd;
  const bmFee = differentBillingCurrency && agreedBillingAmount > 0
    ? (formData.bm_fee_component || matter.bm_fee_component || 0) * mandatedRate
    : (formData.bm_fee_component || matter.bm_fee_component || 0);
  const localCounsel = differentBillingCurrency && agreedBillingAmount > 0
    ? (formData.local_counsel_fee || matter.local_counsel_fee || 0) * mandatedRate
    : (formData.local_counsel_fee || matter.local_counsel_fee || 0);
  const currency = differentBillingCurrency && agreedBillingAmount > 0
    ? (formData.fee_currency || matter.fee_currency || 'GBP')
    : (formData.fee_currency || matter.fee_currency || 'GBP');
  
  // BM Budget Burn - use budget line item WIP data (NOT financial snapshots)
  // Convert from quote currency to billing currency if needed
  const bmWipFromBudget = differentBillingCurrency && agreedBillingAmount > 0
    ? budgetLineItemTotals.bm.adjustedWip * mandatedRate
    : budgetLineItemTotals.bm.adjustedWip;
  const bmWriteOffFromBudget = differentBillingCurrency && agreedBillingAmount > 0
    ? budgetLineItemTotals.bm.writeOff * mandatedRate
    : budgetLineItemTotals.bm.writeOff;
  const bmRawWipFromBudget = differentBillingCurrency && agreedBillingAmount > 0
    ? budgetLineItemTotals.bm.rawWip * mandatedRate
    : budgetLineItemTotals.bm.rawWip;
  
  // LC Budget Burn - use budget line item WIP data (NOT financial snapshots)
  const lcWipFromBudget = differentBillingCurrency && agreedBillingAmount > 0
    ? budgetLineItemTotals.lc.adjustedWip * mandatedRate
    : budgetLineItemTotals.lc.adjustedWip;
  const lcWriteOffFromBudget = differentBillingCurrency && agreedBillingAmount > 0
    ? budgetLineItemTotals.lc.writeOff * mandatedRate
    : budgetLineItemTotals.lc.writeOff;
  const lcRawWipFromBudget = differentBillingCurrency && agreedBillingAmount > 0
    ? budgetLineItemTotals.lc.rawWip * mandatedRate
    : budgetLineItemTotals.lc.rawWip;
  
  // BM Budget Burn = BM Adjusted WIP + AR + Total Paid
  // Each value is mutually exclusive: WIP → AR (when billed) → Paid (when collected)
  const bmTotalUsed = bmWipFromBudget + accountsReceivable + paidAmount;
  const bmHeadroom = bmFee - bmTotalUsed;
  const bmBudgetUsedPercent = bmFee > 0 ? (bmTotalUsed / bmFee) * 100 : 0;
  
  // LC Budget Burn = LC Adjusted WIP + LC Paid (using lcBilled as proxy for paid)
  // Note: LC tracking may need separate paid tracking in the future
  const lcTotalUsed = lcWipFromBudget + lcBilled;
  const lcHeadroom = localCounsel - lcTotalUsed;
  const lcBudgetUsedPercent = localCounsel > 0 ? (lcTotalUsed / localCounsel) * 100 : 0;
  
  // Total headroom = BM headroom + LC headroom
  const totalHeadroom = bmHeadroom + lcHeadroom;
  const totalUsed = bmTotalUsed + lcTotalUsed;
  const totalBudgetUsedPercent = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;
  
  const collectionRate = billedAmount > 0 ? (paidAmount / billedAmount) * 100 : 100;

  const isPipeline = formData.category === 'Pipeline';
  const relevantStages = formData.category === 'Pipeline' ? pipelineStages : formData.category === 'Live' ? liveStages : allStages;

  // Compute display status based on checkboxes for Live matters
  const displayStatus = isPipeline 
    ? (formData.status || matter.status) 
    : (formData.aml_kyc_complete && formData.assignment_letter_signed && formData.matter_open)
      ? 'Open'
      : 'On Hold'; // Will display as 'ATTN' via StatusBadge

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" asChild className="-ml-2">
              <Link to="/matters">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Show all clients for multi-client matters */}
                  {matterClients && matterClients.length > 1 ? (
                    <div className="flex flex-col min-w-0">
                      <span className="text-lg lg:text-xl font-heading font-bold text-foreground truncate">
                        {matterClients.map(mc => getClientDisplayName(mc.clients)).join(' / ')}
                      </span>
                      {/* Show full names if any differ from display names */}
                      {matterClients.some(mc => mc.clients?.display_name && mc.clients.display_name.trim() && mc.clients.display_name !== mc.clients.name) && (
                        <span className="text-xs text-muted-foreground truncate">
                          {matterClients.map(mc => mc.clients?.name).join(' / ')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col min-w-0">
                      <span className="text-lg lg:text-xl font-heading font-bold text-foreground truncate">
                        {getMatterClientDisplayName(matter)}
                      </span>
                      {/* Show full name if different from display name */}
                      {matter.clients?.display_name && matter.clients.display_name.trim() && matter.clients.display_name !== matter.clients.name && (
                        <span className="text-xs text-muted-foreground truncate">
                          {matter.clients.name}
                        </span>
                      )}
                    </div>
                  )}
                  <span className="text-lg lg:text-xl font-heading text-muted-foreground flex-shrink-0">–</span>
                </div>
                <Textarea
                  value={formData.matter_name || ''}
                  onChange={(e) => updateField('matter_name', e.target.value)}
                  className="text-lg lg:text-xl font-heading font-bold border-0 p-0 focus-visible:ring-0 bg-transparent w-full resize-none overflow-hidden"
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = el.scrollHeight + 'px';
                    }
                  }}
                />
              </div>
              {/* Show C/M number - for multi-client show editable fields */}
              <div className="flex items-center gap-3">
                {matterClients && matterClients.length > 1 ? (
                  <div className="text-sm text-muted-foreground">
                    <EditableMatterClients 
                      matterClients={matterClients} 
                      updateMatterClient={updateMatterClient}
                    />
                  </div>
                ) : (
                  <Input
                    value={formData.cm_number || ''}
                    onChange={(e) => updateField('cm_number', e.target.value)}
                    className="text-muted-foreground border-0 p-0 h-auto focus-visible:ring-0 bg-transparent w-48"
                    placeholder="C/M Number"
                  />
                )}
                <StatusBadge status={displayStatus} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 ml-10 sm:ml-0">
            {hasChanges && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Matter</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this matter and all associated data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteMatter} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Budget Overview & Financial Summary - only for non-pipeline matters */}
        {!isPipeline && (
          <>
            {/* Info icon explaining difference between Budget Overview and Financial Summary */}
            <div className="flex justify-center mb-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-primary/80 hover:text-primary hover:bg-primary/10 border border-primary/30 transition-colors">
                    <HelpCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Understanding the difference</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 text-sm" side="bottom">
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">Why might these figures differ?</p>
                    <p className="text-muted-foreground">
                      <strong>BM Financial Summary</strong> shows a top-down snapshot directly from the firm's billing system — it's always accurate to what's on the system.
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Budget Overview</strong> is built bottom-up from your budget utilisation updates. It's only as accurate as the WIP you've allocated to individual work streams.
                    </p>
                    <p className="text-muted-foreground">
                      In a perfect world, these match. If they don't, some WIP may be unallocated or misallocated in your budget utilisation.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
            {/* Budget overview */}
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-heading">Budget Overview</CardTitle>
                  {(formData as any).pay_full_time_costs ? (
                    <CardDescription className="text-xs text-muted-foreground">
                      Client pays full time costs
                    </CardDescription>
                  ) : formData.fee_type && (
                    <CardDescription className="text-xs text-muted-foreground">
                      {formData.fee_type}
                    </CardDescription>
                  )}
                </div>
                {!(formData as any).pay_full_time_costs && latestLineItems.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await exportBudgetToExcel({
                          items: latestLineItems,
                          matterName: (matter as any)?.matter_display_name || matter?.matter_name || 'Unknown Matter',
                          clientName: (matter?.clients as any)?.display_name || matter?.clients?.name || 'Unknown Client',
                          currency: currency,
                          versionNumber: undefined,
                          versionDate: undefined,
                          conversionRate: mandatedRate,
                        });
                        toast.success('Budget report exported successfully');
                      } catch (error) {
                        console.error('Export failed:', error);
                        toast.error('Failed to export budget report');
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Budget
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {(formData as any).pay_full_time_costs ? (
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-muted-foreground">
                      Budget tracking is disabled for this matter.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      The client has agreed to pay full time costs, so estimates and headroom are not applicable.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* BM Budget Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">BM Budget Used</span>
                        <span className={cn(
                          "font-medium",
                          bmBudgetUsedPercent > 100 && "text-danger",
                          bmBudgetUsedPercent >= 80 && bmBudgetUsedPercent <= 100 && "text-warning",
                          bmBudgetUsedPercent < 80 && "text-success"
                        )}>
                          {bmBudgetUsedPercent.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(bmBudgetUsedPercent, 100)} 
                        className={cn(
                          "h-3",
                          bmBudgetUsedPercent > 100 && "[&>div]:bg-danger",
                          bmBudgetUsedPercent >= 80 && bmBudgetUsedPercent <= 100 && "[&>div]:bg-warning",
                          bmBudgetUsedPercent < 80 && "[&>div]:bg-success"
                        )}
                      />
                    </div>

                    {/* Headroom Grid - now includes Budget Used */}
                    <div className={cn("grid gap-4", localCounsel > 0 ? "grid-cols-4" : "grid-cols-3")}>
                      {/* BM Budget Used - from budget line items */}
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">BM Budget Used</p>
                        <p className="text-xl font-heading font-bold text-foreground">
                          {formatCurrency(bmTotalUsed, currency)}
                        </p>
                        {/* Raw WIP, Write-off, Adjusted WIP breakdown */}
                        <div className="text-xs mt-1 space-y-0.5">
                          <p className="text-muted-foreground">
                            Raw WIP: {formatCurrency(bmRawWipFromBudget, currency)}
                          </p>
                          {bmWriteOffFromBudget > 0 && (
                            <p className="text-destructive">
                              Write-off: ({formatCurrency(bmWriteOffFromBudget, currency)})
                            </p>
                          )}
                          <p className="text-muted-foreground">
                            Adjusted: {formatCurrency(bmWipFromBudget, currency)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border/50">
                          {bmBudgetUsedPercent.toFixed(0)}% of {formatCurrency(bmFee, currency)}
                        </p>
                      </div>
                      <div className={cn(
                        "p-4 rounded-lg",
                        bmHeadroom < 0 ? "bg-danger/10" : "bg-success/10"
                      )}>
                        <p className="text-sm text-muted-foreground">BM Headroom</p>
                        <p className={cn(
                          "text-xl font-heading font-bold",
                          bmHeadroom < 0 ? "text-danger" : "text-success"
                        )}>
                          {formatCurrency(bmHeadroom, currency)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          of {formatCurrency(bmFee, currency)}
                        </p>
                      </div>
                      {localCounsel > 0 && (
                        <div className={cn(
                          "p-4 rounded-lg",
                          lcHeadroom < 0 ? "bg-danger/10" : isLcDisbursement ? "bg-success/10" : "bg-muted/50"
                        )}>
                          <p className="text-sm text-muted-foreground">LC Headroom</p>
                          <p className={cn(
                            "text-xl font-heading font-bold",
                            lcHeadroom < 0 ? "text-danger" : isLcDisbursement ? "text-success" : "text-muted-foreground"
                          )}>
                            {formatCurrency(lcHeadroom, currency)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            of {formatCurrency(localCounsel, currency)}
                            {!isLcDisbursement && lcBillingMode === 'Direct' && " (Direct)"}
                          </p>
                        </div>
                      )}
                      <div className={cn(
                        "p-4 rounded-lg",
                        totalHeadroom < 0 ? "bg-danger/10" : "bg-primary/10"
                      )}>
                        <p className="text-sm text-muted-foreground">Total Headroom</p>
                        <p className={cn(
                          "text-xl font-heading font-bold",
                          totalHeadroom < 0 ? "text-danger" : "text-primary"
                        )}>
                          {formatCurrency(totalHeadroom, currency)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          of {formatCurrency(totalBudget, currency)}
                        </p>
                      </div>
                    </div>

                    {/* Budget and Utilization Update Dates */}
                    <div className="pt-4 border-t border-border/50 space-y-2">
                      {/* Budget Date */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Budget:</span>
                        <span className="text-muted-foreground">
                          {budgetAmendments.length > 0 
                            ? `Updated ${formatDate(budgetAmendments[0].amendment_date)}`
                            : budgetVersions.length > 0
                              ? 'Original budget'
                              : 'No budget set'
                          }
                        </span>
                      </div>
                      
                      {/* Utilization Update Date */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Utilisation:</span>
                        <span className="text-muted-foreground">
                          {latestWipUpdate 
                            ? `Updated ${formatDate(latestWipUpdate.updated_at)}`
                            : 'No utilisation recorded'
                          }
                        </span>
                      </div>
                      
                      {/* Staleness Warning - show if utilization is >1 month older than financial snapshot */}
                      {(() => {
                        if (!latestWipUpdate || !latestSnapshot) return null;
                        
                        const wipDate = new Date(latestWipUpdate.updated_at);
                        const snapshotDate = new Date(latestSnapshot.updated_at);
                        const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
                        
                        if (snapshotDate.getTime() - wipDate.getTime() > oneMonthMs) {
                          return (
                            <p className="text-xs text-destructive mt-2">
                              ⚠️ Budget utilisation is over a month older than the latest financial snapshot
                            </p>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* WIP Discrepancy Warning - show if budget utilization WIP differs from snapshot WIP by >5% */}
                      {(() => {
                        // Only show if a budget utilization update exists
                        if (!latestWipUpdate) return null;
                        
                        // Get the BM raw WIP from budget utilization (already converted to billing currency)
                        const budgetUtilizationWip = bmRawWipFromBudget;
                        // Get the raw WIP from financial snapshot (in billing currency)
                        const snapshotWip = rawWipAmount;
                        
                        // Don't show warning if budget utilization WIP is zero - means no actual detailed update was done
                        if (budgetUtilizationWip === 0) return null;
                        
                        // Don't show warning if both are zero
                        if (budgetUtilizationWip === 0 && snapshotWip === 0) return null;
                        
                        // Calculate percentage difference relative to the larger value
                        const maxWip = Math.max(budgetUtilizationWip, snapshotWip);
                        const difference = Math.abs(budgetUtilizationWip - snapshotWip);
                        const percentDiff = maxWip > 0 ? (difference / maxWip) * 100 : 0;
                        
                        if (percentDiff > 5) {
                          return (
                            <p className="text-sm font-bold text-destructive mt-3 animate-pulse">
                              ⚠️ Warning: Budget utilisation raw WIP ({formatCurrency(budgetUtilizationWip, currency)}) differs from financial snapshot ({formatCurrency(snapshotWip, currency)}) by {percentDiff.toFixed(0)}%
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* BM Financial Summary */}
            <Card className={cn(
              "shadow-card transition-all",
              showProposalValues && "ring-2 ring-amber-500/50 bg-amber-500/5"
            )}>
              <CardHeader className="flex flex-row items-center justify-between relative">
                {/* Floating proposal indicator - positioned absolutely to avoid layout shift */}
                {showProposalValues && (
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 text-xs font-normal px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full z-10">
                    Showing with proposal
                  </span>
                )}
                <div>
                  <CardTitle className="text-lg font-heading">
                    BM Financial Summary
                  </CardTitle>
                  {latestSnapshot && !showProposalValues && (
                    <CardDescription>
                      Updated {formatDate(latestSnapshot.updated_at)}
                    </CardDescription>
                  )}
                  {showProposalValues && selectedProposal && (
                    <CardDescription className="text-amber-600 dark:text-amber-400">
                      Proposal from {formatDate(selectedProposal.proposal_date)}
                    </CardDescription>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div className="flex gap-2 flex-wrap justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowSnapshotHistory(true)}
                    >
                      <History className="h-4 w-4 mr-2" />
                      History
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => setShowFinancialUpdateDialog(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Update Snapshot
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setEditingProposal(null);
                        setShowProposalDialog(true);
                      }}
                      className="border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                    >
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Add WIP Shaping Proposal
                    </Button>
                  </div>
                  {/* Proposals toggle */}
                  {activeProposals.length > 0 && (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowProposalList(true)}
                        className="text-xs h-7"
                      >
                        <Lightbulb className="h-3 w-3 mr-1" />
                        {activeProposals.length} Proposal{activeProposals.length !== 1 ? 's' : ''}
                      </Button>
                      {selectedProposal && (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="show-proposal-toggle"
                            checked={(matter as any).show_shaping_proposal || false}
                            onCheckedChange={async (checked) => {
                              await supabase
                                .from('matters')
                                .update({ show_shaping_proposal: !!checked })
                                .eq('id', matter.id);
                              queryClient.invalidateQueries({ queryKey: ['matter', id] });
                              queryClient.invalidateQueries({ queryKey: ['matters'] });
                            }}
                            className="h-4 w-4"
                          />
                          <label 
                            htmlFor="show-proposal-toggle" 
                            className="text-xs text-muted-foreground cursor-pointer"
                          >
                            Show proposal figures
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="highlight-movements-matter"
                      checked={highlightEnabled}
                      onCheckedChange={(checked) => toggleHighlight(!!checked)}
                      className="h-4 w-4"
                    />
                    <label 
                      htmlFor="highlight-movements-matter" 
                      className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      Highlight Recent Movements
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  // Determine if values changed compared to previous snapshot
                  // For individual matter page: highlight ANY figure that has ever changed
                  // If there's a previous snapshot, compare against it
                  // If there's only one snapshot, highlight any non-zero value (it "changed" from nothing)
                  const hasPrevious = !!previousSnapshot;
                  
                  // Current raw values from latest snapshot
                  const currentWip = latestSnapshot?.wip_amount || 0;
                  const currentWipWriteOff = latestSnapshot?.wip_write_off_amount || 0;
                  const currentAr = latestSnapshot?.accounts_receivable || 0;
                  const currentBilled = latestSnapshot?.billed_amount || 0;
                  const currentPaid = latestSnapshot?.paid_amount || 0;
                  
                  // Compare raw values from snapshots (not converted values) to check for actual changes
                  // If no previous snapshot exists, highlight any non-zero value
                  const wipChanged = highlightEnabled && latestSnapshot && (
                    hasPrevious 
                      ? currentWip !== previousSnapshot.wip_amount
                      : currentWip !== 0
                  );
                  const arChanged = highlightEnabled && latestSnapshot && (
                    hasPrevious 
                      ? currentAr !== previousSnapshot.accounts_receivable
                      : currentAr !== 0
                  );
                  const billedChanged = highlightEnabled && latestSnapshot && (
                    hasPrevious 
                      ? currentBilled !== previousSnapshot.billed_amount
                      : currentBilled !== 0
                  );
                  const paidChanged = highlightEnabled && latestSnapshot && (
                    hasPrevious 
                      ? currentPaid !== previousSnapshot.paid_amount
                      : currentPaid !== 0
                  );
                  const writeOffChanged = highlightEnabled && latestSnapshot && (
                    hasPrevious 
                      ? currentWipWriteOff !== previousSnapshot.wip_write_off_amount
                      : currentWipWriteOff !== 0
                  );
                  
                  // Previous snapshot values for display in tooltip
                  // Financial snapshots are stored in billing currency - no conversion needed
                  // If no previous snapshot, show 0 as the "previous" value
                  const prevWipDisplay = hasPrevious 
                    ? previousSnapshot.wip_amount - previousSnapshot.wip_write_off_amount
                    : 0;
                  const prevArDisplay = hasPrevious 
                    ? previousSnapshot.accounts_receivable
                    : 0;
                  const prevBilledDisplay = hasPrevious 
                    ? previousSnapshot.billed_amount
                    : 0;
                  const prevPaidDisplay = hasPrevious 
                    ? previousSnapshot.paid_amount
                    : 0;
                  const prevWriteOffDisplay = hasPrevious 
                    ? previousSnapshot.wip_write_off_amount
                    : 0;
                  
                  // Previous date - use previous snapshot date if available, otherwise use latest snapshot date
                  const prevDate = hasPrevious ? previousSnapshot.as_of_date : latestSnapshot?.as_of_date;
                  
                  return (
                    <>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-muted-foreground">BM Budget Burn</span>
                        {(() => {
                          // Use financial snapshot figures: WIP + AR + Paid
                          const financialBmUsed = wipAmount + accountsReceivable + paidAmount;
                          const financialBmBurnPercent = bmFee > 0 ? (financialBmUsed / bmFee) * 100 : 0;
                          
                          // Color bands: green (0-50%), yellow (50-75%), orange (75-90%), red (90%+)
                          const colorClass = financialBmBurnPercent >= 90 
                            ? "text-destructive" 
                            : financialBmBurnPercent >= 75 
                              ? "text-orange-500" 
                              : financialBmBurnPercent >= 50 
                                ? "text-yellow-500" 
                                : "text-success";
                          
                          return (
                            <span className={cn("text-lg font-semibold", colorClass)}>
                              {financialBmBurnPercent.toFixed(0)}%
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <div>
                          <span className="text-muted-foreground">BM Work in Progress</span>
                          {wipWriteOffAmount > 0 && (
                            <div className="text-xs text-destructive">
                              (Write-off: <HighlightedFinancialValue
                                currentValue={formatCurrency(wipWriteOffAmount, currency)}
                                previousValue={prevWriteOffDisplay}
                                previousDate={prevDate}
                                isHighlighted={!!writeOffChanged}
                                className=""
                                formatFn={(v) => formatCurrency(v, currency)}
                              />)
                            </div>
                          )}
                        </div>
                        <HighlightedFinancialValue
                          currentValue={formatCurrency(wipAmount, currency)}
                          previousValue={prevWipDisplay}
                          previousDate={prevDate}
                          isHighlighted={!!wipChanged}
                          className="text-lg font-semibold"
                          formatFn={(v) => formatCurrency(v, currency)}
                        />
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-muted-foreground">Accounts Receivable</span>
                        <HighlightedFinancialValue
                          currentValue={formatCurrency(accountsReceivable, currency)}
                          previousValue={prevArDisplay}
                          previousDate={prevDate}
                          isHighlighted={!!arChanged}
                          className="text-lg font-semibold"
                          formatFn={(v) => formatCurrency(v, currency)}
                        />
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-muted-foreground">Total Billed</span>
                        <HighlightedFinancialValue
                          currentValue={formatCurrency(billedAmount, currency)}
                          previousValue={prevBilledDisplay}
                          previousDate={prevDate}
                          isHighlighted={!!billedChanged}
                          className="text-lg font-semibold"
                          formatFn={(v) => formatCurrency(v, currency)}
                        />
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-muted-foreground">Total Paid</span>
                        <HighlightedFinancialValue
                          currentValue={formatCurrency(paidAmount, currency)}
                          previousValue={prevPaidDisplay}
                          previousDate={prevDate}
                          isHighlighted={!!paidChanged}
                          className="text-lg font-semibold text-success"
                          formatFn={(v) => formatCurrency(v, currency)}
                        />
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-muted-foreground">Collection Rate</span>
                        <span className={cn(
                          "text-lg font-semibold",
                          collectionRate >= 80 && "text-success",
                          collectionRate >= 60 && collectionRate < 80 && "text-warning",
                          collectionRate < 60 && "text-danger"
                        )}>
                          {collectionRate.toFixed(1)}%
                        </span>
                      </div>
                    </>
                  );
                })()}
                
                {/* Budget Burn Reference */}
                <div className="pt-2 border-t border-dashed space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Budget Burn (from Financial Snapshot)</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Budget</span>
                      <p className="font-medium">{formatCurrency(bmFee, currency)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Used</span>
                      <p className="font-medium">{formatCurrency(wipAmount + billedAmount, currency)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Burn</span>
                      <p className={cn(
                        "font-medium",
                        bmFee > 0 && ((wipAmount + billedAmount) / bmFee) * 100 > 100 && "text-danger",
                        bmFee > 0 && ((wipAmount + billedAmount) / bmFee) * 100 >= 80 && ((wipAmount + billedAmount) / bmFee) * 100 <= 100 && "text-warning",
                        bmFee > 0 && ((wipAmount + billedAmount) / bmFee) * 100 < 80 && "text-success"
                      )}>
                        {bmFee > 0 ? (((wipAmount + billedAmount) / bmFee) * 100).toFixed(0) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </>
        )}

        {/* Financial Snapshot Update Dialog - outside the conditional grid but still checks for non-pipeline */}
        {!isPipeline && (
          <FinancialSnapshotUpdateDialog
            isOpen={showFinancialUpdateDialog}
            onClose={() => setShowFinancialUpdateDialog(false)}
            currency={currency}
            matterName={(matter as any).matter_display_name || matter.matter_name}
            differentBillingCurrency={differentBillingCurrency}
            quoteCurrency={quoteCurrency}
            localCounsels={localCounsels.map(lc => ({
              id: lc.id,
              firm_name: lc.firm_name,
              wip_amount: lc.wip_amount || 0,
              billed_amount: lc.billed_amount || 0,
              billing_mode: lc.billing_mode,
            }))}
            currentValues={{
              // Financial snapshots are stored in billing currency - no conversion needed
              wip_amount: rawWipAmount,
              wip_write_off_amount: wipWriteOffAmount,
              billed_amount: billedAmount,
              accounts_receivable: accountsReceivable,
              paid_amount: paidAmount,
            }}
            onSave={async (data) => {
              // Financial snapshots are stored directly in billing currency - no conversion needed
              const wipToStore = data.wip_amount;
              const writeOffToStore = data.wip_write_off_amount;
              const billedToStore = data.billed_amount;
              const arToStore = data.accounts_receivable;
              const paidToStore = data.paid_amount;
              
              const today = new Date().toISOString().split('T')[0];
              const { data: existing } = await supabase
                .from('financial_snapshots')
                .select('*')
                .eq('matter_id', id!)
                .eq('as_of_date', today)
                .maybeSingle();

              if (existing) {
                await supabase
                  .from('financial_snapshots')
                  .update({
                    wip_amount: wipToStore,
                    wip_write_off_amount: writeOffToStore,
                    billed_amount: billedToStore,
                    accounts_receivable: arToStore,
                    paid_amount: paidToStore,
                    notes: data.notes,
                    updated_at: new Date().toISOString(),
                    update_source: 'manual', // Mark as manual update
                  })
                  .eq('id', existing.id);
              } else {
                await supabase
                  .from('financial_snapshots')
                  .insert({
                    matter_id: id!,
                    user_id: user!.id,
                    as_of_date: today,
                    wip_amount: wipToStore,
                    wip_write_off_amount: writeOffToStore,
                    billed_amount: billedToStore,
                    accounts_receivable: arToStore,
                    paid_amount: paidToStore,
                    notes: data.notes,
                    update_source: 'manual', // Mark as manual update
                  });
              }

              // Update local counsels if provided
              if (data.localCounsels && data.localCounsels.length > 0) {
                for (const lcUpdate of data.localCounsels) {
                  await updateLocalCounsel.mutateAsync({
                    id: lcUpdate.id,
                    wip_amount: lcUpdate.wip_amount,
                    billed_amount: lcUpdate.billed_amount,
                    last_updated: today,
                  });
                }
              }

              // Invalidate queries
              queryClient.invalidateQueries({ queryKey: ['snapshots', id] });
              queryClient.invalidateQueries({ queryKey: ['matter', id] });
              queryClient.invalidateQueries({ queryKey: ['matters'] });
              queryClient.invalidateQueries({ queryKey: ['localCounsels', id] });
              toast.success('Financial snapshot updated');
            }}
          />
        )}

        {/* Financial Snapshot History Modal */}
        {!isPipeline && (
          <FinancialSnapshotHistoryModal
            isOpen={showSnapshotHistory}
            onClose={() => setShowSnapshotHistory(false)}
            snapshots={snapshots}
            currency={currency}
            onDelete={async (snapshotId) => {
              await deleteSnapshot.mutateAsync(snapshotId);
            }}
          />
        )}

        {/* WIP Shaping Proposal Dialog */}
        {!isPipeline && (
          <WipShapingProposalDialog
            isOpen={showProposalDialog}
            onClose={() => {
              setShowProposalDialog(false);
              setEditingProposal(null);
            }}
            currency={currency}
            matterName={(matter as any).matter_display_name || matter.matter_name}
            differentBillingCurrency={differentBillingCurrency}
            quoteCurrency={quoteCurrency}
            existingProposal={editingProposal}
            hasLocalCounsel={localCounsel > 0}
            currentValues={{
              wip_amount: latestSnapshot?.wip_amount || 0,
              wip_write_off_amount: latestSnapshot?.wip_write_off_amount || 0,
              billed_amount: latestSnapshot?.billed_amount || 0,
              accounts_receivable: latestSnapshot?.accounts_receivable || 0,
              paid_amount: latestSnapshot?.paid_amount || 0,
              lc_wip_amount: lcTotalWip || 0,
              lc_billed_amount: lcTotalBilled || 0,
            }}
            onSave={async (data) => {
              if (editingProposal) {
                await updateProposal.mutateAsync({
                  id: editingProposal.id,
                  ...data,
                });
              } else {
                await createProposal.mutateAsync({
                  matter_id: id!,
                  ...data,
                });
              }
            }}
          />
        )}

        {/* WIP Shaping Proposal List */}
        {!isPipeline && (
          <WipShapingProposalList
            isOpen={showProposalList}
            onClose={() => setShowProposalList(false)}
            activeProposals={activeProposals}
            archivedProposals={archivedProposals}
            selectedProposal={selectedProposal}
            currency={currency}
            onSelect={(proposalId) => selectProposal.mutateAsync(proposalId)}
            onArchive={(proposalId) => archiveProposal.mutateAsync(proposalId)}
            onDelete={(proposalId) => deleteProposal.mutateAsync(proposalId)}
            onEdit={(proposal) => {
              setEditingProposal(proposal);
              setShowProposalList(false);
              setShowProposalDialog(true);
            }}
          />
        )}

        {/* Local Counsels Financial Summary - show when LC fee exists */}
        {!isPipeline && localCounsel > 0 && (
          <Card className={cn(
            "shadow-card border-l-4 border-l-primary transition-all",
            showProposalValues && "ring-2 ring-amber-500/50 bg-amber-500/5"
          )}>
            <CardHeader className="relative">
              {/* Floating proposal indicator for LC */}
              {showProposalValues && (
                <span className="absolute top-2 right-4 text-xs font-normal px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full z-10">
                  WIP Proposal
                </span>
              )}
              <CardTitle className="text-lg font-heading">Local Counsels Financial Summary</CardTitle>
              <CardDescription>
                {localCounsels.length > 0 
                  ? `${localCounsels.length} local counsel firm${localCounsels.length > 1 ? 's' : ''}`
                  : 'No local counsel firms configured yet'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lcLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : localCounsels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add local counsel work items in the Budget section to track their financials here.
                </p>
              ) : (
                <>
                  {/* Per-firm breakdown */}
                  <div className="space-y-4">
                    {localCounsels.map((lc) => {
                      const firmBurn = (lc.wip_amount || 0) + (lc.billed_amount || 0);
                      const firmBudgetPercent = lc.allocated_budget > 0 ? (firmBurn / lc.allocated_budget) * 100 : 0;
                      const hasSelection = lc.billing_mode === 'Disb' || lc.billing_mode === 'Direct';
                      const isLcDisbursementMode = lc.billing_mode === 'Disb';
                      
                      return (
                        <div key={lc.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <h4 className="font-medium text-sm">{lc.firm_name}</h4>
                              {/* Per-LC billing mode checkboxes */}
                              <div className="flex items-center gap-2">
                                <label 
                                  className={cn(
                                    "flex items-center gap-1 cursor-pointer text-xs",
                                    hasSelection ? "text-success" : "text-destructive"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={lc.billing_mode === 'Disb'}
                                    onChange={() => {
                                      const newValue = lc.billing_mode === 'Disb' ? null : 'Disb';
                                      updateLocalCounsel.mutate({
                                        id: lc.id,
                                        billing_mode: newValue,
                                      });
                                    }}
                                    className={cn(
                                      "h-3 w-3 rounded-sm border cursor-pointer accent-current",
                                      lc.billing_mode === 'Disb' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                                    )}
                                  />
                                  Disb
                                </label>
                                <label 
                                  className={cn(
                                    "flex items-center gap-1 cursor-pointer text-xs",
                                    hasSelection ? "text-success" : "text-destructive"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={lc.billing_mode === 'Direct'}
                                    onChange={() => {
                                      const newValue = lc.billing_mode === 'Direct' ? null : 'Direct';
                                      updateLocalCounsel.mutate({
                                        id: lc.id,
                                        billing_mode: newValue,
                                      });
                                    }}
                                    className={cn(
                                      "h-3 w-3 rounded-sm border cursor-pointer accent-current",
                                      lc.billing_mode === 'Direct' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                                    )}
                                  />
                                  Direct
                                </label>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Budget: {formatCurrency(lc.allocated_budget, currency)}
                            </span>
                          </div>
                          {/* Display WIP/Billed/Burn for disbursement mode (read-only - update via snapshot) */}
                          {isLcDisbursementMode && (
                            <div className="grid sm:grid-cols-3 gap-3 text-sm">
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">WIP</span>
                                <p className="font-medium">{formatCurrency(lc.wip_amount || 0, currency)}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Billed</span>
                                <p className="font-medium">{formatCurrency(lc.billed_amount || 0, currency)}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Last Updated</span>
                                <p className="font-medium text-muted-foreground">
                                  {lc.last_updated ? format(new Date(lc.last_updated), 'dd MMM yyyy') : '—'}
                                </p>
                              </div>
                            </div>
                          )}
                          {isLcDisbursementMode && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Burn</span>
                              <span className={cn(
                                "font-medium",
                                firmBudgetPercent > 100 && "text-danger",
                                firmBudgetPercent >= 80 && firmBudgetPercent <= 100 && "text-warning",
                                firmBudgetPercent < 80 && "text-success"
                              )}>
                                {formatCurrency(firmBurn, currency)} ({firmBudgetPercent.toFixed(0)}%)
                              </span>
                            </div>
                          )}
                          {!hasSelection && (
                            <p className="text-xs text-destructive">
                              Please select billing method (Disb or Direct)
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Total LC summary - only for disbursement LCs */}
                  {localCounsels.some(lc => lc.billing_mode === 'Disb') && (
                    <div className={cn(
                      "flex justify-between items-center py-3 rounded-lg px-4",
                      showProposalValues ? "bg-amber-100/50 dark:bg-amber-900/20" : "bg-muted/50"
                    )}>
                      <div>
                        <span className="text-muted-foreground font-medium">Total LC Budget Burn (Disb only)</span>
                        {showProposalValues && selectedProposal && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Proposal: WIP {formatCurrency(selectedProposal.lc_wip_amount || 0, currency)} + Billed {formatCurrency(selectedProposal.lc_billed_amount || 0, currency)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {(() => {
                          const displayLcWip = showProposalValues && selectedProposal ? (selectedProposal.lc_wip_amount || 0) : lcTotalWip;
                          const displayLcBilled = showProposalValues && selectedProposal ? (selectedProposal.lc_billed_amount || 0) : lcTotalBilled;
                          const displayLcTotal = displayLcWip + displayLcBilled;
                          const displayLcPercent = localCounsel > 0 ? (displayLcTotal / localCounsel) * 100 : 0;
                          return (
                            <>
                              <span className={cn(
                                "text-lg font-semibold",
                                displayLcPercent > 100 && "text-danger",
                                displayLcPercent >= 80 && displayLcPercent <= 100 && "text-warning",
                                displayLcPercent < 80 && "text-success"
                              )}>
                                {displayLcPercent.toFixed(1)}%
                              </span>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(displayLcTotal, currency)} of {formatCurrency(localCounsel, currency)}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
        {/* Financial Trends Chart - only for non-pipeline matters with snapshots */}
        {!isPipeline && snapshots && snapshots.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Financial Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={(() => {
                      // Sort snapshots by date and format for chart
                      const sortedSnapshots = [...snapshots]
                        .sort((a, b) => a.as_of_date.localeCompare(b.as_of_date))
                        .map(snap => ({
                          date: format(new Date(snap.as_of_date), 'MMM d'),
                          wip: snap.wip_amount || 0,
                          ar: snap.billed_amount || 0,
                          paid: snap.paid_amount || 0,
                        }));
                      return sortedSnapshots;
                    })()}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis 
                      className="text-xs" 
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                        return value.toString();
                      }}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value, currency)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                      }}
                    />
                    <Legend />
                    <ReferenceLine 
                      y={bmFee} 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{ 
                        value: 'BM Budget', 
                        position: 'right',
                        fill: 'hsl(var(--destructive))',
                        fontSize: 12
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="wip" 
                      name="WIP"
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-3))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ar" 
                      name="Total Billed"
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-1))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="paid" 
                      name="Total Paid"
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category & Status */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Category & Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => updateField('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Progress</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.progress || 0}
                      onChange={(e) => updateField('progress', parseInt(e.target.value))}
                      className="flex-1 h-2 bg-secondary rounded-full appearance-none cursor-pointer transition-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
                    />
                    <span className="text-sm font-medium min-w-[40px] tabular-nums">{formData.progress || 0}%</span>
                  </div>
                  {(() => {
                    const progress = formData.progress || 0;
                    const currentBurn = (latestSnapshot?.wip_amount || 0) + (latestSnapshot?.accounts_receivable || 0) + (latestSnapshot?.paid_amount || 0);
                    const estimatedToClose = progress > 0 && progress < 100
                      ? Math.round((currentBurn / progress) * (100 - progress))
                      : 0;
                    const currency = formData.fee_currency || 'GBP';
                    
                    if (progress > 0 && progress < 100 && estimatedToClose > 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          Estimated budget to close: <span className="font-medium text-foreground">{formatCurrency(estimatedToClose, currency)}</span>
                        </p>
                      );
                    }
                    if (progress === 100) {
                      return <p className="text-sm text-green-600 font-medium">Deal complete</p>;
                    }
                    if (progress === 0 && currentBurn > 0) {
                      return <p className="text-sm text-muted-foreground">Set progress to estimate budget to close</p>;
                    }
                    return null;
                  })()}
                </div>
              </div>
              {/* Hide C/M Number for pipeline matters */}
              {!isPipeline && (
                <div className="space-y-2">
                  <Label>C/M Number</Label>
                  <Input value={formData.cm_number || ''} onChange={(e) => updateField('cm_number', e.target.value)} placeholder="e.g., 51339685" />
                </div>
              )}
            </div>

            {/* Hide onboarding status for pipeline matters */}
            {!isPipeline && (
              <div className="space-y-3">
                <Label>Onboarding Status</Label>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="aml_kyc_complete" checked={formData.aml_kyc_complete} onCheckedChange={(checked) => updateField('aml_kyc_complete', checked === true)} />
                    <Label htmlFor="aml_kyc_complete" className="font-normal cursor-pointer">AML/KYC Complete</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="assignment_letter_signed" checked={formData.assignment_letter_signed} onCheckedChange={(checked) => updateField('assignment_letter_signed', checked === true)} />
                    <Label htmlFor="assignment_letter_signed" className="font-normal cursor-pointer">Assignment Letter Signed</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="matter_open" checked={formData.matter_open} onCheckedChange={(checked) => updateField('matter_open', checked === true)} />
                    <Label htmlFor="matter_open" className="font-normal cursor-pointer">Matter Open</Label>
                  </div>
                  {formData.aml_kyc_complete && formData.assignment_letter_signed && formData.matter_open && (
                    <span className="text-sm text-green-600 font-medium">✓ Fully Open</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Client{matter.is_multi_client ? 's' : ''}</Label>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    asChild
                  >
                    <Link to={`/matters/${id}/edit`}>
                      {matter.is_multi_client ? 'Add/Edit Clients' : 'Convert to Multi-Client'}
                    </Link>
                  </Button>
                </div>
                {matter.is_multi_client && matterClients && matterClients.length > 0 ? (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                    {matterClients.map((mc) => (
                      <div key={mc.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{mc.clients?.name}</span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>{mc.cm_number || '—'}</span>
                          <span>({mc.fee_percentage}%)</span>
                          {mc.is_master && <span className="text-primary text-xs">★</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Select value={formData.client_id} onValueChange={(v) => updateField('client_id', v)} disabled={clientsLoading}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>{getClientDisplayName(client)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Practice Area</Label>
                <Select value={formData.practice_area || ''} onValueChange={(v) => updateField('practice_area', v)}>
                  <SelectTrigger><SelectValue placeholder="Select practice area" /></SelectTrigger>
                  <SelectContent>
                    {practiceAreas.map((pa) => (
                      <SelectItem key={pa} value={pa}>{pa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Billing Partner</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={formData.lead_partner || ''} 
                    onChange={(e) => updateField('lead_partner', e.target.value)} 
                    placeholder="e.g., James Wyatt"
                    className="flex-1"
                  />
                  {userProfile?.full_name && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Checkbox 
                        id="billing_partner_me"
                        checked={formData.lead_partner === userProfile.full_name}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            updateField('lead_partner', userProfile.full_name);
                          } else {
                            updateField('lead_partner', '');
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="billing_partner_me" className="text-xs font-normal cursor-pointer whitespace-nowrap">Me</Label>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>MMA</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={formData.matter_managing_attorney || ''} 
                    onChange={(e) => updateField('matter_managing_attorney', e.target.value)} 
                    placeholder="Matter Managing Attorney"
                    className="flex-1"
                  />
                  {userProfile?.full_name && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Checkbox 
                        id="mma_me"
                        checked={formData.matter_managing_attorney === userProfile.full_name}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            updateField('matter_managing_attorney', userProfile.full_name);
                          } else {
                            updateField('matter_managing_attorney', '');
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="mma_me" className="text-xs font-normal cursor-pointer whitespace-nowrap">Me</Label>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Hide start date and target close date for pipeline matters */}
            {!isPipeline && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <ClearableDateInput value={formData.start_date || ''} onChange={(value) => updateField('start_date', value)} />
                </div>
                <div className="space-y-2">
                  <Label>Target Close Date</Label>
                  <ClearableDateInput value={formData.target_close_date || ''} onChange={(value) => updateField('target_close_date', value)} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Jurisdictions of Project</Label>
              <JurisdictionsMultiSelect
                value={formData.jurisdictions || []}
                onChange={(value) => updateField('jurisdictions', value)}
                placeholder="Select countries..."
              />
              <p className="text-xs text-muted-foreground">
                Select one or more countries where this project is located
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Fee Structure */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Fee Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Fee Type</Label>
                <Select value={formData.fee_type || ''} onValueChange={(v) => updateField('fee_type', v || null)}>
                  <SelectTrigger><SelectValue placeholder="Select fee type" /></SelectTrigger>
                  <SelectContent>
                    {feeTypes.map((ft) => (
                      <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fee Currency</Label>
                <Select value={formData.fee_currency} onValueChange={(v) => updateField('fee_currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Exchange Rate to GBP</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    step="0.0001" 
                    value={formData.exchange_rate || ''} 
                    onChange={(e) => updateField('exchange_rate', parseFloat(e.target.value) || 0)} 
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => refetchRates()} title="Refresh rates">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Section - only for non-pipeline matters */}
        {!isPipeline && (
          <BudgetSection matterId={id!} currency={currency} />
        )}

        {/* Assumptions Section - only for non-pipeline matters */}
        {!isPipeline && (
          <Collapsible defaultOpen={false} className="group">
            <CollapsibleTrigger className="w-full">
              <Card className="shadow-card hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <CardTitle className="text-lg font-heading">Assumptions</CardTitle>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <AssumptionsSection matterId={id!} />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Pipeline Information (conditionally shown) */}
        {isPipeline && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Pipeline Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={formData.source || ''} onValueChange={(v) => updateField('source', v || null)}>
                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      {sources.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pipeline Outcome</Label>
                  <Select value={formData.pipeline_outcome || ''} onValueChange={(v) => updateField('pipeline_outcome', v || null)}>
                    <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
                    <SelectContent>
                      {outcomes.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deal Currency</Label>
                  <Select value={formData.deal_currency || ''} onValueChange={(v) => updateField('deal_currency', v)}>
                    <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deal Value</Label>
                  <Input type="number" value={formData.deal_value || ''} onChange={(e) => updateField('deal_value', parseFloat(e.target.value) || null)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Opportunity Receipt</Label>
                  <ClearableDateInput value={formData.opportunity_receipt_date || ''} onChange={(value) => updateField('opportunity_receipt_date', value)} />
                </div>
                <div className="space-y-2">
                  <Label>Clarifications Date</Label>
                  <ClearableDateInput value={formData.clarifications_date || ''} onChange={(value) => updateField('clarifications_date', value)} />
                </div>
                <div className="space-y-2">
                  <Label>Submission Deadline</Label>
                  <ClearableDateInput value={formData.submission_deadline || ''} onChange={(value) => updateField('submission_deadline', value)} />
                </div>
                <div className="space-y-2">
                  <Label>Decision Date</Label>
                  <ClearableDateInput value={formData.decision_date || ''} onChange={(value) => updateField('decision_date', value)} />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="submitted" checked={formData.submitted} onCheckedChange={(checked) => updateField('submitted', checked === true)} />
                <Label htmlFor="submitted" className="font-normal cursor-pointer">Submitted</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="conflicts_check" checked={formData.conflicts_check} onCheckedChange={(checked) => updateField('conflicts_check', checked === true)} />
                <Label htmlFor="conflicts_check" className="font-normal cursor-pointer">Conflicts Check Complete</Label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Billing Terms</Label>
              <Textarea value={formData.billing_terms || ''} onChange={(e) => updateField('billing_terms', e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Other Notes</Label>
              <Textarea value={formData.fee_earner_mix_notes || ''} onChange={(e) => updateField('fee_earner_mix_notes', e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Save Button at Bottom */}
        {hasChanges && (
          <div className="sticky bottom-6 flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} size="lg" className="shadow-lg">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
