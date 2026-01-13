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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Info } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '@/lib/currencyUtils';
import { format } from 'date-fns';

interface FinancialSnapshotUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    paid_amount: number;
    notes?: string;
  }) => Promise<void>;
  currency: string;
  currentValues?: {
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    paid_amount: number;
  };
  matterName?: string;
  differentBillingCurrency?: boolean;
  quoteCurrency?: string;
}

export function FinancialSnapshotUpdateDialog({
  isOpen,
  onClose,
  onSave,
  currency,
  currentValues,
  matterName,
  differentBillingCurrency,
  quoteCurrency,
}: FinancialSnapshotUpdateDialogProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    wip_amount: currentValues?.wip_amount || 0,
    wip_write_off_amount: currentValues?.wip_write_off_amount || 0,
    billed_amount: currentValues?.billed_amount || 0,
    paid_amount: currentValues?.paid_amount || 0,
    notes: '',
  });

  // Reset form when dialog opens with new values
  useMemo(() => {
    if (isOpen && currentValues) {
      setFormData({
        wip_amount: currentValues.wip_amount || 0,
        wip_write_off_amount: currentValues.wip_write_off_amount || 0,
        billed_amount: currentValues.billed_amount || 0,
        paid_amount: currentValues.paid_amount || 0,
        notes: '',
      });
    }
  }, [isOpen, currentValues]);

  // Calculate net WIP
  const netWip = useMemo(() => {
    return Math.max(0, formData.wip_amount - formData.wip_write_off_amount);
  }, [formData.wip_amount, formData.wip_write_off_amount]);

  const updateField = (field: string, value: number | string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        wip_amount: formData.wip_amount,
        wip_write_off_amount: formData.wip_write_off_amount,
        billed_amount: formData.billed_amount,
        paid_amount: formData.paid_amount,
        notes: formData.notes || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save snapshot:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Financial Snapshot</DialogTitle>
          <DialogDescription>
            {matterName ? `Update WIP, AR and Paid for ${matterName}` : 'Update financial figures for this matter'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Currency Note for different billing currency matters */}
          {differentBillingCurrency && quoteCurrency && quoteCurrency !== currency && (
            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Important:</strong> Enter amounts in the <strong>billing currency ({currency})</strong>, not the quote currency ({quoteCurrency}).
              </AlertDescription>
            </Alert>
          )}

          {/* WIP Section with Write-offs */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <h4 className="text-sm font-medium text-muted-foreground">Work in Progress</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wip_amount" className="text-xs">Raw WIP ({currencySymbol.trim()})</Label>
                <Input
                  id="wip_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.wip_amount}
                  onChange={(e) => updateField('wip_amount', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wip_write_off_amount" className="text-xs text-destructive">Write-offs ({currencySymbol.trim()})</Label>
                <Input
                  id="wip_write_off_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.wip_write_off_amount}
                  onChange={(e) => updateField('wip_write_off_amount', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Net WIP</Label>
                <div className="h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium text-sm">
                  {formatCurrency(netWip, currency)}
                </div>
              </div>
            </div>
          </div>

          {/* Billed and Paid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="billed_amount" className="text-xs">Billed / AR ({currencySymbol.trim()})</Label>
              <Input
                id="billed_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.billed_amount}
                onChange={(e) => updateField('billed_amount', parseFloat(e.target.value) || 0)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paid_amount" className="text-xs">Paid ({currencySymbol.trim()})</Label>
              <Input
                id="paid_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.paid_amount}
                onChange={(e) => updateField('paid_amount', parseFloat(e.target.value) || 0)}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Any notes for this update..."
              rows={2}
              className="text-sm"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Update Snapshot'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
