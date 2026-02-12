import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AssumptionLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAssumptionText: string | null;
  currentAltLower: number;
  currentAltUpper: number;
  assumptionNarratives: string[];
  formatCurrency: (value: number) => string;
  baseLower: number;
  baseUpper: number;
  onSave: (data: {
    assumption_text: string;
    alt_fee_lower: number;
    alt_fee_upper: number;
  }) => void;
  onRemove: () => void;
}

export function AssumptionLinkDialog({
  open,
  onOpenChange,
  currentAssumptionText,
  currentAltLower,
  currentAltUpper,
  assumptionNarratives,
  formatCurrency,
  baseLower,
  baseUpper,
  onSave,
  onRemove,
}: AssumptionLinkDialogProps) {
  const [selectedSource, setSelectedSource] = useState<'existing' | 'custom'>('existing');
  const [selectedNarrative, setSelectedNarrative] = useState<string>('');
  const [customText, setCustomText] = useState('');
  const [altLower, setAltLower] = useState('');
  const [altUpper, setAltUpper] = useState('');

  // Initialize from existing values
  useEffect(() => {
    if (open) {
      if (currentAssumptionText) {
        // Check if it matches an existing narrative
        const matchIndex = assumptionNarratives.findIndex(n => n === currentAssumptionText);
        if (matchIndex >= 0) {
          setSelectedSource('existing');
          setSelectedNarrative(currentAssumptionText);
          setCustomText('');
        } else {
          setSelectedSource('custom');
          setCustomText(currentAssumptionText);
          setSelectedNarrative('');
        }
      } else {
        setSelectedSource(assumptionNarratives.length > 0 ? 'existing' : 'custom');
        setSelectedNarrative('');
        setCustomText('');
      }
      setAltLower(currentAltLower > 0 ? currentAltLower.toString() : '');
      setAltUpper(currentAltUpper > 0 ? currentAltUpper.toString() : '');
    }
  }, [open, currentAssumptionText, currentAltLower, currentAltUpper, assumptionNarratives]);

  const assumptionText = selectedSource === 'existing' ? selectedNarrative : customText.trim();
  const parsedLower = parseFloat(altLower) || 0;
  const parsedUpper = parseFloat(altUpper) || 0;
  const isValid = assumptionText.length > 0 && parsedLower >= 0 && parsedUpper >= 0 && (parsedLower > 0 || parsedUpper > 0);

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      assumption_text: assumptionText,
      alt_fee_lower: parsedLower,
      alt_fee_upper: parsedUpper,
    });
    onOpenChange(false);
  };

  const handleRemove = () => {
    onRemove();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Assumption to Work Item</DialogTitle>
          <DialogDescription>
            Select an assumption that, if not true, would affect the cost of this work item.
            Then provide alternative estimates that would apply.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Base estimates display */}
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Current estimates (assumption true)</p>
            <p className="text-sm font-medium">
              {formatCurrency(baseLower)} – {formatCurrency(baseUpper)}
            </p>
          </div>

          {/* Source selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Assumption</Label>
            
            {assumptionNarratives.length > 0 && (
              <div className="flex gap-2 mb-2">
                <Button
                  variant={selectedSource === 'existing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSource('existing')}
                >
                  From Scope Assumptions
                </Button>
                <Button
                  variant={selectedSource === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSource('custom')}
                >
                  Custom Text
                </Button>
              </div>
            )}

            {selectedSource === 'existing' && assumptionNarratives.length > 0 ? (
              <ScrollArea className="h-[160px] border rounded-md p-2">
                <RadioGroup value={selectedNarrative} onValueChange={setSelectedNarrative}>
                  {assumptionNarratives.map((narrative, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer',
                        selectedNarrative === narrative && 'bg-primary/5 border border-primary/20'
                      )}
                      onClick={() => setSelectedNarrative(narrative)}
                    >
                      <RadioGroupItem value={narrative} id={`assumption-${idx}`} className="mt-0.5" />
                      <label htmlFor={`assumption-${idx}`} className="text-xs cursor-pointer leading-snug">
                        {narrative}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </ScrollArea>
            ) : (
              <Textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Describe the assumption, e.g., 'No more than 3 jurisdictions involved'"
                rows={3}
                className="text-sm"
              />
            )}
          </div>

          {/* Alternative estimates */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Alternative estimates (if assumption not true)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Lower Estimate</Label>
                <Input
                  type="number"
                  value={altLower}
                  onChange={(e) => setAltLower(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Upper Estimate</Label>
                <Input
                  type="number"
                  value={altUpper}
                  onChange={(e) => setAltUpper(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {currentAssumptionText && (
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleRemove}>
                Remove Link
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!isValid}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
