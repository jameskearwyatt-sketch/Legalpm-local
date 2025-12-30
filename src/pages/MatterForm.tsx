import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useMatters, useMatter, CreateMatterInput } from '@/lib/hooks/useMatters';
import { useClients } from '@/lib/hooks/useClients';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { z } from 'zod';

const matterSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  matter_name: z.string().min(1, 'Matter name is required').max(200),
  matter_number: z.string().min(1, 'Matter number is required').max(50),
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
});

const practiceAreas = [
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

export default function MatterForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  
  const { data: existingMatter, isLoading: matterLoading } = useMatter(id || '');
  const { createMatter, updateMatter } = useMatters();
  const { clients, isLoading: clientsLoading } = useClients();

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
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      });
    }
  }, [existingMatter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Compute status based on checkboxes
      const computedStatus = formData.aml_kyc_complete && formData.assignment_letter_signed && formData.matter_open
        ? 'Open' as const
        : 'On Hold' as const;
      
      const validated = matterSchema.parse(formData);
      const dataToSubmit = { ...validated, status: computedStatus };
      setIsSubmitting(true);

      if (isEditing) {
        await updateMatter.mutateAsync({ id, ...dataToSubmit });
        navigate(`/matters/${id}`);
      } else {
        const result = await createMatter.mutateAsync(dataToSubmit as CreateMatterInput);
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
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
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
              {isEditing ? 'Update matter details' : 'Create a new legal matter'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Basic Information</CardTitle>
              <CardDescription>Core details about the matter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_id">Client *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(v) => updateField('client_id', v)}
                    disabled={clientsLoading}
                  >
                    <SelectTrigger className={errors.client_id ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.client_id && (
                    <p className="text-sm text-destructive">{errors.client_id}</p>
                  )}
                  {clients.length === 0 && !clientsLoading && (
                    <p className="text-sm text-muted-foreground">
                      No clients yet.{' '}
                      <Link to="/clients/new" className="text-primary hover:underline">
                        Create one first
                      </Link>
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Matter Status</Label>
                  <div className="space-y-3">
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
                  </div>
                  {formData.aml_kyc_complete && formData.assignment_letter_signed && formData.matter_open && (
                    <p className="text-sm text-green-600 font-medium">✓ Fully Open</p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="matter_name">Matter Name *</Label>
                  <Input
                    id="matter_name"
                    value={formData.matter_name}
                    onChange={(e) => updateField('matter_name', e.target.value)}
                    placeholder="e.g., Acquisition of ABC Ltd"
                    className={errors.matter_name ? 'border-destructive' : ''}
                  />
                  {errors.matter_name && (
                    <p className="text-sm text-destructive">{errors.matter_name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="matter_number">Matter Number *</Label>
                  <Input
                    id="matter_number"
                    value={formData.matter_number}
                    onChange={(e) => updateField('matter_number', e.target.value)}
                    placeholder="e.g., MAT-2024-001"
                    className={errors.matter_number ? 'border-destructive' : ''}
                  />
                  {errors.matter_number && (
                    <p className="text-sm text-destructive">{errors.matter_number}</p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
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
                        <SelectItem key={area} value={area}>
                          {area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lead_partner">Lead Partner</Label>
                  <Input
                    id="lead_partner"
                    value={formData.lead_partner}
                    onChange={(e) => updateField('lead_partner', e.target.value)}
                    placeholder="Partner name"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => updateField('start_date', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_close_date">Target Close Date</Label>
                  <Input
                    id="target_close_date"
                    type="date"
                    value={formData.target_close_date}
                    onChange={(e) => updateField('target_close_date', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Info */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Budget & Billing</CardTitle>
              <CardDescription>Financial terms for this matter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget_type">Budget Type</Label>
                  <Select
                    value={formData.budget_type}
                    onValueChange={(v) => updateField('budget_type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fixed">Fixed</SelectItem>
                      <SelectItem value="Cap">Cap</SelectItem>
                      <SelectItem value="Estimate">Estimate</SelectItem>
                      <SelectItem value="Retainer">Retainer</SelectItem>
                      <SelectItem value="Hourly">Hourly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agreed_budget_amount">Agreed Budget (£)</Label>
                  <Input
                    id="agreed_budget_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.agreed_budget_amount}
                    onChange={(e) => updateField('agreed_budget_amount', parseFloat(e.target.value) || 0)}
                    className={errors.agreed_budget_amount ? 'border-destructive' : ''}
                  />
                  {errors.agreed_budget_amount && (
                    <p className="text-sm text-destructive">{errors.agreed_budget_amount}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(v) => updateField('currency', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_terms">Billing Terms</Label>
                <Input
                  id="billing_terms"
                  value={formData.billing_terms}
                  onChange={(e) => updateField('billing_terms', e.target.value)}
                  placeholder="e.g., Monthly, On completion, Milestone-based"
                />
              </div>

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
