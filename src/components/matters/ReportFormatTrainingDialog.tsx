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

type FieldType = 'matter_number' | 'matter_name' | 'wip' | 'accounts_receivable' | 'total_billed' | 'total_paid';

const FIELD_CONFIG: Record<FieldType, { label: string; color: string; required: boolean }> = {
  matter_number: { label: 'Matter Number', color: 'bg-blue-500', required: true },
  matter_name: { label: 'Matter Name', color: 'bg-indigo-500', required: false },
  wip: { label: 'WIP', color: 'bg-amber-500', required: true },
  accounts_receivable: { label: 'Accounts Receivable', color: 'bg-orange-500', required: true },
  total_billed: { label: 'Total Billed', color: 'bg-purple-500', required: true },
  total_paid: { label: 'Total Paid', color: 'bg-green-500', required: true },
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
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Train Report Format</DialogTitle>
          <DialogDescription>
            Click on a field below, then click on the column header that contains that data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Format Name */}
          <div className="space-y-2">
            <Label htmlFor="format_name">Format Name</Label>
            <Input
              id="format_name"
              value={formatName}
              onChange={(e) => setFormatName(e.target.value)}
              placeholder="e.g., Monthly WIP Report"
              className="max-w-sm"
            />
          </div>

          {/* Field Selection */}
          <div className="space-y-2">
            <Label>Fields to Map (click one, then click a column below)</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(FIELD_CONFIG) as [FieldType, typeof FIELD_CONFIG[FieldType]][]).map(([field, config]) => {
                const isMapped = mappings[field] !== undefined;
                const isActive = activeField === field;
                
                return (
                  <div key={field} className="flex items-center gap-1">
                    <Button
                      variant={isActive ? 'default' : isMapped ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => setActiveField(isActive ? null : field)}
                      className={cn(
                        'gap-1',
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
                        <span className="text-xs opacity-70">
                          (Col {(mappings[field] ?? 0) + 1})
                        </span>
                      )}
                    </Button>
                    {isMapped && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => clearMapping(field)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            {activeField && (
              <p className="text-sm text-primary">
                Now click on the column header for "{FIELD_CONFIG[activeField].label}"
              </p>
            )}
          </div>

          {/* Data Preview Table */}
          <div className="flex-1 overflow-hidden border rounded-lg">
            <ScrollArea className="h-full">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {headers.map((header, idx) => {
                        const field = getColumnField(idx);
                        return (
                          <th
                            key={idx}
                            onClick={() => handleColumnClick(idx)}
                            className={cn(
                              'px-3 py-2 text-left font-medium border-r last:border-r-0 cursor-pointer transition-colors',
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
                                'px-3 py-1.5 border-r last:border-r-0 truncate max-w-[200px]',
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
            </ScrollArea>
          </div>

          {/* Help text */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <HelpCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="text-muted-foreground">
              <p>Required fields are marked with <span className="text-destructive">*</span>.</p>
              <p>Matter Name is optional but helps with matching.</p>
              <p>Once saved, the app will recognize this format automatically in future uploads.</p>
            </div>
          </div>
        </div>

        <DialogFooter>
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
