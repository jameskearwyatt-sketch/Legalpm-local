import { useState, useMemo, useEffect } from 'react';
import { Building2, Globe, Plus, Edit2, Trash2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { DraftProposalItem } from '@/lib/hooks/usePricingProposals';
import { useLocalCounselLibrary, LocalCounselLibraryEntry, LocalCounselRateCard } from '@/lib/hooks/useLocalCounselLibrary';
import { useLcWorkItemQuotes, LcWorkItemQuote } from '@/lib/hooks/useLcWorkItemQuotes';
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

interface JurisdictionData {
  country: string;
  items: { item: DraftProposalItem; index: number; workItemKey: string }[];
  firms: LocalCounselLibraryEntry[];
  activeFirmId?: string;
}

// Generate a stable key for a work item based on its content
function getWorkItemKey(item: DraftProposalItem, index: number): string {
  // Use the work item text as the key (or fallback to index-based)
  return item.work_item?.trim() || `item-${index}`;
}

export function LocalCounselPanel({
  draftItems,
  onUpdateItem,
  proposalCurrency,
  proposalId,
}: LocalCounselPanelProps) {
  const { library, entriesByCountry, createEntry, updateEntry, deleteEntry } = useLocalCounselLibrary();
  const { quotesByFirm, upsertQuotes, getQuotesForFirm, firmHasAllQuotes, getFirmTotal } = useLcWorkItemQuotes(proposalId);
  const { toast } = useToast();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState<LocalCounselLibraryEntry | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addToCountry, setAddToCountry] = useState<string>('');
  
  // Quote entry dialog state
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quotingFirm, setQuotingFirm] = useState<LocalCounselLibraryEntry | null>(null);
  const [quotingCountry, setQuotingCountry] = useState<string>('');
  const [quoteEntries, setQuoteEntries] = useState<Record<string, { lower: string; upper: string; amount: string }>>({});
  
  // Form state for add/edit firm
  const [formFirmName, setFormFirmName] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formRateCard, setFormRateCard] = useState<LocalCounselRateCard>({});
  const [showRateCard, setShowRateCard] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());

  // Group local counsel items by country
  const jurisdictionData = useMemo(() => {
    const byCountry: Record<string, JurisdictionData> = {};

    draftItems.forEach((item, index) => {
      if (item.provider === 'Local Counsel') {
        const country = (item as any).lc_country || 'Unassigned';
        const firmId = (item as any).lc_library_id;
        const workItemKey = getWorkItemKey(item, index);
        
        if (!byCountry[country]) {
          byCountry[country] = {
            country,
            items: [],
            firms: [],
            activeFirmId: firmId,
          };
        }
        
        byCountry[country].items.push({ item, index, workItemKey });
        if (firmId) {
          byCountry[country].activeFirmId = firmId;
        }
      }
    });

    // Add all library firms for each country
    Object.keys(byCountry).forEach(country => {
      if (country !== 'Unassigned') {
        byCountry[country].firms = entriesByCountry[country] || [];
      }
    });

    return Object.values(byCountry).sort((a, b) => {
      if (a.country === 'Unassigned') return 1;
      if (b.country === 'Unassigned') return -1;
      return a.country.localeCompare(b.country);
    });
  }, [draftItems, entriesByCountry]);

  // Calculate totals from current item values
  const jurisdictionTotals = useMemo(() => {
    return jurisdictionData.map(group => ({
      ...group,
      total: group.items.reduce((sum, { item }) => sum + (item.fee_amount || 0), 0),
      lowerTotal: group.items.reduce((sum, { item }) => sum + ((item as any).fee_lower ?? item.fee_amount ?? 0), 0),
      upperTotal: group.items.reduce((sum, { item }) => sum + ((item as any).fee_upper ?? item.fee_amount ?? 0), 0),
    }));
  }, [jurisdictionData]);

  const grandTotal = jurisdictionTotals.reduce((sum, j) => sum + j.total, 0);

  // Get current active firm name for a jurisdiction
  const getActiveFirmName = (group: JurisdictionData) => {
    const activeFirm = group.firms.find(f => f.id === group.activeFirmId);
    if (activeFirm) return activeFirm.firm_name;
    
    const itemWithFirm = group.items.find(({ item }) => item.lc_firm_name);
    return itemWithFirm?.item.lc_firm_name || 'Not set';
  };

  // Check if a firm has quotes for all work items in a jurisdiction
  const checkFirmHasQuotes = (firmId: string, group: JurisdictionData): boolean => {
    const workItemKeys = group.items.map(({ workItemKey }) => workItemKey);
    return firmHasAllQuotes(firmId, workItemKeys);
  };

  // Get total for a firm from stored quotes
  const getFirmQuoteTotal = (firmId: string, group: JurisdictionData) => {
    const workItemKeys = group.items.map(({ workItemKey }) => workItemKey);
    return getFirmTotal(firmId, workItemKeys);
  };

  // Switch to a different firm - apply their stored quotes to all work items
  const handleSwitchFirm = (group: JurisdictionData, firmId: string) => {
    const firm = library.find(f => f.id === firmId);
    if (!firm) return;

    const firmQuotes = getQuotesForFirm(firmId);
    const workItemKeys = group.items.map(({ workItemKey }) => workItemKey);
    
    // Check if firm has all required quotes
    const hasAllQuotes = workItemKeys.every(key => key in firmQuotes);
    
    if (!hasAllQuotes) {
      // Open quote entry dialog for this firm
      openQuoteDialog(firm, group.country, group);
      return;
    }

    // Apply the firm's quotes to all work items
    group.items.forEach(({ index, workItemKey }) => {
      const quote = firmQuotes[workItemKey];
      onUpdateItem(index, {
        lc_firm_name: firm.firm_name,
        fee_amount: quote?.fee_amount || 0,
        fee_lower: quote?.fee_lower || 0,
        fee_upper: quote?.fee_upper || 0,
        ...(({ lc_country: firm.country, lc_library_id: firm.id, lc_currency: firm.currency }) as any),
      });
    });

    toast({ title: `Switched to ${firm.firm_name}`, description: 'All work items updated with their quotes.' });
  };

  // Open quote entry dialog
  const openQuoteDialog = (firm: LocalCounselLibraryEntry, country: string, group?: JurisdictionData) => {
    setQuotingFirm(firm);
    setQuotingCountry(country);
    
    // Pre-populate with existing quotes or current values
    const firmQuotes = getQuotesForFirm(firm.id);
    const initialEntries: Record<string, { lower: string; upper: string; amount: string }> = {};
    
    const targetGroup = group || jurisdictionData.find(g => g.country === country);
    if (targetGroup) {
      targetGroup.items.forEach(({ item, workItemKey }) => {
        const existingQuote = firmQuotes[workItemKey];
        if (existingQuote) {
          initialEntries[workItemKey] = {
            lower: existingQuote.fee_lower.toString(),
            upper: existingQuote.fee_upper.toString(),
            amount: existingQuote.fee_amount.toString(),
          };
        } else {
          // Use current item values as starting point
          initialEntries[workItemKey] = {
            lower: ((item as any).fee_lower ?? item.fee_amount ?? 0).toString(),
            upper: ((item as any).fee_upper ?? item.fee_amount ?? 0).toString(),
            amount: (item.fee_amount ?? 0).toString(),
          };
        }
      });
    }
    
    setQuoteEntries(initialEntries);
    setQuoteDialogOpen(true);
  };

  // Save quotes and optionally switch to this firm
  const handleSaveQuotes = async (andSwitch: boolean = false) => {
    if (!quotingFirm) return;

    const group = jurisdictionData.find(g => g.country === quotingCountry);
    if (!group) return;

    // Build quote inputs
    const quoteInputs = group.items.map(({ workItemKey }) => {
      const entry = quoteEntries[workItemKey] || { lower: '0', upper: '0', amount: '0' };
      const lower = parseFloat(entry.lower) || 0;
      const upper = parseFloat(entry.upper) || 0;
      // Amount defaults to midpoint if not set
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
    toast({ title: 'Quotes saved', description: `Saved quotes for ${quotingFirm.firm_name}` });
    
    setQuoteDialogOpen(false);
    setQuotingFirm(null);

    // If switching, apply the quotes to work items
    if (andSwitch) {
      setTimeout(() => {
        group.items.forEach(({ index, workItemKey }) => {
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
        toast({ title: `Switched to ${quotingFirm.firm_name}` });
      }, 100);
    }
  };

  // Open edit dialog for a firm
  const handleEditFirm = (firm: LocalCounselLibraryEntry) => {
    setEditingFirm(firm);
    setFormFirmName(firm.firm_name);
    setFormCountry(firm.country);
    setFormCurrency(firm.currency);
    setFormRateCard(firm.rate_card || {});
    setShowRateCard(!!firm.rate_card);
    setEditDialogOpen(true);
  };

  // Open add dialog
  const handleAddFirm = (country: string) => {
    setAddToCountry(country);
    setFormFirmName('');
    setFormCountry(country);
    setFormCurrency('USD');
    setFormRateCard({});
    setShowRateCard(false);
    setAddDialogOpen(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingFirm || !formFirmName.trim()) return;
    
    await updateEntry.mutateAsync({
      id: editingFirm.id,
      firm_name: formFirmName.trim(),
      country: formCountry,
      currency: formCurrency,
      rate_card: showRateCard ? formRateCard : null,
    });
    
    setEditDialogOpen(false);
    setEditingFirm(null);
  };

  // Save new firm and open quote dialog
  const handleSaveNew = async () => {
    if (!formFirmName.trim() || !formCountry) return;
    
    const newFirm = await createEntry.mutateAsync({
      firm_name: formFirmName.trim(),
      country: formCountry,
      currency: formCurrency,
      rate_card: showRateCard ? formRateCard : null,
    });
    
    setAddDialogOpen(false);
    
    // After adding, open quote entry dialog for this firm
    if (newFirm) {
      setTimeout(() => {
        openQuoteDialog(newFirm as LocalCounselLibraryEntry, formCountry);
      }, 300);
    }
  };

  // Delete firm
  const handleDeleteFirm = async (firmId: string) => {
    await deleteEntry.mutateAsync(firmId);
  };

  // Toggle country expansion
  const toggleCountry = (country: string) => {
    setExpandedCountries(prev => {
      const next = new Set(prev);
      if (next.has(country)) {
        next.delete(country);
      } else {
        next.add(country);
      }
      return next;
    });
  };

  // Get work items for the quote dialog
  const getQuoteDialogItems = () => {
    const group = jurisdictionData.find(g => g.country === quotingCountry);
    return group?.items || [];
  };

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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5" />
            Local Counsel by Jurisdiction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {jurisdictionTotals.map((group) => (
            <Collapsible
              key={group.country}
              open={expandedCountries.has(group.country)}
              onOpenChange={() => toggleCountry(group.country)}
            >
              <div className="border rounded-lg overflow-hidden">
                {/* Header - always visible */}
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {expandedCountries.has(group.country) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Badge variant={group.country === 'Unassigned' ? 'destructive' : 'secondary'}>
                        {group.country}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {getActiveFirmName(group)}
                      </span>
                      {group.firms.length > 1 && (
                        <Badge variant="outline" className="text-xs">
                          {group.firms.length} firms
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {getCurrencySymbol(proposalCurrency)}{group.total.toLocaleString()}
                      </p>
                      {group.lowerTotal !== group.upperTotal && (
                        <p className="text-xs text-muted-foreground">
                          {getCurrencySymbol(proposalCurrency)}{group.lowerTotal.toLocaleString()} - {getCurrencySymbol(proposalCurrency)}{group.upperTotal.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                {/* Expanded content */}
                <CollapsibleContent>
                  <div className="border-t p-3 space-y-3 bg-muted/20">
                    {/* List of firms for this jurisdiction */}
                    {group.firms.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Competing firms:</Label>
                        {group.firms.map((firm) => {
                          const isActive = firm.id === group.activeFirmId;
                          const hasQuotes = checkFirmHasQuotes(firm.id, group);
                          const firmTotal = getFirmQuoteTotal(firm.id, group);
                          
                          return (
                            <div
                              key={firm.id}
                              className={`flex items-center justify-between p-2 rounded border ${
                                isActive
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="radio"
                                  name={`active-firm-${group.country}`}
                                  checked={isActive}
                                  onChange={() => handleSwitchFirm(group, firm.id)}
                                  className="h-4 w-4"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{firm.firm_name}</p>
                                    {hasQuotes ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {firm.currency}
                                    {firm.rate_card && ' • Has rate card'}
                                    {hasQuotes && ` • ${getCurrencySymbol(proposalCurrency)}${firmTotal.lower.toLocaleString()} - ${getCurrencySymbol(proposalCurrency)}${firmTotal.upper.toLocaleString()}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openQuoteDialog(firm, group.country, group);
                                  }}
                                >
                                  {hasQuotes ? 'Edit Quotes' : 'Enter Quotes'}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditFirm(firm);
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFirm(firm.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No firms saved for this jurisdiction yet.
                      </p>
                    )}

                    {/* Add new firm button */}
                    {group.country !== 'Unassigned' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleAddFirm(group.country)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Competing Firm
                      </Button>
                    )}

                    {/* Warning for unassigned */}
                    {group.country === 'Unassigned' && (
                      <p className="text-xs text-destructive">
                        Set a country on these work items in the Work Items tab to manage firms.
                      </p>
                    )}

                    {/* Work items in this jurisdiction */}
                    <div className="pt-2 border-t">
                      <Label className="text-xs text-muted-foreground">Work items ({group.items.length}):</Label>
                      <ul className="mt-1 text-sm space-y-1">
                        {group.items.map(({ item, index }) => (
                          <li key={index} className="flex justify-between text-muted-foreground">
                            <span className="truncate flex-1">• {item.work_item || 'Untitled item'}</span>
                            <span className="text-xs ml-2">
                              {getCurrencySymbol(proposalCurrency)}{(item.fee_amount || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}

          {/* Grand total */}
          <div className="pt-3 border-t flex justify-between items-center">
            <span className="font-medium">Total Local Counsel Fees</span>
            <span className="text-lg font-bold">
              {getCurrencySymbol(proposalCurrency)}{grandTotal.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quote Entry Dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enter Quotes - {quotingFirm?.firm_name}</DialogTitle>
            <DialogDescription>
              Enter fee estimates from {quotingFirm?.firm_name} for each work item in {quotingCountry}.
              {quotingFirm?.currency && ` (Currency: ${quotingFirm.currency})`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {getQuoteDialogItems().map(({ item, workItemKey }) => (
              <div key={workItemKey} className="border rounded-lg p-3 space-y-2">
                <Label className="font-medium text-sm">{item.work_item || 'Untitled item'}</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Lower Estimate</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={quoteEntries[workItemKey]?.lower || ''}
                      onChange={(e) => setQuoteEntries(prev => ({
                        ...prev,
                        [workItemKey]: {
                          ...prev[workItemKey],
                          lower: e.target.value,
                          // Auto-calculate amount as midpoint
                          amount: prev[workItemKey]?.amount || '',
                        }
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
                        [workItemKey]: {
                          ...prev[workItemKey],
                          upper: e.target.value,
                          amount: prev[workItemKey]?.amount || '',
                        }
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Fee Amount</Label>
                    <Input
                      type="number"
                      placeholder="Auto"
                      value={quoteEntries[workItemKey]?.amount || ''}
                      onChange={(e) => setQuoteEntries(prev => ({
                        ...prev,
                        [workItemKey]: {
                          ...prev[workItemKey],
                          amount: e.target.value,
                        }
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
            <Button 
              variant="secondary"
              onClick={() => handleSaveQuotes(false)} 
              disabled={upsertQuotes.isPending}
            >
              Save Quotes Only
            </Button>
            <Button 
              onClick={() => handleSaveQuotes(true)} 
              disabled={upsertQuotes.isPending}
            >
              Save & Switch to This Firm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Firm Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Local Counsel</DialogTitle>
            <DialogDescription>
              Update the details for this local counsel firm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Firm Name</Label>
              <Input
                value={formFirmName}
                onChange={(e) => setFormFirmName(e.target.value)}
                placeholder="e.g. Rodriguez & Partners"
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <CountryCombobox
                value={formCountry}
                onValueChange={setFormCountry}
              />
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
                  Rate card (optional)
                </Label>
              </div>
              {showRateCard && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Partner Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.partner?.rate || ''}
                      onChange={(e) => setFormRateCard({
                        ...formRateCard,
                        partner: { rate: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sr. Associate Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.seniorAssociate?.rate || ''}
                      onChange={(e) => setFormRateCard({
                        ...formRateCard,
                        seniorAssociate: { rate: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Associate Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.associate?.rate || ''}
                      onChange={(e) => setFormRateCard({
                        ...formRateCard,
                        associate: { rate: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Trainee Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.trainee?.rate || ''}
                      onChange={(e) => setFormRateCard({
                        ...formRateCard,
                        trainee: { rate: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!formFirmName.trim() || updateEntry.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Firm Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Competing Firm</DialogTitle>
            <DialogDescription>
              Add another local counsel firm for {addToCountry}. After adding, you'll be prompted to enter their quotes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Firm Name</Label>
              <Input
                value={formFirmName}
                onChange={(e) => setFormFirmName(e.target.value)}
                placeholder="e.g. Another Peru Firm"
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <CountryCombobox
                value={formCountry}
                onValueChange={setFormCountry}
              />
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
                  Rate card (optional)
                </Label>
              </div>
              {showRateCard && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Partner Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.partner?.rate || ''}
                      onChange={(e) => setFormRateCard({
                        ...formRateCard,
                        partner: { rate: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sr. Associate Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.seniorAssociate?.rate || ''}
                      onChange={(e) => setFormRateCard({
                        ...formRateCard,
                        seniorAssociate: { rate: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Associate Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.associate?.rate || ''}
                      onChange={(e) => setFormRateCard({
                        ...formRateCard,
                        associate: { rate: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Trainee Rate</Label>
                    <Input
                      type="number"
                      value={formRateCard.trainee?.rate || ''}
                      onChange={(e) => setFormRateCard({
                        ...formRateCard,
                        trainee: { rate: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNew} disabled={!formFirmName.trim() || !formCountry || createEntry.isPending}>
              Add Firm & Enter Quotes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
