import { useState, useMemo } from 'react';
import { Building2, Globe, Plus, Edit2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DraftProposalItem } from '@/lib/hooks/usePricingProposals';
import { useLocalCounselLibrary, LocalCounselLibraryEntry, LocalCounselRateCard } from '@/lib/hooks/useLocalCounselLibrary';
import { useLcWorkItemQuotes } from '@/lib/hooks/useLcWorkItemQuotes';
import { getCurrencySymbol, CURRENCY_SYMBOLS } from '@/lib/currencyUtils';
import { CountryCombobox } from './CountryCombobox';
import { useToast } from '@/hooks/use-toast';

const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

interface LocalCounselPanelProps {
  draftItems: DraftProposalItem[];
  onUpdateItem: (index: number, updates: Partial<DraftProposalItem>) => void;
  proposalCurrency: string;
  proposalId: string;
}

// Generate a stable key for a work item
function getWorkItemKey(item: DraftProposalItem): string {
  return item.work_item?.trim() || '';
}

export function LocalCounselPanel({
  draftItems,
  onUpdateItem,
  proposalCurrency,
  proposalId,
}: LocalCounselPanelProps) {
  const { library, entriesByCountry, createEntry, updateEntry, deleteEntry } = useLocalCounselLibrary();
  const { quotesByFirm, upsertQuotes, getFirmTotal, firmHasAllQuotes, getQuotesForFirm } = useLcWorkItemQuotes(proposalId);
  const { toast } = useToast();
  
  // Dialog states
  const [addFirmDialogOpen, setAddFirmDialogOpen] = useState(false);
  const [editFirmDialogOpen, setEditFirmDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  
  const [targetCountry, setTargetCountry] = useState<string>('');
  const [editingFirm, setEditingFirm] = useState<LocalCounselLibraryEntry | null>(null);
  const [quotingFirm, setQuotingFirm] = useState<LocalCounselLibraryEntry | null>(null);
  
  // Form state
  const [formFirmName, setFormFirmName] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formRateCard, setFormRateCard] = useState<LocalCounselRateCard>({});
  const [showRateCard, setShowRateCard] = useState(false);
  const [quoteEntries, setQuoteEntries] = useState<Record<string, { lower: string; upper: string; amount: string }>>({});

  // Group LC items by country
  const jurisdictionData = useMemo(() => {
    const byCountry: Record<string, { 
      country: string; 
      items: { item: DraftProposalItem; index: number; workItemKey: string }[];
      activeFirmId?: string;
      activeFirmName?: string;
    }> = {};

    draftItems.forEach((item, index) => {
      if (item.provider === 'Local Counsel') {
        const country = (item as any).lc_country || 'Unassigned';
        const workItemKey = getWorkItemKey(item);
        
        if (!byCountry[country]) {
          byCountry[country] = {
            country,
            items: [],
            activeFirmId: (item as any).lc_library_id,
            activeFirmName: item.lc_firm_name,
          };
        }
        
        byCountry[country].items.push({ item, index, workItemKey });
        // Use the first item's firm as the active one
        if (!byCountry[country].activeFirmId && (item as any).lc_library_id) {
          byCountry[country].activeFirmId = (item as any).lc_library_id;
          byCountry[country].activeFirmName = item.lc_firm_name;
        }
      }
    });

    return Object.values(byCountry).sort((a, b) => {
      if (a.country === 'Unassigned') return 1;
      if (b.country === 'Unassigned') return -1;
      return a.country.localeCompare(b.country);
    });
  }, [draftItems]);

  // Get firms for a specific country (from library)
  const getFirmsForCountry = (country: string): LocalCounselLibraryEntry[] => {
    return entriesByCountry[country] || [];
  };

  // Check if firm has quotes for all work items in a country
  const firmHasQuotesForCountry = (firmId: string, country: string): boolean => {
    const countryData = jurisdictionData.find(j => j.country === country);
    if (!countryData) return false;
    const workItemKeys = countryData.items.map(({ workItemKey }) => workItemKey);
    return firmHasAllQuotes(firmId, workItemKeys);
  };

  // Get total for a firm for a specific country
  const getFirmTotalForCountry = (firmId: string, country: string) => {
    const countryData = jurisdictionData.find(j => j.country === country);
    if (!countryData) return { lower: 0, upper: 0, amount: 0 };
    const workItemKeys = countryData.items.map(({ workItemKey }) => workItemKey);
    return getFirmTotal(firmId, workItemKeys);
  };

  // Switch to a firm - apply their quotes to all work items in that country
  const handleSelectFirm = (country: string, firmId: string) => {
    const firm = library.find(f => f.id === firmId);
    const countryData = jurisdictionData.find(j => j.country === country);
    if (!firm || !countryData) return;

    const firmQuotes = getQuotesForFirm(firmId);
    const workItemKeys = countryData.items.map(({ workItemKey }) => workItemKey);
    const hasAllQuotes = workItemKeys.every(key => key in firmQuotes);

    if (!hasAllQuotes) {
      // Need to enter quotes first
      openQuoteDialog(firm, country);
      return;
    }

    // Apply quotes to all work items
    countryData.items.forEach(({ index, workItemKey }) => {
      const quote = firmQuotes[workItemKey];
      onUpdateItem(index, {
        lc_firm_name: firm.firm_name,
        fee_amount: quote?.fee_amount || 0,
        fee_lower: quote?.fee_lower || 0,
        fee_upper: quote?.fee_upper || 0,
        ...(({ lc_country: firm.country, lc_library_id: firm.id, lc_currency: firm.currency }) as any),
      });
    });

    toast({ title: `Selected ${firm.firm_name}`, description: 'All work items updated.' });
  };

  // Open quote entry dialog
  const openQuoteDialog = (firm: LocalCounselLibraryEntry, country: string) => {
    setQuotingFirm(firm);
    setTargetCountry(country);
    
    const firmQuotes = getQuotesForFirm(firm.id);
    const countryData = jurisdictionData.find(j => j.country === country);
    const initialEntries: Record<string, { lower: string; upper: string; amount: string }> = {};
    
    if (countryData) {
      countryData.items.forEach(({ item, workItemKey }) => {
        const existingQuote = firmQuotes[workItemKey];
        if (existingQuote) {
          initialEntries[workItemKey] = {
            lower: existingQuote.fee_lower.toString(),
            upper: existingQuote.fee_upper.toString(),
            amount: existingQuote.fee_amount.toString(),
          };
        } else {
          initialEntries[workItemKey] = { lower: '', upper: '', amount: '' };
        }
      });
    }
    
    setQuoteEntries(initialEntries);
    setQuoteDialogOpen(true);
  };

  // Save quotes and switch to firm
  const handleSaveQuotesAndSelect = async () => {
    if (!quotingFirm) return;

    const countryData = jurisdictionData.find(j => j.country === targetCountry);
    if (!countryData) return;

    const quoteInputs = countryData.items.map(({ workItemKey }) => {
      const entry = quoteEntries[workItemKey] || { lower: '0', upper: '0', amount: '0' };
      const lower = parseFloat(entry.lower) || 0;
      const upper = parseFloat(entry.upper) || 0;
      const amount = parseFloat(entry.amount) || Math.round((lower + upper) / 2);
      
      return {
        proposal_id: proposalId,
        lc_library_id: quotingFirm.id,
        work_item_key: workItemKey,
        fee_amount: amount,
        fee_lower: lower,
        fee_upper: upper,
      };
    });

    await upsertQuotes.mutateAsync(quoteInputs);
    
    // Apply to work items
    countryData.items.forEach(({ index, workItemKey }) => {
      const entry = quoteEntries[workItemKey] || { lower: '0', upper: '0', amount: '0' };
      const lower = parseFloat(entry.lower) || 0;
      const upper = parseFloat(entry.upper) || 0;
      const amount = parseFloat(entry.amount) || Math.round((lower + upper) / 2);
      
      onUpdateItem(index, {
        lc_firm_name: quotingFirm.firm_name,
        fee_amount: amount,
        fee_lower: lower,
        fee_upper: upper,
        ...(({ lc_country: quotingFirm.country, lc_library_id: quotingFirm.id, lc_currency: quotingFirm.currency }) as any),
      });
    });

    toast({ title: `Selected ${quotingFirm.firm_name}`, description: 'Quotes saved and applied.' });
    setQuoteDialogOpen(false);
    setQuotingFirm(null);
  };

  // Save quotes only (don't switch)
  const handleSaveQuotesOnly = async () => {
    if (!quotingFirm) return;

    const countryData = jurisdictionData.find(j => j.country === targetCountry);
    if (!countryData) return;

    const quoteInputs = countryData.items.map(({ workItemKey }) => {
      const entry = quoteEntries[workItemKey] || { lower: '0', upper: '0', amount: '0' };
      const lower = parseFloat(entry.lower) || 0;
      const upper = parseFloat(entry.upper) || 0;
      const amount = parseFloat(entry.amount) || Math.round((lower + upper) / 2);
      
      return {
        proposal_id: proposalId,
        lc_library_id: quotingFirm.id,
        work_item_key: workItemKey,
        fee_amount: amount,
        fee_lower: lower,
        fee_upper: upper,
      };
    });

    await upsertQuotes.mutateAsync(quoteInputs);
    toast({ title: 'Quotes saved' });
    setQuoteDialogOpen(false);
    setQuotingFirm(null);
  };

  // Open add firm dialog
  const handleOpenAddFirm = (country: string) => {
    setTargetCountry(country);
    setFormFirmName('');
    setFormCountry(country);
    setFormCurrency('USD');
    setFormRateCard({});
    setShowRateCard(false);
    setAddFirmDialogOpen(true);
  };

  // Save new firm
  const handleSaveNewFirm = async () => {
    if (!formFirmName.trim() || !formCountry) return;
    
    const newFirm = await createEntry.mutateAsync({
      firm_name: formFirmName.trim(),
      country: formCountry,
      currency: formCurrency,
      rate_card: showRateCard ? formRateCard : null,
    });
    
    setAddFirmDialogOpen(false);
    
    // Immediately open quote dialog
    if (newFirm) {
      setTimeout(() => {
        openQuoteDialog(newFirm as LocalCounselLibraryEntry, formCountry);
      }, 200);
    }
  };

  // Open edit firm dialog
  const handleOpenEditFirm = (firm: LocalCounselLibraryEntry) => {
    setEditingFirm(firm);
    setFormFirmName(firm.firm_name);
    setFormCountry(firm.country);
    setFormCurrency(firm.currency);
    setFormRateCard(firm.rate_card || {});
    setShowRateCard(!!firm.rate_card);
    setEditFirmDialogOpen(true);
  };

  // Save edit
  const handleSaveEditFirm = async () => {
    if (!editingFirm || !formFirmName.trim()) return;
    
    await updateEntry.mutateAsync({
      id: editingFirm.id,
      firm_name: formFirmName.trim(),
      country: formCountry,
      currency: formCurrency,
      rate_card: showRateCard ? formRateCard : null,
    });
    
    setEditFirmDialogOpen(false);
    setEditingFirm(null);
  };

  // Get work items for current quote dialog
  const getQuoteWorkItems = () => {
    const countryData = jurisdictionData.find(j => j.country === targetCountry);
    return countryData?.items || [];
  };

  // Calculate grand total
  const grandTotal = jurisdictionData.reduce((sum, j) => 
    sum + j.items.reduce((s, { item }) => s + (item.fee_amount || 0), 0)
  , 0);

  if (jurisdictionData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5" />
            Local Counsel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No local counsel work items in this proposal yet.</p>
            <p className="text-xs mt-1">Select "Local Counsel" as provider on any work item to add one.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {jurisdictionData.map((jData) => {
          const firms = getFirmsForCountry(jData.country);
          const countryTotal = jData.items.reduce((sum, { item }) => sum + (item.fee_amount || 0), 0);
          
          return (
            <Card key={jData.country}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant={jData.country === 'Unassigned' ? 'destructive' : 'secondary'} className="text-sm">
                      {jData.country}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {jData.items.length} work item{jData.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      {getCurrencySymbol(proposalCurrency)}{countryTotal.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {jData.country === 'Unassigned' ? (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                    These work items need a country assigned. Set the country in the Work Items tab.
                  </div>
                ) : (
                  <>
                    {/* Firms Table */}
                    {firms.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-12"></TableHead>
                              <TableHead>Firm</TableHead>
                              <TableHead className="text-right">Lower</TableHead>
                              <TableHead className="text-right">Upper</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                              <TableHead className="w-24"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {firms.map((firm) => {
                              const isActive = firm.id === jData.activeFirmId;
                              const hasQuotes = firmHasQuotesForCountry(firm.id, jData.country);
                              const totals = getFirmTotalForCountry(firm.id, jData.country);
                              
                              return (
                                <TableRow 
                                  key={firm.id}
                                  className={isActive ? 'bg-primary/5' : ''}
                                >
                                  <TableCell>
                                    <input
                                      type="radio"
                                      name={`firm-${jData.country}`}
                                      checked={isActive}
                                      onChange={() => handleSelectFirm(jData.country, firm.id)}
                                      className="h-4 w-4"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{firm.firm_name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {firm.currency}
                                        {firm.rate_card && ' • Has rate card'}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {hasQuotes ? (
                                      `${getCurrencySymbol(proposalCurrency)}${totals.lower.toLocaleString()}`
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {hasQuotes ? (
                                      `${getCurrencySymbol(proposalCurrency)}${totals.upper.toLocaleString()}`
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {hasQuotes ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 justify-end">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs"
                                        onClick={() => openQuoteDialog(firm, jData.country)}
                                      >
                                        {hasQuotes ? 'Edit' : 'Enter'} Quotes
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => handleOpenEditFirm(firm)}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => deleteEntry.mutate(firm.id)}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded text-center">
                        No local counsel firms added for {jData.country} yet.
                      </div>
                    )}

                    {/* Add firm button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAddFirm(jData.country)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Local Counsel Firm
                    </Button>

                    {/* Work items list */}
                    <div className="border-t pt-3">
                      <p className="text-xs text-muted-foreground mb-2">Work items in this jurisdiction:</p>
                      <ul className="text-sm space-y-1">
                        {jData.items.map(({ item, index }) => (
                          <li key={index} className="flex justify-between text-muted-foreground">
                            <span className="truncate">• {item.work_item}</span>
                            <span className="ml-2 font-mono text-xs">
                              {getCurrencySymbol(proposalCurrency)}{(item.fee_amount || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Grand total */}
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Local Counsel Fees</span>
              <span className="text-xl font-bold">
                {getCurrencySymbol(proposalCurrency)}{grandTotal.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quote Entry Dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enter Quotes — {quotingFirm?.firm_name}</DialogTitle>
            <DialogDescription>
              Enter the fee estimates from {quotingFirm?.firm_name} for each work item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {getQuoteWorkItems().map(({ item, workItemKey }) => (
              <div key={workItemKey} className="border rounded-lg p-3 space-y-2">
                <Label className="font-medium text-sm">{item.work_item}</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Lower Estimate</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={quoteEntries[workItemKey]?.lower || ''}
                      onChange={(e) => setQuoteEntries(prev => ({
                        ...prev,
                        [workItemKey]: { ...prev[workItemKey], lower: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Upper Estimate</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={quoteEntries[workItemKey]?.upper || ''}
                      onChange={(e) => setQuoteEntries(prev => ({
                        ...prev,
                        [workItemKey]: { ...prev[workItemKey], upper: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Fee Amount</Label>
                    <Input
                      type="number"
                      placeholder="Midpoint"
                      value={quoteEntries[workItemKey]?.amount || ''}
                      onChange={(e) => setQuoteEntries(prev => ({
                        ...prev,
                        [workItemKey]: { ...prev[workItemKey], amount: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setQuoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleSaveQuotesOnly} disabled={upsertQuotes.isPending}>
              Save Quotes Only
            </Button>
            <Button onClick={handleSaveQuotesAndSelect} disabled={upsertQuotes.isPending}>
              Save & Select This Firm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Firm Dialog */}
      <Dialog open={addFirmDialogOpen} onOpenChange={setAddFirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Local Counsel Firm</DialogTitle>
            <DialogDescription>
              Add a firm for {targetCountry}. You'll enter their quotes next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Firm Name *</Label>
              <Input
                value={formFirmName}
                onChange={(e) => setFormFirmName(e.target.value)}
                placeholder="e.g. Rodriguez & Partners"
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <CountryCombobox value={formCountry} onValueChange={setFormCountry} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={formCurrency} onValueChange={setFormCurrency}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((curr) => (
                    <SelectItem key={curr} value={curr}>
                      {curr} ({CURRENCY_SYMBOLS[curr]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="addShowRateCard"
                  checked={showRateCard}
                  onChange={(e) => setShowRateCard(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="addShowRateCard" className="cursor-pointer">
                  Add rate card (optional)
                </Label>
              </div>
              {showRateCard && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Partner Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.partner?.rate || ''}
                      onChange={(e) => setFormRateCard({ ...formRateCard, partner: { rate: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sr. Associate Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.seniorAssociate?.rate || ''}
                      onChange={(e) => setFormRateCard({ ...formRateCard, seniorAssociate: { rate: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Associate Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.associate?.rate || ''}
                      onChange={(e) => setFormRateCard({ ...formRateCard, associate: { rate: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Trainee Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.trainee?.rate || ''}
                      onChange={(e) => setFormRateCard({ ...formRateCard, trainee: { rate: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNewFirm} disabled={!formFirmName.trim() || createEntry.isPending}>
              Add Firm & Enter Quotes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Firm Dialog */}
      <Dialog open={editFirmDialogOpen} onOpenChange={setEditFirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Local Counsel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Firm Name</Label>
              <Input value={formFirmName} onChange={(e) => setFormFirmName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <CountryCombobox value={formCountry} onValueChange={setFormCountry} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={formCurrency} onValueChange={setFormCurrency}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((curr) => (
                    <SelectItem key={curr} value={curr}>
                      {curr} ({CURRENCY_SYMBOLS[curr]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editShowRateCard"
                  checked={showRateCard}
                  onChange={(e) => setShowRateCard(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="editShowRateCard" className="cursor-pointer">
                  Rate card
                </Label>
              </div>
              {showRateCard && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Partner Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.partner?.rate || ''}
                      onChange={(e) => setFormRateCard({ ...formRateCard, partner: { rate: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sr. Associate Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.seniorAssociate?.rate || ''}
                      onChange={(e) => setFormRateCard({ ...formRateCard, seniorAssociate: { rate: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Associate Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.associate?.rate || ''}
                      onChange={(e) => setFormRateCard({ ...formRateCard, associate: { rate: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Trainee Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.trainee?.rate || ''}
                      onChange={(e) => setFormRateCard({ ...formRateCard, trainee: { rate: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditFirm} disabled={!formFirmName.trim() || updateEntry.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
