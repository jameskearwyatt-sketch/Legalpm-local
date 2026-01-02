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
import { BudgetSection } from '@/components/matters/BudgetSection';
import { AssumptionsSection } from '@/components/matters/AssumptionsSection';
import { useClients } from '@/lib/hooks/useClients';
import { useExchangeRates, getExchangeRate } from '@/lib/hooks/useExchangeRates';
import { formatCurrency } from '@/lib/currencyUtils';
import { useMatterClients, UpdateMatterClientInput } from '@/lib/hooks/useMatterClients';
import { useLocalCounsels } from '@/lib/hooks/useLocalCounsels';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
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
import { 
  ArrowLeft, 
  Trash2, 
  Loader2,
  Save,
  RefreshCw,
  Pencil,
  Check,
  X,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
          <span className="font-medium">{mc.clients?.name}:</span>
          
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
                step="0.1"
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
  const { user } = useAuth();
  const { data: matter, isLoading: matterLoading } = useMatter(id!);
  const { deleteMatter, updateMatter } = useMatters();
  const { snapshots } = useSnapshots(id);
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
      const rate = getExchangeRate(exchangeRatesData.rates, formData.fee_currency);
      if (rate !== formData.exchange_rate && formData.fee_currency !== matter.fee_currency) {
        setFormData(prev => ({ ...prev, exchange_rate: rate }));
        setHasChanges(true);
      }
    }
  }, [formData.fee_currency, exchangeRatesData?.rates]);

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
  const wipAmount = latestSnapshot?.wip_amount || 0;
  const billedAmount = latestSnapshot?.billed_amount || 0;
  const paidAmount = latestSnapshot?.paid_amount || 0;
  
  // LC financial data - use aggregated data from useLocalCounsels hook
  const lcBillingMode = formData.local_counsel_billing || matter?.local_counsel_billing || '';
  const isLcDisbursement = lcBillingMode === 'Disb';
  
  // LC totals from hook (aggregated from matter_local_counsels table)
  const lcWip = lcTotalWip;
  const lcBilled = lcTotalBilled;
  
  // Calculate effective budget - account for billing currency conversion
  const feeUpperEnd = formData.fee_amount_upper_end || matter.fee_amount_upper_end || 0;
  const agreedBillingAmount = formData.agreed_billing_amount || matter.agreed_billing_amount || 0;
  const differentBillingCurrency = formData.different_billing_currency ?? matter.different_billing_currency ?? false;
  const quoteCurrency = formData.quote_currency || matter.quote_currency || formData.fee_currency || matter.fee_currency || 'GBP';
  
  // Calculate mandated exchange rate if different billing currency is enabled
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
  
  // BM Budget Burn = BM WIP + BM Billed (from snapshots - this is BM only)
  const bmTotalUsed = wipAmount + billedAmount;
  const bmHeadroom = bmFee - bmTotalUsed;
  const bmBudgetUsedPercent = bmFee > 0 ? (bmTotalUsed / bmFee) * 100 : 0;
  
  // LC Budget Burn = LC WIP + LC Billed (from aggregated local counsels)
  const lcTotalUsed = lcWip + lcBilled;
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
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <div className="flex items-center gap-2">
                  {/* Show all clients for multi-client matters */}
                  {matterClients && matterClients.length > 1 ? (
                    <span className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
                      {matterClients.map(mc => mc.clients?.name).join(' / ')}
                    </span>
                  ) : (
                    <span className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
                      {matter.clients?.name}
                    </span>
                  )}
                  <span className="text-2xl lg:text-3xl font-heading text-muted-foreground">–</span>
                  <Input
                    value={formData.matter_name || ''}
                    onChange={(e) => updateField('matter_name', e.target.value)}
                    className="text-2xl lg:text-3xl font-heading font-bold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
                  />
                </div>
                <StatusBadge status={displayStatus} />
              </div>
              {/* Show C/M number - for multi-client show editable fields */}
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
          <div className="grid md:grid-cols-2 gap-6">
            {/* Budget overview */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg font-heading">Budget Overview</CardTitle>
                {formData.fee_type && (
                  <CardDescription className="text-xs text-muted-foreground">
                    {formData.fee_type}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
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

                {/* Headroom Grid */}
                <div className={cn("grid gap-4", localCounsel > 0 ? "grid-cols-3" : "grid-cols-2")}>
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

              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg font-heading">Financial Summary</CardTitle>
                {latestSnapshot && (
                  <CardDescription>
                    Updated {formatDate(latestSnapshot.updated_at)}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-muted-foreground">Work in Progress</span>
                  <span className="text-lg font-semibold">{formatCurrency(wipAmount, currency)}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-muted-foreground">AR (Billed)</span>
                  <span className="text-lg font-semibold">{formatCurrency(billedAmount, currency)}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="text-lg font-semibold text-success">{formatCurrency(paidAmount, currency)}</span>
                </div>
                <div className="flex justify-between items-center py-3">
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* Local Counsel Financials - only show when LC fee exists and billing mode is Disbursement */}
        {!isPipeline && localCounsel > 0 && isLcDisbursement && (
          <Card className="shadow-card border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Local Counsel Financials</CardTitle>
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
                      
                      return (
                        <div key={lc.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium text-sm">{lc.firm_name}</h4>
                            <span className="text-xs text-muted-foreground">
                              Budget: {formatCurrency(lc.allocated_budget, currency)}
                            </span>
                          </div>
                          <div className="grid sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">WIP</Label>
                              <Input
                                type="number"
                                value={lc.wip_amount || ''}
                                onChange={(e) => {
                                  updateLocalCounsel.mutate({
                                    id: lc.id,
                                    wip_amount: parseFloat(e.target.value) || 0,
                                    last_updated: new Date().toISOString().split('T')[0],
                                  });
                                }}
                                placeholder="0"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Billed</Label>
                              <Input
                                type="number"
                                value={lc.billed_amount || ''}
                                onChange={(e) => {
                                  updateLocalCounsel.mutate({
                                    id: lc.id,
                                    billed_amount: parseFloat(e.target.value) || 0,
                                    last_updated: new Date().toISOString().split('T')[0],
                                  });
                                }}
                                placeholder="0"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Last Updated</Label>
                              <ClearableDateInput 
                                value={lc.last_updated || ''} 
                                onChange={(value) => {
                                  updateLocalCounsel.mutate({
                                    id: lc.id,
                                    last_updated: value || null,
                                  });
                                }}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
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
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Total LC summary */}
                  <div className="flex justify-between items-center py-3 bg-muted/50 rounded-lg px-4">
                    <span className="text-muted-foreground font-medium">Total LC Budget Burn</span>
                    <div className="text-right">
                      <span className={cn(
                        "text-lg font-semibold",
                        lcBudgetUsedPercent > 100 && "text-danger",
                        lcBudgetUsedPercent >= 80 && lcBudgetUsedPercent <= 100 && "text-warning",
                        lcBudgetUsedPercent < 80 && "text-success"
                      )}>
                        {lcBudgetUsedPercent.toFixed(1)}%
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(lcTotalUsed, currency)} of {formatCurrency(localCounsel, currency)}
                      </p>
                    </div>
                  </div>
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
                      name="AR"
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-1))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="paid" 
                      name="Paid"
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
                <Label>Current Stage</Label>
                <Select value={formData.current_stage || ''} onValueChange={(v) => updateField('current_stage', v || null)}>
                  <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                  <SelectContent>
                    {relevantStages.map((stage) => (
                      <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
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
          <Collapsible defaultOpen={false} className="group">
            <CollapsibleTrigger className="w-full">
              <Card className="shadow-card hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <CardTitle className="text-lg font-heading">Budget</CardTitle>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <BudgetSection matterId={id!} currency={currency} />
            </CollapsibleContent>
          </Collapsible>
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
              <Label>Fee Earner Mix Notes</Label>
              <Textarea value={formData.fee_earner_mix_notes || ''} onChange={(e) => updateField('fee_earner_mix_notes', e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Billing Terms</Label>
              <Textarea value={formData.billing_terms || ''} onChange={(e) => updateField('billing_terms', e.target.value)} rows={3} />
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
