import { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Upload, FileSpreadsheet, FileText, ClipboardPaste, AlertTriangle,
  Check, X, Loader2, Sparkles, ChevronDown, ChevronRight,
  Globe, Building2, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { type CreateCredentialInput } from '@/lib/hooks/useCredentials';

interface CredentialImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: CreateCredentialInput[]) => void;
  isImporting: boolean;
}

interface ParsedDeal {
  deal_name: string;
  client_name: string;
  description: string | null;
  deal_type: string | null;
  sector: string | null;
  practice_areas: string[] | null;
  jurisdictions: string[] | null;
  deal_value: number | null;
  deal_currency: string | null;
  role_played: string | null;
  lead_partner: string | null;
  year_completed: number | null;
  institutions: string[] | null;
  status: string;
  selected: boolean;
  expanded: boolean;
}

type Step = 'input' | 'parsing' | 'review';

export function CredentialImport({ open, onOpenChange, onImport, isImporting }: CredentialImportProps) {
  const [step, setStep] = useState<Step>('input');
  const [tab, setTab] = useState<string>('file');
  const [pastedText, setPastedText] = useState('');
  const [parsedDeals, setParsedDeals] = useState<ParsedDeal[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsingNotes, setParsingNotes] = useState('');

  const reset = () => {
    setParsedDeals([]);
    setFileName('');
    setParseError('');
    setParsingNotes('');
    setPastedText('');
    setStep('input');
  };

  const parseWithAI = useCallback(async (text: string, source: string) => {
    setStep('parsing');
    setParseError('');

    try {
      const { data, error } = await supabase.functions.invoke('parse-deal-credentials', {
        body: { text, source },
      });

      if (error) throw new Error(error.message || 'Failed to parse');
      if (!data?.success) throw new Error(data?.error || 'AI parsing failed');
      if (!data.deals || data.deals.length === 0) {
        setParseError('No deals could be extracted from this content. Try a different format or add more detail.');
        setStep('input');
        return;
      }

      const deals: ParsedDeal[] = data.deals.map((d: Omit<ParsedDeal, 'selected' | 'expanded'>) => ({
        ...d,
        selected: true,
        expanded: false,
      }));

      setParsedDeals(deals);
      setParsingNotes(data.notes || '');
      setStep('review');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse';
      setParseError(msg);
      setStep('input');
      toast.error('Parsing failed', { description: msg });
    }
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      let text = '';
      const ext = file.name.toLowerCase().split('.').pop();

      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(ws);
        await parseWithAI(text, 'excel');
      } else {
        text = await file.text();
        await parseWithAI(text, 'word');
      }
    } catch (err) {
      setParseError('Failed to read file.');
      setStep('input');
    }

    e.target.value = '';
  }, [parseWithAI]);

  const handlePastedText = useCallback(async () => {
    if (!pastedText.trim()) {
      toast.error('Please paste some text first');
      return;
    }
    setFileName('Pasted text');
    await parseWithAI(pastedText, 'pasted');
  }, [pastedText, parseWithAI]);

  const toggleRow = (idx: number) => {
    setParsedDeals(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const toggleExpand = (idx: number) => {
    setParsedDeals(prev => prev.map((r, i) => i === idx ? { ...r, expanded: !r.expanded } : r));
  };

  const toggleAll = (selected: boolean) => {
    setParsedDeals(prev => prev.map(r => ({ ...r, selected })));
  };

  const updateDeal = (idx: number, field: keyof ParsedDeal, value: unknown) => {
    setParsedDeals(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleImport = () => {
    const selected = parsedDeals.filter(r => r.selected);
    if (selected.length === 0) {
      toast.error('Select at least one deal to import');
      return;
    }

    const inputs: CreateCredentialInput[] = selected.map(r => ({
      deal_name: r.deal_name,
      client_name: r.client_name,
      description: r.description || null,
      deal_type: r.deal_type || null,
      sector: r.sector || null,
      jurisdictions: r.jurisdictions?.length ? r.jurisdictions : null,
      deal_value: r.deal_value || null,
      deal_currency: r.deal_currency || null,
      role_played: r.role_played || null,
      lead_partner: r.lead_partner || null,
      year_completed: r.year_completed || null,
      practice_areas: r.practice_areas?.length ? r.practice_areas : null,
      has_institutional_involvement: !!(r.institutions && r.institutions.length > 0),
      institutions: r.institutions?.length ? r.institutions : null,
      status: (r.status as 'Active' | 'Completed' | 'Ongoing') || 'Completed',
    }));

    onImport(inputs);
  };

  const selectedCount = parsedDeals.filter(r => r.selected).length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Import Credentials
          </DialogTitle>
          <DialogDescription>
            Upload a file or paste text in any format — AI will extract and categorise your deal credentials automatically.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="gap-1"><Upload className="h-4 w-4" /> Upload File</TabsTrigger>
              <TabsTrigger value="paste" className="gap-1"><ClipboardPaste className="h-4 w-4" /> Paste Text</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="pt-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">Drop any file with deal credentials</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Excel, CSV, Word, or plain text — any layout, any format. AI handles the rest.
                </p>
                <label>
                  <input type="file" accept=".xlsx,.xls,.csv,.txt,.doc,.docx" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-1" /> Choose File</span></Button>
                </label>
              </div>
            </TabsContent>
            <TabsContent value="paste" className="pt-4 space-y-3">
              <Textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder={"Paste your deal list here in any format, e.g.:\n\n• Advised Acme Corp on a USD 500m PPA for a 200MW solar project in Ghana (2024)\n• Acting for EnergyX as lead counsel on a EUR 300m tolling agreement in Turkey\n• Client: GreenPower Ltd — Carbon credit purchase, Kenya, USD 50m, completed 2023\n\nOr paste from Excel, CV sections, pitch book entries — anything goes."}
                rows={10}
                className="font-mono text-sm"
              />
              <Button onClick={handlePastedText} disabled={!pastedText.trim()}>
                <Sparkles className="h-4 w-4 mr-1" /> Parse with AI
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {step === 'parsing' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Analysing your credentials...</p>
              <p className="text-sm text-muted-foreground mt-1">
                AI is reading the text, identifying deals, extracting details, and categorising everything.
              </p>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{fileName}</Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedCount} of {parsedDeals.length} deals selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>Select All</Button>
                <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>Deselect All</Button>
                <Button variant="outline" size="sm" onClick={reset}>Start Over</Button>
              </div>
            </div>

            {parsingNotes && (
              <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-md p-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{parsingNotes}</span>
              </div>
            )}

            <ScrollArea className="max-h-[450px]">
              <div className="space-y-2 pr-4">
                {parsedDeals.map((deal, idx) => (
                  <Collapsible key={idx} open={deal.expanded} onOpenChange={() => toggleExpand(idx)}>
                    <Card className={`transition-opacity ${deal.selected ? '' : 'opacity-50'}`}>
                      <div className="flex items-start gap-3 px-4 py-3">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); toggleRow(idx); }}
                          className="mt-1 shrink-0"
                        >
                          {deal.selected
                            ? <Check className="h-4 w-4 text-green-600" />
                            : <X className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-medium text-sm">{deal.deal_name}</span>
                              <span className="text-muted-foreground text-sm ml-2">— {deal.client_name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {deal.year_completed && (
                                <Badge variant="outline" className="text-[10px]">{deal.year_completed}</Badge>
                              )}
                              {deal.deal_type && (
                                <Badge variant="secondary" className="text-[10px]">{deal.deal_type}</Badge>
                              )}
                              {deal.deal_value && (
                                <Badge variant="outline" className="text-[10px]">
                                  {deal.deal_currency || 'USD'} {deal.deal_value >= 1_000_000
                                    ? `${(deal.deal_value / 1_000_000).toFixed(deal.deal_value % 1_000_000 === 0 ? 0 : 1)}m`
                                    : deal.deal_value.toLocaleString()}
                                </Badge>
                              )}
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  {deal.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          {deal.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{deal.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {deal.sector && (
                              <Badge variant="outline" className="text-[10px] py-0">{deal.sector}</Badge>
                            )}
                            {deal.jurisdictions?.map(j => (
                              <Badge key={j} variant="secondary" className="text-[10px] py-0">
                                <Globe className="h-2.5 w-2.5 mr-0.5" />{j}
                              </Badge>
                            ))}
                            {deal.practice_areas?.map(pa => (
                              <Badge key={pa} variant="outline" className="text-[10px] py-0 border-blue-200">{pa}</Badge>
                            ))}
                            {deal.institutions?.map(inst => (
                              <Badge key={inst} variant="outline" className="text-[10px] py-0 border-purple-200">
                                <Building2 className="h-2.5 w-2.5 mr-0.5" />{inst}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <CollapsibleContent>
                        <CardContent className="pt-0 pb-3 px-4 ml-7">
                          <div className="border-t pt-3 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <Pencil className="h-3 w-3" /> Edit extracted fields before import
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Deal Name</label>
                                <Input
                                  value={deal.deal_name}
                                  onChange={e => updateDeal(idx, 'deal_name', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Client</label>
                                <Input
                                  value={deal.client_name}
                                  onChange={e => updateDeal(idx, 'client_name', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Description</label>
                              <Textarea
                                value={deal.description || ''}
                                onChange={e => updateDeal(idx, 'description', e.target.value)}
                                rows={2}
                                className="text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Deal Type</label>
                                <Input
                                  value={deal.deal_type || ''}
                                  onChange={e => updateDeal(idx, 'deal_type', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Sector</label>
                                <Input
                                  value={deal.sector || ''}
                                  onChange={e => updateDeal(idx, 'sector', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Value</label>
                                <Input
                                  type="number"
                                  value={deal.deal_value || ''}
                                  onChange={e => updateDeal(idx, 'deal_value', e.target.value ? Number(e.target.value) : null)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Year</label>
                                <Input
                                  type="number"
                                  value={deal.year_completed || ''}
                                  onChange={e => updateDeal(idx, 'year_completed', e.target.value ? Number(e.target.value) : null)}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Jurisdictions (comma-separated)</label>
                                <Input
                                  value={deal.jurisdictions?.join(', ') || ''}
                                  onChange={e => updateDeal(idx, 'jurisdictions', e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : null)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Role</label>
                                <Input
                                  value={deal.role_played || ''}
                                  onChange={e => updateDeal(idx, 'role_played', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Currency</label>
                                <Input
                                  value={deal.deal_currency || ''}
                                  onChange={e => updateDeal(idx, 'deal_currency', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {parseError && step === 'input' && (
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertTriangle className="h-4 w-4" /> {parseError}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          {step === 'review' && (
            <Button onClick={handleImport} disabled={isImporting || selectedCount === 0}>
              {isImporting ? 'Importing...' : `Import ${selectedCount} Credential${selectedCount !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
