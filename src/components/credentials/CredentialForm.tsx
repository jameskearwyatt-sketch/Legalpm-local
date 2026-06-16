import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, ChevronsUpDown, X, Sparkles, Link2 } from 'lucide-react';
import {
  type DealCredential,
  type CreateCredentialInput,
  PRACTICE_AREAS,
  INSTITUTION_PRESETS,
  ROLE_OPTIONS,
  generateDescription,
} from '@/lib/hooks/useCredentials';

const credentialSchema = z.object({
  deal_name: z.string().min(1, 'Deal name is required'),
  client_name: z.string().min(1, 'Client name is required'),
  client_public_name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  deal_type: z.string().optional().nullable(),
  sector: z.string().optional().nullable(),
  deal_value: z.coerce.number().optional().nullable(),
  deal_currency: z.string().optional().nullable(),
  role_played: z.string().optional().nullable(),
  lead_partner: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  completion_date: z.string().optional().nullable(),
  year_completed: z.coerce.number().int().optional().nullable(),
  status: z.enum(['Active', 'Completed', 'Ongoing']),
});

type FormValues = z.infer<typeof credentialSchema>;

interface CredentialFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential?: DealCredential | null;
  onSubmit: (data: CreateCredentialInput) => void;
  isSubmitting: boolean;
  allSectors: string[];
  allDealTypes: string[];
}

export function CredentialForm({
  open, onOpenChange, credential, onSubmit, isSubmitting, allSectors, allDealTypes,
}: CredentialFormProps) {
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);
  const [jurisdictionInput, setJurisdictionInput] = useState('');
  const [hasInstitutions, setHasInstitutions] = useState(false);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [sectorSearch, setSectorSearch] = useState('');
  const [sectorOpen, setSectorOpen] = useState(false);
  const [dealTypeSearch, setDealTypeSearch] = useState('');
  const [dealTypeOpen, setDealTypeOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: {
      deal_name: '',
      client_name: '',
      client_public_name: '',
      description: '',
      deal_type: '',
      sector: '',
      deal_value: null,
      deal_currency: 'USD',
      role_played: '',
      lead_partner: '',
      start_date: '',
      completion_date: '',
      year_completed: null,
      status: 'Active',
    },
  });

  useEffect(() => {
    if (credential) {
      form.reset({
        deal_name: credential.deal_name,
        client_name: credential.client_name,
        client_public_name: credential.client_public_name || '',
        description: credential.description || '',
        deal_type: credential.deal_type || '',
        sector: credential.sector || '',
        deal_value: credential.deal_value,
        deal_currency: credential.deal_currency || 'USD',
        role_played: credential.role_played || '',
        lead_partner: credential.lead_partner || '',
        start_date: credential.start_date || '',
        completion_date: credential.completion_date || '',
        year_completed: credential.year_completed,
        status: credential.status,
      });
      setPracticeAreas(credential.practice_areas || []);
      setJurisdictions(credential.jurisdictions || []);
      setHasInstitutions(credential.has_institutional_involvement);
      setInstitutions(credential.institutions || []);
    } else {
      form.reset({
        deal_name: '', client_name: '', client_public_name: '', description: '',
        deal_type: '', sector: '', deal_value: null, deal_currency: 'USD',
        role_played: '', lead_partner: '', start_date: '', completion_date: '',
        year_completed: null, status: 'Active',
      });
      setPracticeAreas([]);
      setJurisdictions([]);
      setHasInstitutions(false);
      setInstitutions([]);
    }
  }, [credential, open]);

  const filteredSectors = useMemo(() => {
    if (!sectorSearch) return allSectors;
    const q = sectorSearch.toLowerCase();
    return allSectors.filter(s => s.toLowerCase().includes(q));
  }, [allSectors, sectorSearch]);

  const filteredDealTypes = useMemo(() => {
    if (!dealTypeSearch) return allDealTypes;
    const q = dealTypeSearch.toLowerCase();
    return allDealTypes.filter(t => t.toLowerCase().includes(q));
  }, [allDealTypes, dealTypeSearch]);

  const handleAutoDescription = () => {
    const values = form.getValues();
    const desc = generateDescription({
      ...values,
      practice_areas: practiceAreas,
      jurisdictions,
      deal_value: values.deal_value ?? undefined,
    } as Partial<DealCredential>);
    form.setValue('description', desc);
  };

  const addJurisdiction = () => {
    const j = jurisdictionInput.trim();
    if (j && !jurisdictions.includes(j)) {
      setJurisdictions([...jurisdictions, j]);
    }
    setJurisdictionInput('');
  };

  const handleSubmit = (values: FormValues) => {
    const input: CreateCredentialInput = {
      ...values,
      deal_type: values.deal_type || null,
      sector: values.sector || null,
      deal_value: values.deal_value || null,
      deal_currency: values.deal_currency || 'USD',
      role_played: values.role_played || null,
      lead_partner: values.lead_partner || null,
      client_public_name: values.client_public_name || null,
      description: values.description || null,
      start_date: values.start_date || null,
      completion_date: values.completion_date || null,
      year_completed: values.year_completed || null,
      practice_areas: practiceAreas.length > 0 ? practiceAreas : null,
      jurisdictions: jurisdictions.length > 0 ? jurisdictions : null,
      has_institutional_involvement: hasInstitutions,
      institutions: hasInstitutions && institutions.length > 0 ? institutions : null,
    };
    if (credential) {
      (input as CreateCredentialInput & { id?: string }).matter_id = credential.matter_id;
    }
    onSubmit(input);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {credential ? 'Edit Credential' : 'Add Credential'}
            {credential?.matter_id && (
              <Badge variant="secondary" className="gap-1">
                <Link2 className="h-3 w-3" /> Synced from matter
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-10rem)] pr-4">
          <form id="credential-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pb-2">
            {/* Core fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="deal_name">Deal Name *</Label>
                <Input id="deal_name" {...form.register('deal_name')} />
                {form.formState.errors.deal_name && (
                  <p className="text-xs text-red-500">{form.formState.errors.deal_name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client_name">Client Name *</Label>
                <Input id="client_name" {...form.register('client_name')} />
                {form.formState.errors.client_name && (
                  <p className="text-xs text-red-500">{form.formState.errors.client_name.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client_public_name">Public Client Name (for external exports)</Label>
              <Input id="client_public_name" {...form.register('client_public_name')} placeholder='e.g. "a major European utility"' />
            </div>

            {/* Description with auto-generate */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleAutoDescription}>
                  <Sparkles className="h-3 w-3" /> Auto-generate
                </Button>
              </div>
              <Textarea id="description" {...form.register('description')} rows={3} placeholder="1-2 sentence deal summary" />
            </div>

            {/* Categorisation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Deal Type</Label>
                <Popover open={dealTypeOpen} onOpenChange={setDealTypeOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {form.watch('deal_type') || 'Select deal type...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-2">
                    <Input
                      placeholder="Search or type custom..."
                      value={dealTypeSearch}
                      onChange={e => setDealTypeSearch(e.target.value)}
                      className="mb-2"
                    />
                    <ScrollArea className="max-h-[200px]">
                      {filteredDealTypes.map(dt => (
                        <div
                          key={dt}
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded hover:bg-accent text-sm"
                          onClick={() => { form.setValue('deal_type', dt); setDealTypeOpen(false); setDealTypeSearch(''); }}
                        >
                          {form.watch('deal_type') === dt && <Check className="h-4 w-4" />}
                          {dt}
                        </div>
                      ))}
                      {dealTypeSearch && !filteredDealTypes.includes(dealTypeSearch) && (
                        <div
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded hover:bg-accent text-sm text-muted-foreground"
                          onClick={() => { form.setValue('deal_type', dealTypeSearch); setDealTypeOpen(false); setDealTypeSearch(''); }}
                        >
                          Use "{dealTypeSearch}"
                        </div>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label>Sector</Label>
                <Popover open={sectorOpen} onOpenChange={setSectorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {form.watch('sector') || 'Select sector...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-2">
                    <Input
                      placeholder="Search or type custom..."
                      value={sectorSearch}
                      onChange={e => setSectorSearch(e.target.value)}
                      className="mb-2"
                    />
                    <ScrollArea className="max-h-[200px]">
                      {filteredSectors.map(s => (
                        <div
                          key={s}
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded hover:bg-accent text-sm"
                          onClick={() => { form.setValue('sector', s); setSectorOpen(false); setSectorSearch(''); }}
                        >
                          {form.watch('sector') === s && <Check className="h-4 w-4" />}
                          {s}
                        </div>
                      ))}
                      {sectorSearch && !filteredSectors.includes(sectorSearch) && (
                        <div
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded hover:bg-accent text-sm text-muted-foreground"
                          onClick={() => { form.setValue('sector', sectorSearch); setSectorOpen(false); setSectorSearch(''); }}
                        >
                          Use "{sectorSearch}"
                        </div>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Practice Areas multi-select */}
            <div className="space-y-1.5">
              <Label>Practice Areas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal min-h-[2.5rem] h-auto">
                    <span className="flex flex-wrap gap-1">
                      {practiceAreas.length > 0 ? practiceAreas.map(pa => (
                        <Badge key={pa} variant="secondary" className="text-xs">
                          {pa}
                          <X className="ml-1 h-3 w-3 cursor-pointer" onClick={e => { e.stopPropagation(); setPracticeAreas(practiceAreas.filter(p => p !== pa)); }} />
                        </Badge>
                      )) : <span className="text-muted-foreground">Select practice areas...</span>}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-2">
                  <ScrollArea className="max-h-[250px]">
                    {PRACTICE_AREAS.map(pa => (
                      <div
                        key={pa}
                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded hover:bg-accent text-sm"
                        onClick={() => {
                          if (practiceAreas.includes(pa)) setPracticeAreas(practiceAreas.filter(p => p !== pa));
                          else setPracticeAreas([...practiceAreas, pa]);
                        }}
                      >
                        <Checkbox checked={practiceAreas.includes(pa)} />
                        {pa}
                      </div>
                    ))}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            {/* Jurisdictions */}
            <div className="space-y-1.5">
              <Label>Jurisdictions</Label>
              <div className="flex gap-2">
                <Input
                  value={jurisdictionInput}
                  onChange={e => setJurisdictionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addJurisdiction(); } }}
                  placeholder="Type and press Enter..."
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addJurisdiction}>Add</Button>
              </div>
              {jurisdictions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {jurisdictions.map(j => (
                    <Badge key={j} variant="secondary" className="text-xs">
                      {j}
                      <X className="ml-1 h-3 w-3 cursor-pointer" onClick={() => setJurisdictions(jurisdictions.filter(jj => jj !== j))} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Deal details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="deal_value">Deal Value</Label>
                <Input id="deal_value" type="number" step="0.01" {...form.register('deal_value')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deal_currency">Currency</Label>
                <Input id="deal_currency" {...form.register('deal_currency')} placeholder="USD" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.watch('role_played') || ''} onValueChange={v => form.setValue('role_played', v)}>
                  <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead_partner">Lead Partner</Label>
              <Input id="lead_partner" {...form.register('lead_partner')} />
            </div>

            {/* Institutional involvement */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="has_institutions">Multilateral/Bilateral Institution Involvement</Label>
                <Switch
                  id="has_institutions"
                  checked={hasInstitutions}
                  onCheckedChange={setHasInstitutions}
                />
              </div>
              {hasInstitutions && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Select institutions involved</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {INSTITUTION_PRESETS.map(inst => (
                      <Badge
                        key={inst}
                        variant={institutions.includes(inst) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => {
                          if (institutions.includes(inst)) setInstitutions(institutions.filter(i => i !== inst));
                          else setInstitutions([...institutions, inst]);
                        }}
                      >
                        {inst}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dates and status */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start_date">Start Date</Label>
                <Input id="start_date" type="date" {...form.register('start_date')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="completion_date">Completion Date</Label>
                <Input id="completion_date" type="date" {...form.register('completion_date')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year_completed">Year Completed</Label>
                <Input id="year_completed" type="number" {...form.register('year_completed')} placeholder="e.g. 2025" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.watch('status')} onValueChange={v => form.setValue('status', v as 'Active' | 'Completed' | 'Ongoing')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Ongoing">Ongoing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="credential-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : credential ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
