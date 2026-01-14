import { useState, useMemo } from 'react';
import { Building2, Globe, Plus, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
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
import { getCurrencySymbol, CURRENCY_SYMBOLS } from '@/lib/currencyUtils';
import { CountryCombobox } from './CountryCombobox';

const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

interface LocalCounselPanelProps {
  draftItems: DraftProposalItem[];
  onUpdateItem: (index: number, updates: Partial<DraftProposalItem>) => void;
  proposalCurrency: string;
}

interface FirmQuote {
  libraryEntry: LocalCounselLibraryEntry;
  lowerEstimate: number;
  upperEstimate: number;
  isActive: boolean;
}

interface JurisdictionData {
  country: string;
  items: { item: DraftProposalItem; index: number }[];
  firms: FirmQuote[];
  activeFirmId?: string;
}

export function LocalCounselPanel({
  draftItems,
  onUpdateItem,
  proposalCurrency,
}: LocalCounselPanelProps) {
  const { library, entriesByCountry, createEntry, updateEntry, deleteEntry } = useLocalCounselLibrary();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState<LocalCounselLibraryEntry | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addToCountry, setAddToCountry] = useState<string>('');
  
  // Form state for add/edit
  const [formFirmName, setFormFirmName] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formRateCard, setFormRateCard] = useState<LocalCounselRateCard>({});
  const [showRateCard, setShowRateCard] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());

  // Group local counsel items by country and collect all firms for each country
  const jurisdictionData = useMemo(() => {
    const byCountry: Record<string, JurisdictionData> = {};

    // First, group items by country
    draftItems.forEach((item, index) => {
      if (item.provider === 'Local Counsel') {
        const country = (item as any).lc_country || 'Unassigned';
        const firmId = (item as any).lc_library_id;
        
        if (!byCountry[country]) {
          byCountry[country] = {
            country,
            items: [],
            firms: [],
            activeFirmId: firmId,
          };
        }
        
        byCountry[country].items.push({ item, index });
        if (firmId) {
          byCountry[country].activeFirmId = firmId;
        }
      }
    });

    // Add all library firms for each country (including ones not yet used)
    Object.keys(byCountry).forEach(country => {
      if (country !== 'Unassigned') {
        const countryFirms = entriesByCountry[country] || [];
        byCountry[country].firms = countryFirms.map(firm => ({
          libraryEntry: firm,
          lowerEstimate: 0,
          upperEstimate: 0,
          isActive: firm.id === byCountry[country].activeFirmId,
        }));
      }
    });

    return Object.values(byCountry).sort((a, b) => {
      if (a.country === 'Unassigned') return 1;
      if (b.country === 'Unassigned') return -1;
      return a.country.localeCompare(b.country);
    });
  }, [draftItems, entriesByCountry]);

  // Calculate totals
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
    const activeFirm = group.firms.find(f => f.libraryEntry.id === group.activeFirmId);
    if (activeFirm) return activeFirm.libraryEntry.firm_name;
    
    // Fall back to firm name from items
    const itemWithFirm = group.items.find(({ item }) => item.lc_firm_name);
    return itemWithFirm?.item.lc_firm_name || 'Not set';
  };

  // Switch to a different firm for this jurisdiction
  const handleSwitchFirm = (group: JurisdictionData, firmId: string) => {
    const firm = library.find(f => f.id === firmId);
    if (!firm) return;

    group.items.forEach(({ index }) => {
      onUpdateItem(index, {
        lc_firm_name: firm.firm_name,
        ...(({ lc_country: firm.country, lc_library_id: firm.id, lc_currency: firm.currency }) as any),
      });
    });
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

  // Save new firm
  const handleSaveNew = async () => {
    if (!formFirmName.trim() || !formCountry) return;
    
    await createEntry.mutateAsync({
      firm_name: formFirmName.trim(),
      country: formCountry,
      currency: formCurrency,
      rate_card: showRateCard ? formRateCard : null,
    });
    
    setAddDialogOpen(false);
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
                        <Label className="text-xs text-muted-foreground">Firms in this jurisdiction:</Label>
                        {group.firms.map((firmQuote) => (
                          <div
                            key={firmQuote.libraryEntry.id}
                            className={`flex items-center justify-between p-2 rounded border ${
                              firmQuote.libraryEntry.id === group.activeFirmId
                                ? 'border-primary bg-primary/5'
                                : 'border-border'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`active-firm-${group.country}`}
                                checked={firmQuote.libraryEntry.id === group.activeFirmId}
                                onChange={() => handleSwitchFirm(group, firmQuote.libraryEntry.id)}
                                className="h-4 w-4"
                              />
                              <div>
                                <p className="text-sm font-medium">{firmQuote.libraryEntry.firm_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {firmQuote.libraryEntry.currency}
                                  {firmQuote.libraryEntry.rate_card && ' • Has rate card'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditFirm(firmQuote.libraryEntry);
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
                                  handleDeleteFirm(firmQuote.libraryEntry.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
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
                          <li key={index} className="text-muted-foreground truncate">
                            • {item.work_item || 'Untitled item'}
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
              Add another local counsel firm for {addToCountry}.
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
              Add Firm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
