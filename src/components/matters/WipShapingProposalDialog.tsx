import { useState, useMemo, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Info, Lightbulb } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '@/lib/currencyUtils';
import { WipShapingProposal } from '@/lib/hooks/useWipShapingProposals';

interface WipShapingProposalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
    notes: string;
  }) => Promise<void>;
  currency: string;
  currentValues?: {
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
  };
  matterName?: string;
  differentBillingCurrency?: boolean;
  quoteCurrency?: string;
  existingProposal?: WipShapingProposal | null;
}

export function WipShapingProposalDialog({
  isOpen,
  onClose,
  onSave,
  currency,
  currentValues,
  matterName,
  differentBillingCurrency,
  quoteCurrency,
  existingProposal,
}: WipShapingProposalDialogProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wipEntryMode, setWipEntryMode] = useState<'writeoff' | 'adjusted'>('writeoff');
  const [formData, setFormData] = useState({
    wip_amount: 0,
    wip_write_off_amount: 0,
    adjusted_wip: 0,
    billed_amount: 0,
    accounts_receivable: 0,
    paid_amount: 0,
    notes: '',
  });

  const roundTo2 = (n: number) => Math.round(n * 100) / 100;

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      // If editing an existing proposal, use its values
      if (existingProposal) {
        const rawWip = roundTo2(existingProposal.wip_amount);
        const writeOff = roundTo2(existingProposal.wip_write_off_amount);
        setFormData({
          wip_amount: rawWip,
          wip_write_off_amount: writeOff,
          adjusted_wip: roundTo2(rawWip - writeOff),
          billed_amount: roundTo2(existingProposal.billed_amount),
          accounts_receivable: roundTo2(existingProposal.accounts_receivable),
          paid_amount: roundTo2(existingProposal.paid_amount),
          notes: existingProposal.notes || '',
        });
      } else {
        // New proposal - pre-fill with current snapshot values
        const rawWip = roundTo2(currentValues?.wip_amount || 0);
        const writeOff = roundTo2(currentValues?.wip_write_off_amount || 0);
        setFormData({
          wip_amount: rawWip,
          wip_write_off_amount: writeOff,
          adjusted_wip: roundTo2(rawWip - writeOff),
          billed_amount: roundTo2(currentValues?.billed_amount || 0),
          accounts_receivable: roundTo2(currentValues?.accounts_receivable || 0),
          paid_amount: roundTo2(currentValues?.paid_amount || 0),
          notes: '',
        });
      }
      setWipEntryMode('writeoff');
    }
  }, [isOpen, currentValues, existingProposal]);

  const calculatedValues = useMemo(() => {
    if (wipEntryMode === 'writeoff') {
      const netWip = Math.max(0, formData.wip_amount - formData.wip_write_off_amount);
      return { netWip, writeOff: formData.wip_write_off_amount };
    } else {
      const writeOff = Math.max(0, formData.wip_amount - formData.adjusted_wip);
      return { netWip: formData.adjusted_wip, writeOff };
    }
  }, [wipEntryMode, formData.wip_amount, formData.wip_write_off_amount, formData.adjusted_wip]);

  const updateField = (field: string, value: number | string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.notes.trim()) {
      return; // Notes are required
    }
    
    setIsSubmitting(true);
    try {
      await onSave({
        wip_amount: formData.wip_amount,
        wip_write_off_amount: calculatedValues.writeOff,
        billed_amount: formData.billed_amount,
        accounts_receivable: formData.accounts_receivable,
        paid_amount: formData.paid_amount,
        notes: formData.notes.trim(),
      });
      onClose();
    } catch (error) {
      console.error('Failed to save proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            {existingProposal ? 'Edit WIP Shaping Proposal' : 'Add WIP Shaping Proposal'}
          </DialogTitle>
          <DialogDescription>
            {matterName 
              ? `Propose how WIP could be shaped for ${matterName}` 
              : 'Create a proposal for how WIP could be reshaped'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info Alert */}
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              This is a <strong>proposal</strong> for how you might reshape WIP — it won't affect the actual financial snapshot until you explicitly apply it.
            </AlertDescription>
          </Alert>

          {/* Currency Note for different billing currency matters */}
          {differentBillingCurrency && quoteCurrency && quoteCurrency !== currency && (
            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Important:</strong> Enter amounts in the <strong>billing currency ({currency})</strong>, not the quote currency ({quoteCurrency}).
              </AlertDescription>
            </Alert>
          )}

          {/* Notes Field - Required */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm font-medium">
              Proposal Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="e.g., Client agreed to 20% write-off in exchange for faster payment..."
              rows={2}
              className="text-sm"
              required
            />
            <p className="text-xs text-muted-foreground">
              Describe what this proposal represents for future reference
            </p>
          </div>

          {/* Baker McKenzie Section */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <h4 className="text-sm font-medium">Baker McKenzie</h4>
            
            {/* WIP Section with Write-offs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Work in Progress</p>
                <RadioGroup
                  value={wipEntryMode}
                  onValueChange={(value) => setWipEntryMode(value as 'writeoff' | 'adjusted')}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="writeoff" id="mode-writeoff-proposal" className="h-3 w-3" />
                    <Label htmlFor="mode-writeoff-proposal" className="text-xs cursor-pointer">Enter Write-off</Label>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="adjusted" id="mode-adjusted-proposal" className="h-3 w-3" />
                    <Label htmlFor="mode-adjusted-proposal" className="text-xs cursor-pointer">Enter Adjusted WIP</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wip_amount_proposal" className="text-xs">Raw WIP ({currencySymbol.trim()})</Label>
                  <Input
                    id="wip_amount_proposal"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.wip_amount}
                    onChange={(e) => updateField('wip_amount', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>

                {wipEntryMode === 'writeoff' ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="wip_write_off_amount_proposal" className="text-xs text-destructive">Write-offs ({currencySymbol.trim()})</Label>
                      <Input
                        id="wip_write_off_amount_proposal"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.wip_write_off_amount}
                        onChange={(e) => updateField('wip_write_off_amount', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Net WIP (calculated)</Label>
                      <div className="h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium text-sm">
                        {formatCurrency(calculatedValues.netWip, currency)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="adjusted_wip_proposal" className="text-xs text-primary">Adjusted WIP ({currencySymbol.trim()})</Label>
                      <Input
                        id="adjusted_wip_proposal"
                        type="number"
                        min="0"
                        max={formData.wip_amount}
                        step="0.01"
                        value={formData.adjusted_wip}
                        onChange={(e) => updateField('adjusted_wip', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground text-destructive">Write-off (calculated)</Label>
                      <div className="h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium text-sm text-destructive">
                        {formatCurrency(calculatedValues.writeOff, currency)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Total Billed, Accounts Receivable, and Total Paid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="billed_amount_proposal" className="text-xs">Total Billed ({currencySymbol.trim()})</Label>
                <Input
                  id="billed_amount_proposal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.billed_amount}
                  onChange={(e) => updateField('billed_amount', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="accounts_receivable_proposal" className="text-xs">Accounts Receivable ({currencySymbol.trim()})</Label>
                <Input
                  id="accounts_receivable_proposal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.accounts_receivable}
                  onChange={(e) => updateField('accounts_receivable', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="paid_amount_proposal" className="text-xs">Total Paid ({currencySymbol.trim()})</Label>
                <Input
                  id="paid_amount_proposal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.paid_amount}
                  onChange={(e) => updateField('paid_amount', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !formData.notes.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : existingProposal ? (
                'Update Proposal'
              ) : (
                'Save Proposal'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
