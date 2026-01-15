import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currencyUtils';
import { AlertTriangle, Check, X, Search, ChevronDown, ChevronRight } from 'lucide-react';

export interface ImportedMatterData {
  rowIndex: number;
  matterNumber: string;
  matterName: string;
  matchedMatterId: string | null;
  matchedMatterName: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  currency: string;
  wip: { value: number; current: number; changed: boolean; selected: boolean };
  accountsReceivable: { value: number; current: number; changed: boolean; selected: boolean };
  totalBilled: { value: number; current: number; changed: boolean; selected: boolean };
  totalPaid: { value: number; current: number; changed: boolean; selected: boolean };
  selected: boolean;
}

interface WipImportReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedData: ImportedMatterData[]) => Promise<void>;
  importedData: ImportedMatterData[];
  unmatchedData: ImportedMatterData[];
  existingMatters: Array<{ id: string; matter_name: string; matter_number: string; client_name: string }>;
}

const TOLERANCE = 0.005; // 0.5%

function isWithinTolerance(newValue: number, currentValue: number): boolean {
  if (currentValue === 0) return newValue === 0;
  const diff = Math.abs(newValue - currentValue) / Math.abs(currentValue);
  return diff <= TOLERANCE;
}

export function WipImportReviewDialog({
  isOpen,
  onClose,
  onConfirm,
  importedData: initialImportedData,
  unmatchedData: initialUnmatchedData,
  existingMatters,
}: WipImportReviewDialogProps) {
  const [importedData, setImportedData] = useState<ImportedMatterData[]>(initialImportedData);
  const [unmatchedData, setUnmatchedData] = useState<ImportedMatterData[]>(initialUnmatchedData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Filter to only show changed items by default
  const changedData = useMemo(() => {
    return importedData.filter((item) => 
      item.wip.changed || item.accountsReceivable.changed || 
      item.totalBilled.changed || item.totalPaid.changed
    );
  }, [importedData]);

  const displayData = showUnchanged ? importedData : changedData;

  const filteredData = useMemo(() => {
    if (!searchTerm) return displayData;
    const lower = searchTerm.toLowerCase();
    return displayData.filter((item) =>
      item.matterNumber.toLowerCase().includes(lower) ||
      item.matterName.toLowerCase().includes(lower) ||
      item.matchedMatterName?.toLowerCase().includes(lower)
    );
  }, [displayData, searchTerm]);

  const stats = useMemo(() => {
    const matched = importedData.filter((d) => d.matchedMatterId).length;
    const changed = changedData.length;
    const unchanged = importedData.length - changed;
    const selectedMatters = importedData.filter((d) => d.selected && d.matchedMatterId).length;
    const selectedFields = importedData.reduce((sum, d) => {
      if (!d.selected || !d.matchedMatterId) return sum;
      return sum + 
        (d.wip.selected && d.wip.changed ? 1 : 0) +
        (d.accountsReceivable.selected && d.accountsReceivable.changed ? 1 : 0) +
        (d.totalBilled.selected && d.totalBilled.changed ? 1 : 0) +
        (d.totalPaid.selected && d.totalPaid.changed ? 1 : 0);
    }, 0);
    return { matched, changed, unchanged, selectedMatters, selectedFields, unmatched: unmatchedData.length };
  }, [importedData, changedData, unmatchedData]);

  const toggleMatterSelection = (rowIndex: number) => {
    setImportedData((prev) =>
      prev.map((item) =>
        item.rowIndex === rowIndex ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleFieldSelection = (rowIndex: number, field: 'wip' | 'accountsReceivable' | 'totalBilled' | 'totalPaid') => {
    setImportedData((prev) =>
      prev.map((item) =>
        item.rowIndex === rowIndex
          ? { ...item, [field]: { ...item[field], selected: !item[field].selected } }
          : item
      )
    );
  };

  const selectAll = () => {
    setImportedData((prev) =>
      prev.map((item) => ({
        ...item,
        selected: true,
        wip: { ...item.wip, selected: item.wip.changed },
        accountsReceivable: { ...item.accountsReceivable, selected: item.accountsReceivable.changed },
        totalBilled: { ...item.totalBilled, selected: item.totalBilled.changed },
        totalPaid: { ...item.totalPaid, selected: item.totalPaid.changed },
      }))
    );
  };

  const deselectAll = () => {
    setImportedData((prev) =>
      prev.map((item) => ({
        ...item,
        selected: false,
        wip: { ...item.wip, selected: false },
        accountsReceivable: { ...item.accountsReceivable, selected: false },
        totalBilled: { ...item.totalBilled, selected: false },
        totalPaid: { ...item.totalPaid, selected: false },
      }))
    );
  };

  const assignUnmatchedToMatter = (rowIndex: number, matterId: string) => {
    const matter = existingMatters.find((m) => m.id === matterId);
    if (!matter) return;

    // Move from unmatched to matched
    setUnmatchedData((prev) => prev.filter((d) => d.rowIndex !== rowIndex));
    const item = initialUnmatchedData.find((d) => d.rowIndex === rowIndex);
    if (item) {
      setImportedData((prev) => [
        ...prev,
        {
          ...item,
          matchedMatterId: matterId,
          matchedMatterName: matter.matter_name,
          matchConfidence: 'high',
          selected: true,
        },
      ]);
    }
  };

  const dismissUnmatched = (rowIndex: number) => {
    setUnmatchedData((prev) => prev.filter((d) => d.rowIndex !== rowIndex));
  };

  const toggleRowExpanded = (rowIndex: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const selectedData = importedData.filter((d) => d.selected && d.matchedMatterId);
      await onConfirm(selectedData);
      onClose();
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFieldChange = (
    item: ImportedMatterData,
    field: 'wip' | 'accountsReceivable' | 'totalBilled' | 'totalPaid',
    label: string
  ) => {
    const data = item[field];
    if (!data.changed) return null;

    const isIncrease = data.value > data.current;
    const diff = data.value - data.current;

    return (
      <div className="flex items-center gap-2 py-1">
        <Checkbox
          checked={data.selected}
          onCheckedChange={() => toggleFieldSelection(item.rowIndex, field)}
          disabled={!item.selected}
        />
        <span className="text-sm w-24 text-muted-foreground">{label}:</span>
        <span className="text-sm text-muted-foreground line-through">
          {formatCurrency(data.current, item.currency)}
        </span>
        <span className="text-sm">→</span>
        <span className={cn('text-sm font-medium', data.selected ? 'text-foreground' : 'text-muted-foreground')}>
          {formatCurrency(data.value, item.currency)}
        </span>
        <Badge variant={isIncrease ? 'default' : 'secondary'} className="text-xs">
          {isIncrease ? '+' : ''}{formatCurrency(diff, item.currency)}
        </Badge>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Import Data</DialogTitle>
          <DialogDescription>
            Review and select which changes to apply. Only items with changes (beyond 0.5% tolerance) are shown by default.
          </DialogDescription>
        </DialogHeader>

        {/* Stats Bar */}
        <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg text-sm">
          <div>
            <span className="text-muted-foreground">Matched:</span>{' '}
            <span className="font-medium">{stats.matched}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Changed:</span>{' '}
            <span className="font-medium text-amber-600">{stats.changed}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Unchanged:</span>{' '}
            <span className="font-medium text-muted-foreground">{stats.unchanged}</span>
          </div>
          {stats.unmatched > 0 && (
            <div>
              <span className="text-muted-foreground">Unmatched:</span>{' '}
              <span className="font-medium text-destructive">{stats.unmatched}</span>
            </div>
          )}
          <div className="ml-auto">
            <span className="text-muted-foreground">Will import:</span>{' '}
            <span className="font-medium text-primary">{stats.selectedFields} fields</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search matters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showUnchanged}
              onCheckedChange={(checked) => setShowUnchanged(!!checked)}
            />
            Show unchanged
          </label>
          <div className="flex gap-1 ml-auto">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
          </div>
        </div>

        {/* Data List */}
        <ScrollArea className="flex-1 border rounded-lg">
          <div className="divide-y">
            {filteredData.map((item) => {
              const hasChanges = item.wip.changed || item.accountsReceivable.changed || 
                                 item.totalBilled.changed || item.totalPaid.changed;
              const isExpanded = expandedRows.has(item.rowIndex);

              return (
                <div key={item.rowIndex} className={cn('p-3', !item.selected && 'opacity-60')}>
                  {/* Matter Header Row */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => toggleMatterSelection(item.rowIndex)}
                    />
                    <button
                      onClick={() => toggleRowExpanded(item.rowIndex)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {item.matchedMatterName || item.matterName}
                        </span>
                        {item.matchConfidence !== 'high' && (
                          <Badge variant="outline" className="text-xs">
                            {item.matchConfidence} match
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.matterNumber}
                      </div>
                    </div>
                    {!hasChanges && (
                      <Badge variant="secondary" className="text-xs">
                        No changes
                      </Badge>
                    )}
                  </div>

                  {/* Expanded Field Details */}
                  {isExpanded && hasChanges && (
                    <div className="ml-12 mt-2 pl-3 border-l-2 border-muted">
                      {renderFieldChange(item, 'wip', 'WIP')}
                      {renderFieldChange(item, 'accountsReceivable', 'AR')}
                      {renderFieldChange(item, 'totalBilled', 'Billed')}
                      {renderFieldChange(item, 'totalPaid', 'Paid')}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredData.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                {showUnchanged ? 'No matching items found' : 'No changes detected (all values within 0.5% tolerance)'}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Unmatched Items Section */}
        {unmatchedData.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Unmatched Items ({unmatchedData.length})
            </div>
            <div className="border rounded-lg divide-y max-h-40 overflow-auto">
              {unmatchedData.map((item) => (
                <div key={item.rowIndex} className="p-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.matterName}</div>
                    <div className="text-xs text-muted-foreground">{item.matterNumber}</div>
                  </div>
                  <Select onValueChange={(value) => assignUnmatchedToMatter(item.rowIndex, value)}>
                    <SelectTrigger className="w-48 h-8">
                      <SelectValue placeholder="Assign to matter..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingMatters.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="truncate">{m.client_name} - {m.matter_name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissUnmatched(item.rowIndex)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting || stats.selectedFields === 0}>
            {isSubmitting ? 'Importing...' : `Import ${stats.selectedFields} Changes`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
