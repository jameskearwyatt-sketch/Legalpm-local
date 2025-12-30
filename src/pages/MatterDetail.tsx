import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
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
import { useMatter, useMatters, MatterCategory, MatterStage, FeeType, MatterSource, PipelineOutcome } from '@/lib/hooks/useMatters';
import { useSnapshots } from '@/lib/hooks/useSnapshots';
import { useBudgetAmendments } from '@/lib/hooks/useBudgetAmendments';
import { useClients } from '@/lib/hooks/useClients';
import { useExchangeRates, getExchangeRate } from '@/lib/hooks/useExchangeRates';
import { useMatterClients, UpdateMatterClientInput } from '@/lib/hooks/useMatterClients';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  History,
  Save,
  RefreshCw,
  Pencil,
  Check,
  X
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
const currencies = ['GBP', 'USD', 'EUR', 'Ringgit', 'CHF', 'AUD', 'CAD', 'SGD'];

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
  const { data: matter, isLoading: matterLoading } = useMatter(id!);
  const { deleteMatter, updateMatter } = useMatters();
  const { snapshots } = useSnapshots(id);
  const { amendments, isLoading: amendmentsLoading } = useBudgetAmendments(id);
  const { clients, isLoading: clientsLoading } = useClients();
  const { data: exchangeRatesData, refetch: refetchRates } = useExchangeRates();
  const { matterClients, updateMatterClient } = useMatterClients(id);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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

  const formatCurrency = (value: number, currency: string = 'GBP') => {
    const currencySymbols: Record<string, string> = {
      'GBP': '£', 'USD': '$', 'EUR': '€', 'Ringgit': 'RM', 'CHF': 'CHF ', 'AUD': 'A$', 'CAD': 'C$', 'SGD': 'S$'
    };
    const symbol = currencySymbols[currency] || currency + ' ';
    return `${symbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

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
      const dateFields = ['start_date', 'target_close_date', 'opportunity_receipt_date', 'clarifications_date', 'submission_deadline', 'decision_date'];
      dateFields.forEach(field => {
        if (cleanData[field] === '') {
          cleanData[field] = null;
        }
      });
      if (cleanData.deal_currency === '') cleanData.deal_currency = null;

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
  
  // Use fee_amount_upper_end as the budget, not agreed_budget_amount
  const budget = formData.fee_amount_upper_end || matter.fee_amount_upper_end || 0;
  const bmFee = formData.bm_fee_component || matter.bm_fee_component || 0;
  const localCounsel = formData.local_counsel_fee || matter.local_counsel_fee || 0;
  // Total budget burn = WIP + AR (Billed) only - paid amounts are a subset of billed, not additional spend
  const totalUsed = wipAmount + billedAmount;
  const remainingBudget = budget - totalUsed;
  const budgetUsedPercent = budget > 0 ? (totalUsed / budget) * 100 : 0;
  const collectionRate = billedAmount > 0 ? (paidAmount / billedAmount) * 100 : 100;
  const currency = formData.fee_currency || matter.fee_currency || 'GBP';

  const isPipeline = formData.category === 'Pipeline';
  const relevantStages = formData.category === 'Pipeline' ? pipelineStages : formData.category === 'Live' ? liveStages : allStages;

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
                <StatusBadge status={formData.status || matter.status} />
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
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Budget Used</span>
                    <span className={cn(
                      "font-medium",
                      budgetUsedPercent > 100 && "text-danger",
                      budgetUsedPercent >= 80 && budgetUsedPercent <= 100 && "text-warning",
                      budgetUsedPercent < 80 && "text-success"
                    )}>
                      {budgetUsedPercent.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(budgetUsedPercent, 100)} 
                    className={cn(
                      "h-3",
                      budgetUsedPercent > 100 && "[&>div]:bg-danger",
                      budgetUsedPercent >= 80 && budgetUsedPercent <= 100 && "[&>div]:bg-warning",
                      budgetUsedPercent < 80 && "[&>div]:bg-success"
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Total Budget</p>
                    <p className="text-xl font-heading font-bold">{formatCurrency(budget, currency)}</p>
                  </div>
                  <div className={cn(
                    "p-4 rounded-lg",
                    remainingBudget < 0 ? "bg-danger/10" : "bg-success/10"
                  )}>
                    <p className="text-sm text-muted-foreground">Remaining</p>
                    <p className={cn(
                      "text-xl font-heading font-bold",
                      remainingBudget < 0 ? "text-danger" : "text-success"
                    )}>
                      {formatCurrency(remainingBudget, currency)}
                    </p>
                  </div>
                </div>

                {/* BM Fee and Local Counsel breakdown */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">BM Fee Component</span>
                    <span className="font-medium">{formatCurrency(bmFee, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Local Counsel</span>
                    <span className="font-medium">{formatCurrency(localCounsel, currency)}</span>
                  </div>
                </div>

                {/* Budget History Collapsible */}
                <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <History className="mr-2 h-4 w-4" />
                      Budget History
                      <ChevronDown className={cn(
                        "ml-auto h-4 w-4 transition-transform",
                        isHistoryOpen && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    {amendmentsLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : amendments && amendments.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {amendments.map((amendment) => (
                          <div key={amendment.id} className="p-3 rounded-lg bg-muted/30 text-sm space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{formatDate(amendment.amendment_date)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Budget:</span>
                                <span className="ml-1">
                                  {formatCurrency(amendment.previous_budget, currency)} → {formatCurrency(amendment.new_budget, currency)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">BM:</span>
                                <span className="ml-1">
                                  {formatCurrency(amendment.previous_bm_fee, currency)} → {formatCurrency(amendment.new_bm_fee, currency)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">LC:</span>
                                <span className="ml-1">
                                  {formatCurrency(amendment.previous_local_counsel, currency)} → {formatCurrency(amendment.new_local_counsel, currency)}
                                </span>
                              </div>
                            </div>
                            {amendment.notes && (
                              <p className="text-xs text-muted-foreground italic mt-1">{amendment.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No budget amendments recorded yet.
                      </p>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg font-heading">Financial Summary</CardTitle>
                {latestSnapshot && (
                  <CardDescription>
                    As of {formatDate(latestSnapshot.as_of_date)}
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
                <Label>Client</Label>
                <Select value={formData.client_id} onValueChange={(v) => updateField('client_id', v)} disabled={clientsLoading}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label>Lead Partner</Label>
                <Input value={formData.lead_partner || ''} onChange={(e) => updateField('lead_partner', e.target.value)} placeholder="e.g., James Wyatt" />
              </div>
              <div className="space-y-2">
                <Label>Originator</Label>
                <Input value={formData.originator || ''} onChange={(e) => updateField('originator', e.target.value)} />
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
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Budget (Total Fee)</Label>
                <Input 
                  type="number" 
                  value={formData.fee_amount_upper_end || ''} 
                  onChange={(e) => updateField('fee_amount_upper_end', parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Local Counsel Fee</Label>
                <Input 
                  type="number" 
                  value={formData.local_counsel_fee || ''} 
                  onChange={(e) => updateField('local_counsel_fee', parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="space-y-2">
                <Label>BM Fee Component</Label>
                <Input 
                  type="number" 
                  value={formData.bm_fee_component || ''} 
                  readOnly
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Auto-calculated: Budget - Local Counsel</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <Label>Budget Notes</Label>
              <Textarea value={formData.budget_notes || ''} onChange={(e) => updateField('budget_notes', e.target.value)} rows={3} />
            </div>
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
