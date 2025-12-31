import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClearableDateInput } from '@/components/ui/clearable-date-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMatters, useMatter, CreateMatterInput, MatterCategory, MatterStage, FeeType, MatterSource, PipelineOutcome } from '@/lib/hooks/useMatters';
import { useClients } from '@/lib/hooks/useClients';
import { useExchangeRates, getExchangeRate } from '@/lib/hooks/useExchangeRates';
import { useMatterClients } from '@/lib/hooks/useMatterClients';
import { MultiClientSection, ClientAllocation } from '@/components/matters/MultiClientSection';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const matterSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  matter_name: z.string().min(1, 'Matter name is required').max(200),
  matter_number: z.string().max(50).default('AUTO'), // Auto-generated, no longer user input
  practice_area: z.string().optional(),
  aml_kyc_complete: z.boolean().default(false),
  assignment_letter_signed: z.boolean().default(false),
  matter_open: z.boolean().default(false),
  lead_partner: z.string().optional(),
  start_date: z.string().optional(),
  target_close_date: z.string().optional(),
  currency: z.string().default('GBP'),
  budget_type: z.enum(['Fixed', 'Cap', 'Estimate', 'Retainer', 'Hourly']).default('Fixed'),
  agreed_budget_amount: z.number().min(0, 'Budget must be 0 or greater').default(0),
  budget_notes: z.string().optional(),
  fee_earner_mix_notes: z.string().optional(),
  billing_terms: z.string().optional(),
  // New fields
  category: z.enum(['Live', 'Pipeline']).default('Live'),
  current_stage: z.enum(['Term Sheet', 'Documentation - Start', 'Documentation - Close', 'Closing Process', 'Closed', 'Paused', 'Pending', 'Won', 'Lost']).nullable().optional(),
  fee_amount_upper_end: z.number().min(0).default(0),
  local_counsel_fee: z.number().min(0).default(0),
  bm_fee_component: z.number().min(0).default(0),
  exchange_rate: z.number().min(0).default(1.0),
  fee_currency: z.string().default('GBP'),
  fee_type: z.enum(['Discounted Rates with Cap', 'Discounted Rates with Estimate', 'Discounted Rates with Partial Cap', 'Rack Rates with Cap', 'Rack Rates with Estimate']).nullable().optional(),
  source: z.enum(['RfP', 'Direct from Client', 'Internal Referral']).nullable().optional(),
  originator: z.string().optional(),
  deal_currency: z.string().optional(),
  deal_value: z.number().nullable().optional(),
  cm_number: z.string().optional(),
  conflicts_check: z.boolean().default(false),
  opportunity_receipt_date: z.string().optional(),
  clarifications_date: z.string().optional(),
  submission_deadline: z.string().optional(),
  submitted: z.boolean().default(false),
  decision_date: z.string().optional(),
  pipeline_outcome: z.enum(['Won', 'Lost', 'Pending']).nullable().optional(),
});

const practiceAreas = [
  'Voluntary Carbon',
  'PPAs',
  'Nuclear',
  'SAF',
  'Renewables',
  'Corporate & Commercial',
  'Litigation & Dispute Resolution',
  'Real Estate',
  'Employment',
  'Banking & Finance',
  'Energy & Infrastructure',
  'Intellectual Property',
  'Private Client',
  'Tax',
  'Regulatory',
  'Other',
];

const newMatterCategories: MatterCategory[] = ['Live', 'Pipeline'];
const liveStages: MatterStage[] = ['Pre-Start', 'Term Sheet', 'Documentation - Start', 'Documentation - Close', 'Closing Process', 'Closed', 'Paused'];
const pipelineStages: MatterStage[] = ['Pending', 'Won', 'Lost'];
const feeTypes: FeeType[] = ['Discounted Rates with Cap', 'Discounted Rates with Estimate', 'Discounted Rates with Partial Cap', 'Rack Rates with Cap', 'Rack Rates with Estimate'];
const sources: MatterSource[] = ['RfP', 'Direct from Client', 'Internal Referral'];
const outcomes: PipelineOutcome[] = ['Won', 'Lost', 'Pending'];
const currencies = ['GBP', 'USD', 'EUR', 'Ringgit', 'CHF', 'AUD', 'CAD', 'SGD', 'SEK'];
const allCategories: MatterCategory[] = ['Live', 'Pipeline', 'Closed', 'Lost'];
const allStages: MatterStage[] = ['Pre-Start', 'Term Sheet', 'Documentation - Start', 'Documentation - Close', 'Closing Process', 'Closed', 'Paused', 'Pending', 'Won', 'Lost'];

export default function MatterForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  
  const { data: existingMatter, isLoading: matterLoading } = useMatter(id || '');
  const { createMatter, updateMatter } = useMatters();
  const { clients, isLoading: clientsLoading } = useClients();
  const { data: exchangeRatesData, isLoading: ratesLoading, refetch: refetchRates } = useExchangeRates();
  const { matterClients, saveMatterClients } = useMatterClients(id);

  // Multi-client state
  const [isMultiClient, setIsMultiClient] = useState(false);
  const [clientAllocations, setClientAllocations] = useState<ClientAllocation[]>([]);

  const [formData, setFormData] = useState<Partial<CreateMatterInput>>({
    client_id: '',
    matter_name: '',
    matter_number: '',
    practice_area: '',
    aml_kyc_complete: false,
    assignment_letter_signed: false,
    matter_open: false,
    lead_partner: '',
    start_date: '',
    target_close_date: '',
    currency: 'GBP',
    budget_type: 'Fixed',
    agreed_budget_amount: 0,
    budget_notes: '',
    fee_earner_mix_notes: '',
    billing_terms: '',
    // New fields
    category: 'Live',
    current_stage: null,
    fee_amount_upper_end: 0,
    local_counsel_fee: 0,
    bm_fee_component: 0,
    exchange_rate: 1.0,
    fee_currency: 'GBP',
    fee_type: null,
    source: null,
    originator: '',
    deal_currency: '',
    deal_value: undefined,
    cm_number: '',
    conflicts_check: false,
    opportunity_receipt_date: '',
    clarifications_date: '',
    submission_deadline: '',
    submitted: false,
    decision_date: '',
    pipeline_outcome: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing matter data
  useEffect(() => {
    if (existingMatter) {
      setFormData({
        client_id: existingMatter.client_id,
        matter_name: existingMatter.matter_name,
        matter_number: existingMatter.matter_number,
        practice_area: existingMatter.practice_area || '',
        aml_kyc_complete: existingMatter.aml_kyc_complete || false,
        assignment_letter_signed: existingMatter.assignment_letter_signed || false,
        matter_open: existingMatter.matter_open || false,
        lead_partner: existingMatter.lead_partner || '',
        start_date: existingMatter.start_date || '',
        target_close_date: existingMatter.target_close_date || '',
        currency: existingMatter.currency,
        budget_type: existingMatter.budget_type,
        agreed_budget_amount: existingMatter.agreed_budget_amount,
        budget_notes: existingMatter.budget_notes || '',
        fee_earner_mix_notes: existingMatter.fee_earner_mix_notes || '',
        billing_terms: existingMatter.billing_terms || '',
        category: existingMatter.category || 'Live',
        current_stage: existingMatter.current_stage || null,
        fee_amount_upper_end: existingMatter.fee_amount_upper_end || 0,
        local_counsel_fee: existingMatter.local_counsel_fee || 0,
        bm_fee_component: existingMatter.bm_fee_component || 0,
        exchange_rate: existingMatter.exchange_rate || 1.0,
        fee_currency: existingMatter.fee_currency || 'GBP',
        fee_type: existingMatter.fee_type || null,
        source: existingMatter.source || null,
        originator: existingMatter.originator || '',
        deal_currency: existingMatter.deal_currency || '',
        deal_value: existingMatter.deal_value || undefined,
        cm_number: existingMatter.cm_number || '',
        conflicts_check: existingMatter.conflicts_check || false,
        opportunity_receipt_date: existingMatter.opportunity_receipt_date || '',
        clarifications_date: existingMatter.clarifications_date || '',
        submission_deadline: existingMatter.submission_deadline || '',
        submitted: existingMatter.submitted || false,
        decision_date: existingMatter.decision_date || '',
        pipeline_outcome: existingMatter.pipeline_outcome || null,
      });
      // Set multi-client flag from matter
      setIsMultiClient((existingMatter as any).is_multi_client || false);
    }
  }, [existingMatter]);

  // Load existing matter client allocations
  useEffect(() => {
    if (matterClients && matterClients.length > 0) {
      setClientAllocations(
        matterClients.map(mc => ({
          client_id: mc.client_id,
          cm_number: mc.cm_number || '',
          is_master: mc.is_master,
          fee_percentage: mc.fee_percentage,
        }))
      );
      setIsMultiClient(true);
    }
  }, [matterClients]);

  // Auto-calculate BM fee component
  useEffect(() => {
    const feeUpper = formData.fee_amount_upper_end || 0;
    const localCounsel = formData.local_counsel_fee || 0;
    setFormData(prev => ({
      ...prev,
      bm_fee_component: feeUpper - localCounsel
    }));
  }, [formData.fee_amount_upper_end, formData.local_counsel_fee]);

  // Auto-populate exchange rate when fee currency changes
  useEffect(() => {
    if (exchangeRatesData?.rates && formData.fee_currency) {
      const rate = getExchangeRate(exchangeRatesData.rates, formData.fee_currency);
      // Round to 4 decimal places to avoid database precision issues
      const roundedRate = Math.round(rate * 10000) / 10000;
      if (roundedRate !== formData.exchange_rate) {
        setFormData(prev => ({ ...prev, exchange_rate: roundedRate }));
      }
    }
  }, [formData.fee_currency, exchangeRatesData?.rates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Validate multi-client if enabled
      if (isMultiClient) {
        if (clientAllocations.length === 0) {
          setErrors({ client_id: 'At least one client is required for multi-client matters' });
          return;
        }
        
        const totalPercentage = clientAllocations.reduce((sum, a) => sum + (a.fee_percentage || 0), 0);
        if (Math.abs(totalPercentage - 100) > 0.01) {
          setErrors({ client_id: 'Fee percentages must total 100%' });
          return;
        }
        
        if (!clientAllocations.some(a => a.is_master)) {
          setErrors({ client_id: 'One client must be designated as the master matter' });
          return;
        }
        
        const masterClient = clientAllocations.find(a => a.is_master);
        if (masterClient && !masterClient.cm_number) {
          setErrors({ client_id: 'Master matter must have a C/M number' });
          return;
        }
        
        if (clientAllocations.some(a => !a.client_id)) {
          setErrors({ client_id: 'All client allocations must have a client selected' });
          return;
        }
      }

      // Compute status based on checkboxes: Open if all complete, On Hold (displayed as ATTN) otherwise
      const computedStatus = formData.aml_kyc_complete && formData.assignment_letter_signed && formData.matter_open
        ? 'Open' as const
        : 'On Hold' as const;
      
      // For multi-client, set client_id to the master client
      let dataToValidate = { ...formData };
      if (isMultiClient) {
        const masterClient = clientAllocations.find(a => a.is_master);
        dataToValidate.client_id = masterClient?.client_id || '';
        dataToValidate.cm_number = masterClient?.cm_number || '';
      }
      
      // Auto-generate matter_number if not set (using cm_number or timestamp)
      if (!dataToValidate.matter_number || dataToValidate.matter_number === '') {
        dataToValidate.matter_number = dataToValidate.cm_number || `MAT-${Date.now()}`;
      }
      
      const validated = matterSchema.parse(dataToValidate);
      
      // Convert empty string dates to null to avoid database syntax errors
      const cleanDates = (data: any) => ({
        ...data,
        start_date: data.start_date || null,
        target_close_date: data.target_close_date || null,
        opportunity_receipt_date: data.opportunity_receipt_date || null,
        clarifications_date: data.clarifications_date || null,
        submission_deadline: data.submission_deadline || null,
        decision_date: data.decision_date || null,
        // Also ensure exchange_rate is rounded
        exchange_rate: Math.round((data.exchange_rate || 1) * 10000) / 10000,
      });
      
      const dataToSubmit = cleanDates({ 
        ...validated, 
        status: computedStatus,
        is_multi_client: isMultiClient,
      });
      setIsSubmitting(true);

      if (isEditing) {
        await updateMatter.mutateAsync({ id, ...dataToSubmit });
        
        // Save multi-client allocations
        if (isMultiClient) {
          await saveMatterClients.mutateAsync({
            matterId: id!,
            clients: clientAllocations.map(a => ({
              matter_id: id!,
              client_id: a.client_id,
              cm_number: a.cm_number || null,
              is_master: a.is_master,
              fee_percentage: a.fee_percentage,
            })),
          });
        } else {
          // Clear any existing multi-client allocations
          await saveMatterClients.mutateAsync({ matterId: id!, clients: [] });
        }
        
        navigate(`/matters/${id}`);
      } else {
        const result = await createMatter.mutateAsync(dataToSubmit as CreateMatterInput);
        
        // Save multi-client allocations for new matter
        if (isMultiClient && result.id) {
          await saveMatterClients.mutateAsync({
            matterId: result.id,
            clients: clientAllocations.map(a => ({
              matter_id: result.id,
              client_id: a.client_id,
              cm_number: a.cm_number || null,
              is_master: a.is_master,
              fee_percentage: a.fee_percentage,
            })),
          });
        }
        
        navigate(`/matters/${result.id}`);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const isPipeline = formData.category === 'Pipeline';

  if (isEditing && matterLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link to={isEditing ? `/matters/${id}` : '/matters'}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {isEditing ? 'Edit Matter' : 'New Matter'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update matter details' : 'Create a new legal matter or pipeline opportunity'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category & Status */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Category & Status</CardTitle>
              <CardDescription>What type of matter is this?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => updateField('category', v as MatterCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(isEditing ? allCategories : newMatterCategories).map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Only show C/M Number here for single-client matters and non-pipeline */}
                {!isMultiClient && !isPipeline && (
                  <div className="space-y-2">
                    <Label htmlFor="cm_number">C/M Number</Label>
                    <Input
                      id="cm_number"
                      value={formData.cm_number}
                      onChange={(e) => updateField('cm_number', e.target.value)}
                      placeholder="e.g., 51339685"
                    />
                  </div>
                )}
              </div>

              {/* Current Stage - only show when editing */}
              {isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="current_stage">Current Stage</Label>
                  <Select
                    value={formData.current_stage || ''}
                    onValueChange={(v) => updateField('current_stage', v || null)}
                  >
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {(formData.category === 'Pipeline' ? pipelineStages : formData.category === 'Live' ? liveStages : allStages).map((stage) => (
                        <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Only show onboarding status for non-pipeline matters */}
              {!isPipeline && (
                <div className="space-y-3">
                  <Label>Onboarding Status</Label>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="aml_kyc_complete"
                        checked={formData.aml_kyc_complete}
                        onCheckedChange={(checked) => updateField('aml_kyc_complete', checked === true)}
                      />
                      <Label htmlFor="aml_kyc_complete" className="font-normal cursor-pointer">
                        AML/KYC Complete
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="assignment_letter_signed"
                        checked={formData.assignment_letter_signed}
                        onCheckedChange={(checked) => updateField('assignment_letter_signed', checked === true)}
                      />
                      <Label htmlFor="assignment_letter_signed" className="font-normal cursor-pointer">
                        Assignment Letter Signed
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="matter_open"
                        checked={formData.matter_open}
                        onCheckedChange={(checked) => updateField('matter_open', checked === true)}
                      />
                      <Label htmlFor="matter_open" className="font-normal cursor-pointer">
                        Matter Open
                      </Label>
                    </div>
                    {formData.aml_kyc_complete && formData.assignment_letter_signed && formData.matter_open && (
                      <span className="text-sm text-green-600 font-medium">✓ Fully Open</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Multi-Client Section - at top of form */}
          <MultiClientSection
            isMultiClient={isMultiClient}
            onMultiClientChange={(value) => {
              setIsMultiClient(value);
              if (value && clientAllocations.length === 0) {
                // Add first client allocation when enabling multi-client
                setClientAllocations([{
                  client_id: formData.client_id || '',
                  cm_number: formData.cm_number || '',
                  is_master: true,
                  fee_percentage: 100,
                }]);
              }
            }}
            clientAllocations={clientAllocations}
            onAllocationsChange={setClientAllocations}
            clients={clients}
            clientsLoading={clientsLoading}
            singleClientId={formData.client_id || ''}
            onSingleClientChange={(v) => updateField('client_id', v)}
            singleClientError={errors.client_id}
            onClientCreated={() => {
              // Clients list will auto-refresh via React Query
              // Toast is shown by ClientForm
            }}
          />

          {/* Basic Info */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Basic Information</CardTitle>
              <CardDescription>Core details about the matter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="matter_name">Matter Name *</Label>
                  <Input
                    id="matter_name"
                    value={formData.matter_name}
                    onChange={(e) => updateField('matter_name', e.target.value)}
                    placeholder="e.g., Project Kheti"
                    className={errors.matter_name ? 'border-destructive' : ''}
                  />
                  {errors.matter_name && (
                    <p className="text-sm text-destructive">{errors.matter_name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="practice_area">Practice Area</Label>
                <Select
                  value={formData.practice_area || ''}
                  onValueChange={(v) => updateField('practice_area', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {practiceAreas.map((area) => (
                      <SelectItem key={area} value={area}>{area}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Select
                    value={formData.source || ''}
                    onValueChange={(v) => updateField('source', v || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((src) => (
                        <SelectItem key={src} value={src}>{src}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lead_partner">Billing Partner</Label>
                  <Input
                    id="lead_partner"
                    value={formData.lead_partner}
                    onChange={(e) => updateField('lead_partner', e.target.value)}
                    placeholder="Partner name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="originator">MMA</Label>
                  <Input
                    id="originator"
                    value={formData.originator}
                    onChange={(e) => updateField('originator', e.target.value)}
                    placeholder="Partner name"
                  />
                </div>
              </div>

              {/* Dates - conditional based on category */}
              {!isPipeline && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <ClearableDateInput
                      id="start_date"
                      value={formData.start_date}
                      onChange={(value) => updateField('start_date', value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target_close_date">Target Close Date</Label>
                    <ClearableDateInput
                      id="target_close_date"
                      value={formData.target_close_date}
                      onChange={(value) => updateField('target_close_date', value)}
                    />
                  </div>
                </div>
              )}

              {/* Dates moved to Pipeline Tracking section for pipeline matters */}
            </CardContent>
          </Card>

          {/* Deal Information */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Deal Information</CardTitle>
              <CardDescription>Details about the underlying transaction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deal_currency">Deal Currency</Label>
                  <Select
                    value={formData.deal_currency || ''}
                    onValueChange={(v) => updateField('deal_currency', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="deal_value">Deal Value</Label>
                  <Input
                    id="deal_value"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.deal_value || ''}
                    onChange={(e) => updateField('deal_value', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="e.g., 150,000,000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fee Structure */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Fee Structure</CardTitle>
              <CardDescription>Fee arrangement and breakdown</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fee_type">Fee Type</Label>
                  <Select
                    value={formData.fee_type || ''}
                    onValueChange={(v) => updateField('fee_type', v || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {feeTypes.map((ft) => (
                        <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fee_currency">Fee Currency</Label>
                  <Select
                    value={formData.fee_currency}
                    onValueChange={(v) => updateField('fee_currency', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="exchange_rate">Exchange Rate (to USD)</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => refetchRates()}
                      disabled={ratesLoading}
                      className="h-6 px-2 text-xs"
                    >
                      <RefreshCw className={cn("h-3 w-3 mr-1", ratesLoading && "animate-spin")} />
                      Refresh
                    </Button>
                  </div>
                  <Input
                    id="exchange_rate"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={formData.exchange_rate}
                    onChange={(e) => updateField('exchange_rate', parseFloat(e.target.value) || 1)}
                  />
                  {exchangeRatesData?.date && (
                    <p className="text-xs text-muted-foreground">
                      Rates as of {exchangeRatesData.date}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fee_amount_upper_end">Fee Amount (Upper End)</Label>
                  <Input
                    id="fee_amount_upper_end"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.fee_amount_upper_end}
                    onChange={(e) => updateField('fee_amount_upper_end', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="local_counsel_fee">Local Counsel Fee</Label>
                  <Input
                    id="local_counsel_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.local_counsel_fee}
                    onChange={(e) => updateField('local_counsel_fee', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bm_fee_component">BM Fee Component (auto)</Label>
                  <Input
                    id="bm_fee_component"
                    type="number"
                    value={formData.bm_fee_component}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_terms">Billing Arrangements</Label>
                <Input
                  id="billing_terms"
                  value={formData.billing_terms}
                  onChange={(e) => updateField('billing_terms', e.target.value)}
                  placeholder="e.g., Monthly, Quarterly, Milestone-based"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Tracking - only show for Pipeline category */}
          {isPipeline && (
            <Card className="shadow-card border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardHeader>
                <CardTitle className="text-lg font-heading">Pipeline Tracking</CardTitle>
                <CardDescription>RFP and opportunity tracking details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="conflicts_check"
                      checked={formData.conflicts_check}
                      onCheckedChange={(checked) => updateField('conflicts_check', checked === true)}
                    />
                    <Label htmlFor="conflicts_check" className="font-normal cursor-pointer">
                      Conflicts Check Complete
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="submitted"
                      checked={formData.submitted}
                      onCheckedChange={(checked) => updateField('submitted', checked === true)}
                    />
                    <Label htmlFor="submitted" className="font-normal cursor-pointer">
                      Submitted
                    </Label>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="opportunity_receipt_date">Opportunity Receipt</Label>
                    <ClearableDateInput
                      id="opportunity_receipt_date"
                      value={formData.opportunity_receipt_date}
                      onChange={(value) => updateField('opportunity_receipt_date', value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clarifications_date">Clarifications Date</Label>
                    <ClearableDateInput
                      id="clarifications_date"
                      value={formData.clarifications_date}
                      onChange={(value) => updateField('clarifications_date', value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="submission_deadline">Submission Deadline</Label>
                    <ClearableDateInput
                      id="submission_deadline"
                      value={formData.submission_deadline}
                      onChange={(value) => updateField('submission_deadline', value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="decision_date">Decision Date</Label>
                    <ClearableDateInput
                      id="decision_date"
                      value={formData.decision_date}
                      onChange={(value) => updateField('decision_date', value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pipeline_outcome">Outcome</Label>
                  <Select
                    value={formData.pipeline_outcome || ''}
                    onValueChange={(v) => updateField('pipeline_outcome', v || null)}
                  >
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder="Pending decision" />
                    </SelectTrigger>
                    <SelectContent>
                      {outcomes.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Budget (Legacy) */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Notes</CardTitle>
              <CardDescription>Internal notes and documentation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="budget_notes">Budget Notes</Label>
                <Textarea
                  id="budget_notes"
                  value={formData.budget_notes}
                  onChange={(e) => updateField('budget_notes', e.target.value)}
                  placeholder="Any notes about the budget arrangement..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fee_earner_mix_notes">Fee Earner Mix Notes</Label>
                <Textarea
                  id="fee_earner_mix_notes"
                  value={formData.fee_earner_mix_notes}
                  onChange={(e) => updateField('fee_earner_mix_notes', e.target.value)}
                  placeholder="Notes about team composition and rates..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" asChild>
              <Link to={isEditing ? `/matters/${id}` : '/matters'}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Saving...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Matter'
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}