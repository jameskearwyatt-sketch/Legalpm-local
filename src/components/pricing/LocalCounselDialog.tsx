import { useState, useEffect } from 'react';
import { Plus, Trash2, Building2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CountryCombobox } from './CountryCombobox';
import { useLocalCounselLibrary, LocalCounselLibraryEntry, LocalCounselRateCard } from '@/lib/hooks/useLocalCounselLibrary';
import { CURRENCY_SYMBOLS } from '@/lib/currencyUtils';

interface LocalCounselDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectLocalCounsel?: (entry: LocalCounselLibraryEntry) => void;
}

const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

export function LocalCounselDialog({
  open,
  onOpenChange,
  onSelectLocalCounsel,
}: LocalCounselDialogProps) {
  const { library, entriesByCountry, countries, createEntry, updateEntry, deleteEntry } = useLocalCounselLibrary();

  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingEntry, setEditingEntry] = useState<LocalCounselLibraryEntry | null>(null);

  // Form state
  const [firmName, setFirmName] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [rateCard, setRateCard] = useState<LocalCounselRateCard>({});
  const [showRateCard, setShowRateCard] = useState(false);

  useEffect(() => {
    if (mode === 'list') {
      resetForm();
    }
  }, [mode]);

  useEffect(() => {
    if (editingEntry) {
      setFirmName(editingEntry.firm_name);
      setCountry(editingEntry.country);
      setCurrency(editingEntry.currency);
      setRateCard(editingEntry.rate_card || {});
      setShowRateCard(!!editingEntry.rate_card);
    }
  }, [editingEntry]);

  const resetForm = () => {
    setFirmName('');
    setCountry('');
    setCurrency('GBP');
    setRateCard({});
    setShowRateCard(false);
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!firmName.trim() || !country) return;

    const rateCardData = showRateCard && Object.keys(rateCard).length > 0 ? rateCard : null;

    if (mode === 'edit' && editingEntry) {
      await updateEntry.mutateAsync({
        id: editingEntry.id,
        firm_name: firmName.trim(),
        country,
        currency,
        rate_card: rateCardData,
      });
    } else {
      await createEntry.mutateAsync({
        firm_name: firmName.trim(),
        country,
        currency,
        rate_card: rateCardData,
      });
    }
    setMode('list');
  };

  const handleDelete = async (id: string) => {
    await deleteEntry.mutateAsync(id);
  };

  const handleEdit = (entry: LocalCounselLibraryEntry) => {
    setEditingEntry(entry);
    setMode('edit');
  };

  const handleSelect = (entry: LocalCounselLibraryEntry) => {
    onSelectLocalCounsel?.(entry);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {mode === 'list' ? 'Local Counsel Library' : mode === 'add' ? 'Add Local Counsel' : 'Edit Local Counsel'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'list' 
              ? 'Manage your library of local counsel firms. These can be reused across any proposal.'
              : 'Enter details for the local counsel firm.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'list' ? (
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {countries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No local counsel firms in your library yet.</p>
                <Button className="mt-4" onClick={() => setMode('add')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Local Counsel
                </Button>
              </div>
            ) : (
              <>
                {countries.map((countryName) => (
                  <Card key={countryName}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium">{countryName}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-0 pb-3">
                      <div className="space-y-2">
                        {entriesByCountry[countryName]?.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium text-sm">{entry.firm_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-xs">
                                    {entry.currency}
                                  </Badge>
                                  {entry.rate_card && (
                                    <Badge variant="secondary" className="text-xs">
                                      Rate card
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {onSelectLocalCounsel && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleSelect(entry)}
                                >
                                  Select
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(entry)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(entry.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Firm Name *</Label>
                <Input
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="e.g. Smith & Partners"
                />
              </div>
              <div className="space-y-2">
                <Label>Country *</Label>
                <CountryCombobox
                  value={country}
                  onValueChange={setCountry}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[200px]">
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
                  id="showRateCard"
                  checked={showRateCard}
                  onChange={(e) => setShowRateCard(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="showRateCard" className="cursor-pointer">
                  Add rate card (optional)
                </Label>
              </div>

              {showRateCard && (
                <Card className="mt-2">
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Partner Rate</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 500"
                          value={rateCard.partner?.rate || ''}
                          onChange={(e) => setRateCard({
                            ...rateCard,
                            partner: { rate: parseFloat(e.target.value) || 0 }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Senior Associate Rate</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 350"
                          value={rateCard.seniorAssociate?.rate || ''}
                          onChange={(e) => setRateCard({
                            ...rateCard,
                            seniorAssociate: { rate: parseFloat(e.target.value) || 0 }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Associate Rate</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 250"
                          value={rateCard.associate?.rate || ''}
                          onChange={(e) => setRateCard({
                            ...rateCard,
                            associate: { rate: parseFloat(e.target.value) || 0 }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Trainee Rate</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 150"
                          value={rateCard.trainee?.rate || ''}
                          onChange={(e) => setRateCard({
                            ...rateCard,
                            trainee: { rate: parseFloat(e.target.value) || 0 }
                          })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {mode === 'list' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {countries.length > 0 && (
                <Button onClick={() => setMode('add')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Local Counsel
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setMode('list')}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!firmName.trim() || !country || createEntry.isPending || updateEntry.isPending}
              >
                {mode === 'edit' ? 'Save Changes' : 'Add to Library'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
