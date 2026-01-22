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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, X, HelpCircle } from 'lucide-react';
import { ContactColumnMappings, ContactFieldType } from '@/lib/hooks/useContactImportFormats';

interface ContactFormatTrainingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formatName: string, mappings: ContactColumnMappings) => void;
  headers: string[];
  sampleRows: Record<string, string>[];
  existingMappings?: ContactColumnMappings;
  existingName?: string;
}

const FIELD_CONFIG: Record<Exclude<ContactFieldType, 'ignore'>, { label: string; color: string; required: boolean }> = {
  full_name: { label: 'Full Name', color: 'bg-blue-500', required: false },
  first_name: { label: 'First Name', color: 'bg-indigo-500', required: false },
  last_name: { label: 'Last Name', color: 'bg-violet-500', required: false },
  email: { label: 'Email', color: 'bg-green-500', required: true },
  company: { label: 'Company', color: 'bg-amber-500', required: false },
  job_title: { label: 'Job Title', color: 'bg-orange-500', required: false },
  country: { label: 'Country', color: 'bg-cyan-500', required: false },
  city: { label: 'City', color: 'bg-teal-500', required: false },
  gender: { label: 'Gender', color: 'bg-pink-500', required: false },
  linkedin_url: { label: 'LinkedIn', color: 'bg-purple-500', required: false },
  relationship_owner: { label: 'Owner', color: 'bg-rose-500', required: false },
  sectors: { label: 'Sectors', color: 'bg-fuchsia-500', required: false },
};

export function ContactFormatTrainingDialog({
  isOpen,
  onClose,
  onSave,
  headers,
  sampleRows,
  existingMappings,
  existingName,
}: ContactFormatTrainingDialogProps) {
  const [formatName, setFormatName] = useState(existingName || '');
  const [mappings, setMappings] = useState<ContactColumnMappings>(existingMappings || {});
  const [activeField, setActiveField] = useState<Exclude<ContactFieldType, 'ignore'> | null>(null);

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
      if (newMappings[key as keyof ContactColumnMappings] === columnIndex) {
        delete newMappings[key as keyof ContactColumnMappings];
      }
    });
    
    // Assign to active field
    newMappings[activeField] = columnIndex;
    setMappings(newMappings);
    setActiveField(null);
  };

  const clearMapping = (field: keyof ContactColumnMappings) => {
    const newMappings = { ...mappings };
    delete newMappings[field];
    setMappings(newMappings);
  };

  const getColumnField = (columnIndex: number): keyof ContactColumnMappings | null => {
    for (const [field, idx] of Object.entries(mappings)) {
      if (idx === columnIndex) return field as keyof ContactColumnMappings;
    }
    return null;
  };

  // At minimum we need email, and either full_name OR (first_name + last_name)
  const hasEmail = mappings.email !== undefined;
  const hasFullName = mappings.full_name !== undefined;
  const hasFirstAndLast = mappings.first_name !== undefined && mappings.last_name !== undefined;
  const hasName = hasFullName || hasFirstAndLast;
  const canSave = formatName.trim() && hasEmail && hasName;

  const handleSave = () => {
    if (!canSave) return;
    onSave(formatName.trim(), mappings);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Train Contact Import Format</DialogTitle>
          <DialogDescription>
            Click on a field below, then click on the column header that contains that data.
            This format will be remembered for future imports.
          </DialogDescription>
        </DialogHeader>

        {/* Top section */}
        <div className="px-6 shrink-0 space-y-3">
          {/* Format Name */}
          <div className="flex items-center gap-3">
            <Label htmlFor="format_name" className="shrink-0">Format Name:</Label>
            <Input
              id="format_name"
              value={formatName}
              onChange={(e) => setFormatName(e.target.value)}
              placeholder="e.g., Marketing Contacts Export"
              className="max-w-xs h-8"
            />
          </div>

          {/* Field Selection */}
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
            <Label className="text-xs font-medium">Click a field, then click its column header below</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(FIELD_CONFIG) as [Exclude<ContactFieldType, 'ignore'>, typeof FIELD_CONFIG[keyof typeof FIELD_CONFIG]][]).map(([field, config]) => {
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

            {activeField && (
              <p className="text-xs text-primary font-medium pt-1">
                ➜ Now click on the column header for "{FIELD_CONFIG[activeField].label}"
              </p>
            )}

            {!hasName && (
              <p className="text-xs text-amber-600 pt-1">
                ⚠ Map either "Full Name" OR both "First Name" + "Last Name"
              </p>
            )}
          </div>
        </div>

        {/* Data Preview Table */}
        <div className="flex-1 min-h-0 px-6 py-3">
          <div className="border rounded-lg h-full overflow-auto">
            <table className="text-sm w-max min-w-full">
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
                          field && FIELD_CONFIG[field as keyof typeof FIELD_CONFIG]?.color,
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
                              {FIELD_CONFIG[field as keyof typeof FIELD_CONFIG]?.label}
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
                    {headers.map((header, cellIdx) => {
                      const field = getColumnField(cellIdx);
                      const cellValue = row[header] || '';
                      return (
                        <td
                          key={cellIdx}
                          className={cn(
                            'px-3 py-1.5 border-r last:border-r-0 whitespace-nowrap max-w-[200px] truncate',
                            field && 'bg-primary/5'
                          )}
                          title={cellValue}
                        >
                          {cellValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Help text */}
        <div className="px-6 pb-2 shrink-0">
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Email is required <span className="text-destructive">*</span>. 
              Format will be auto-recognized in future uploads with the same columns.
            </span>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save Format & Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
