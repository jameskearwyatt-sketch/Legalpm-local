import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, X, HelpCircle } from 'lucide-react';
import { ColumnMappings } from '@/lib/hooks/useReportFormats';

interface ReportFormatTrainingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formatName: string, mappings: ColumnMappings) => void;
  headers: string[];
  sampleRows: string[][];
  existingMappings?: ColumnMappings;
  existingName?: string;
}

type FieldType = 'matter_number' | 'matter_name' | 'client_name' | 'wip' | 'accounts_receivable' | 'total_billed' | 'total_paid' | 'wip_disbursements' | 'ar_disbursements' | 'paid_disbursements';

const FIELD_CONFIG: Record<FieldType, { label: string; color: string; required: boolean; group?: string }> = {
  matter_number: { label: 'Matter Number', color: 'bg-blue-500', required: true },
  matter_name: { label: 'Matter Name', color: 'bg-indigo-500', required: false },
  client_name: { label: 'Client Name', color: 'bg-cyan-500', required: false },
  wip: { label: 'WIP', color: 'bg-amber-500', required: true },
  accounts_receivable: { label: 'Accounts Receivable', color: 'bg-orange-500', required: true },
  total_billed: { label: 'Total Billed', color: 'bg-purple-500', required: true },
  total_paid: { label: 'Total Paid', color: 'bg-green-500', required: true },
  // Disbursement fields - optional, for local counsel tracking
  wip_disbursements: { label: 'WIP Disbursements', color: 'bg-rose-500', required: false, group: 'disbursements' },
  ar_disbursements: { label: 'AR Disbursements', color: 'bg-pink-500', required: false, group: 'disbursements' },
  paid_disbursements: { label: 'Paid Disbursements', color: 'bg-fuchsia-500', required: false, group: 'disbursements' },
};

export function ReportFormatTrainingDialog({
  isOpen,
  onClose,
  onSave,
  headers,
  sampleRows,
  existingMappings,
  existingName,
}: ReportFormatTrainingDialogProps) {
  const [formatName, setFormatName] = useState(existingName || '');
  const [mappings, setMappings] = useState<ColumnMappings>(existingMappings || {});
  const [activeField, setActiveField] = useState<FieldType | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormatName(existingName || '');
      setMappings(existingMappings || {});
      setActiveField(null);
    }
  }, [isOpen, existingName, existingMappings]);

  const handleColumnClick = (columnIndex: number) => {
    if (!activeField) return;
    
    // Remove this column from any other field that might have it
    const newMappings = { ...mappings };
    Object.keys(newMappings).forEach((key) => {
      if (newMappings[key as FieldType] === columnIndex) {
        delete newMappings[key as FieldType];
      }
    });
    
    // Assign to active field
    newMappings[activeField] = columnIndex;
    setMappings(newMappings);
    setActiveField(null);
  };

  const clearMapping = (field: FieldType) => {
    const newMappings = { ...mappings };
    delete newMappings[field];
    setMappings(newMappings);
  };

  const getColumnField = (columnIndex: number): FieldType | null => {
    for (const [field, idx] of Object.entries(mappings)) {
      if (idx === columnIndex) return field as FieldType;
    }
    return null;
  };

  const requiredFields: FieldType[] = ['matter_number', 'wip', 'accounts_receivable', 'total_billed', 'total_paid'];
  const allRequiredMapped = requiredFields.every((field) => mappings[field] !== undefined);
  const canSave = formatName.trim() && allRequiredMapped;

  const handleSave = () => {
    if (!canSave) return;
    onSave(formatName.trim(), mappings);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Train Report Format</DialogTitle>
          <DialogDescription>
            Click on a field below, then click on the column header that contains that data.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-3 pb-4">
            {/* Format Name - compact */}
            <div className="flex items-center gap-3">
              <Label htmlFor="format_name" className="shrink-0">Format Name:</Label>
              <Input
                id="format_name"
                value={formatName}
                onChange={(e) => setFormatName(e.target.value)}
                placeholder="e.g., Monthly WIP Report"
                className="max-w-xs h-8"
              />
            </div>

            {/* Field Selection - more compact layout */}
            <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
              <Label className="text-xs font-medium">Required Fields (click one, then click a column header below)</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(FIELD_CONFIG) as [FieldType, typeof FIELD_CONFIG[FieldType]][])
                  .filter(([_, config]) => !config.group)
                  .map(([field, config]) => {
                  const isMapped = mappings[field] !== undefined;
                  const isActive = activeField === field;
                  
                  return (
                    <div key={field} className="flex items-center gap-0.5">
                      <Button
                        variant={isActive ? 'default' : isMapped ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => setActiveField(isActive ? null : field)}
                        className={cn(
                          'gap-1 h-7 text-xs px-2',
                          isActive && config.color,
                          isMapped && !isActive && 'border-2 border-green-500'
                        )}
                      >
                        {isMapped ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : config.required ? (
                          <span className="text-destructive">*</span>
                        ) : null}
                        {config.label}
                        {isMapped && (
                          <span className="text-[10px] opacity-70">
                            ({(mappings[field] ?? 0) + 1})
                          </span>
                        )}
                      </Button>
                      {isMapped && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => clearMapping(field)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Disbursement Fields - collapsible row */}
              <div className="pt-1.5 border-t border-border/50">
                <Label className="text-[10px] text-muted-foreground mb-1 block">
                  Optional: Disbursement columns for local counsel tracking
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(FIELD_CONFIG) as [FieldType, typeof FIELD_CONFIG[FieldType]][])
                    .filter(([_, config]) => config.group === 'disbursements')
                    .map(([field, config]) => {
                    const isMapped = mappings[field] !== undefined;
                    const isActive = activeField === field;
                    
                    return (
                      <div key={field} className="flex items-center gap-0.5">
                        <Button
                          variant={isActive ? 'default' : isMapped ? 'outline' : 'secondary'}
                          size="sm"
                          onClick={() => setActiveField(isActive ? null : field)}
                          className={cn(
                            'gap-1 h-6 text-[10px] px-2',
                            isActive && config.color,
                            isMapped && !isActive && 'border-2 border-green-500'
                          )}
                        >
                          {isMapped && <Check className="h-2.5 w-2.5 text-green-500" />}
                          {config.label}
                          {isMapped && <span className="opacity-70">({(mappings[field] ?? 0) + 1})</span>}
                        </Button>
                        {isMapped && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => clearMapping(field)}
                          >
                            <X className="h-2.5 w-2.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeField && (
                <p className="text-xs text-primary font-medium pt-1">
                  ➜ Now click on the column header for "{FIELD_CONFIG[activeField].label}"
                </p>
              )}
            </div>

            {/* Data Preview Table - takes remaining space with minimum height */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-auto min-h-[250px] max-h-[400px]">
                <table className="text-sm w-full">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      {headers.map((header, idx) => {
                        const field = getColumnField(idx);
                        return (
                          <th
                            key={idx}
                            onClick={() => handleColumnClick(idx)}
                            className={cn(
                              'px-3 py-2 text-left font-medium border-r last:border-r-0 cursor-pointer transition-colors whitespace-nowrap',
                              activeField && 'hover:bg-primary/20',
                              field && FIELD_CONFIG[field].color,
                              field && 'text-white'
                            )}
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground mr-1">
                                {idx + 1}
                              </span>
                              {header}
                              {field && (
                                <Badge variant="secondary" className="ml-1 text-[10px]">
                                  {FIELD_CONFIG[field].label}
                                </Badge>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.slice(0, 10).map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-t hover:bg-muted/50">
                        {row.map((cell, cellIdx) => {
                          const field = getColumnField(cellIdx);
                          return (
                            <td
                              key={cellIdx}
                              className={cn(
                                'px-3 py-1.5 border-r last:border-r-0 whitespace-nowrap',
                                field && 'bg-primary/5'
                              )}
                              title={cell}
                            >
                              {cell}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Help text - compact */}
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Required fields marked with <span className="text-destructive">*</span>. 
                Format will be auto-recognized in future uploads.
              </span>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save Format
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
