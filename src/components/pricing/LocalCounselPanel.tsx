import { useMemo } from 'react';
import { Building2, Globe, Plus, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DraftProposalItem } from '@/lib/hooks/usePricingProposals';
import { useLocalCounselLibrary, LocalCounselLibraryEntry } from '@/lib/hooks/useLocalCounselLibrary';
import { getCurrencySymbol } from '@/lib/currencyUtils';

interface LocalCounselPanelProps {
  draftItems: DraftProposalItem[];
  onUpdateItem: (index: number, updates: Partial<DraftProposalItem>) => void;
  onOpenLibrary: () => void;
  proposalCurrency: string;
}

interface JurisdictionGroup {
  country: string;
  items: { item: DraftProposalItem; index: number }[];
  availableFirms: LocalCounselLibraryEntry[];
  selectedFirmId?: string;
}

export function LocalCounselPanel({
  draftItems,
  onUpdateItem,
  onOpenLibrary,
  proposalCurrency,
}: LocalCounselPanelProps) {
  const { library, entriesByCountry } = useLocalCounselLibrary();

  // Group local counsel items by country/jurisdiction
  const jurisdictionGroups = useMemo(() => {
    const groups: Record<string, JurisdictionGroup> = {};

    draftItems.forEach((item, index) => {
      if (item.provider === 'Local Counsel') {
        const country = (item as any).lc_country || 'Unassigned';
        
        if (!groups[country]) {
          groups[country] = {
            country,
            items: [],
            availableFirms: entriesByCountry[country] || [],
            selectedFirmId: undefined,
          };
        }
        
        groups[country].items.push({ item, index });
        
        // Track which firm is currently selected (if any)
        if ((item as any).lc_library_id) {
          groups[country].selectedFirmId = (item as any).lc_library_id;
        }
      }
    });

    return Object.values(groups).sort((a, b) => {
      if (a.country === 'Unassigned') return 1;
      if (b.country === 'Unassigned') return -1;
      return a.country.localeCompare(b.country);
    });
  }, [draftItems, entriesByCountry]);

  // Calculate totals by jurisdiction
  const jurisdictionTotals = useMemo(() => {
    return jurisdictionGroups.map(group => ({
      ...group,
      total: group.items.reduce((sum, { item }) => sum + (item.fee_amount || 0), 0),
      lowerTotal: group.items.reduce((sum, { item }) => sum + ((item as any).fee_lower ?? item.fee_amount ?? 0), 0),
      upperTotal: group.items.reduce((sum, { item }) => sum + ((item as any).fee_upper ?? item.fee_amount ?? 0), 0),
    }));
  }, [jurisdictionGroups]);

  const grandTotal = jurisdictionTotals.reduce((sum, j) => sum + j.total, 0);

  // Handle switching between local counsel firms for a jurisdiction
  const handleSwitchFirm = (jurisdiction: JurisdictionGroup, firmId: string) => {
    const firm = library.find(f => f.id === firmId);
    if (!firm) return;

    // Update all items in this jurisdiction to use the new firm
    jurisdiction.items.forEach(({ index }) => {
      onUpdateItem(index, {
        lc_firm_name: firm.firm_name,
        ...(({ lc_country: firm.country, lc_library_id: firm.id, lc_currency: firm.currency }) as any),
      });
    });
  };

  if (jurisdictionGroups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5" />
            Local Counsel Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No local counsel work items in this proposal yet.</p>
            <p className="text-xs mt-1">Select "Local Counsel" as provider on any work item to add one.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onOpenLibrary}>
              <Plus className="h-4 w-4 mr-2" />
              Manage Local Counsel Library
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5" />
            Local Counsel Summary
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onOpenLibrary}>
            <Building2 className="h-4 w-4 mr-2" />
            Manage Library
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {jurisdictionTotals.map((group) => (
          <div key={group.country} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={group.country === 'Unassigned' ? 'destructive' : 'secondary'}>
                  {group.country}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                </span>
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

            {/* Show current firm and switcher if multiple firms available */}
            {group.country !== 'Unassigned' && group.availableFirms.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Firm:</span>
                {group.availableFirms.length === 1 ? (
                  <Badge variant="outline">{group.availableFirms[0].firm_name}</Badge>
                ) : (
                  <Select
                    value={group.selectedFirmId || group.availableFirms[0]?.id}
                    onValueChange={(value) => handleSwitchFirm(group, value)}
                  >
                    <SelectTrigger className="h-7 text-xs w-auto min-w-[150px]">
                      <SelectValue placeholder="Select firm" />
                    </SelectTrigger>
                    <SelectContent>
                      {group.availableFirms.map((firm) => (
                        <SelectItem key={firm.id} value={firm.id}>
                          {firm.firm_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Show unassigned items warning */}
            {group.country === 'Unassigned' && (
              <p className="text-xs text-destructive">
                These items need a country assigned. Click on each item to set the local counsel details.
              </p>
            )}
          </div>
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
  );
}
