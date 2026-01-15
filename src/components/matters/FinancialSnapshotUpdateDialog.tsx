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
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Info } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '@/lib/currencyUtils';

export interface LocalCounselUpdate {
  id: string;
  firm_name: string;
  wip_amount: number;
  billed_amount: number;
  billing_mode: string | null;
}

interface FinancialSnapshotUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
    notes?: string;
    localCounsels?: LocalCounselUpdate[];
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
  localCounsels?: Array<{
    id: string;
    firm_name: string;
    wip_amount: number;
    billed_amount: number;
    billing_mode: string | null;
  }>;
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
  localCounsels = [],
}: FinancialSnapshotUpdateDialogProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Toggle between entering write-off or adjusted WIP
  const [wipEntryMode, setWipEntryMode] = useState<'writeoff' | 'adjusted'>('writeoff');
  const [formData, setFormData] = useState({
    wip_amount: currentValues?.wip_amount || 0,
    wip_write_off_amount: currentValues?.wip_write_off_amount || 0,
    adjusted_wip: (currentValues?.wip_amount || 0) - (currentValues?.wip_write_off_amount || 0),
    billed_amount: currentValues?.billed_amount || 0,
    accounts_receivable: currentValues?.accounts_receivable || 0,
    paid_amount: currentValues?.paid_amount || 0,
    notes: '',
  });

  // Track local counsel updates - only for Disb mode
  const disbursementLCs = localCounsels.filter(lc => lc.billing_mode === 'Disb');
  const [lcFormData, setLcFormData] = useState<Record<string, { wip_amount: number; billed_amount: number }>>({});

  // Reset form when dialog opens with new values
  useEffect(() => {
    if (isOpen) {
      const rawWip = currentValues?.wip_amount || 0;
      const writeOff = currentValues?.wip_write_off_amount || 0;
      setFormData({
        wip_amount: rawWip,
        wip_write_off_amount: writeOff,
        adjusted_wip: rawWip - writeOff,
        billed_amount: currentValues?.billed_amount || 0,
        accounts_receivable: currentValues?.accounts_receivable || 0,
        paid_amount: currentValues?.paid_amount || 0,
        notes: '',
      });
      setWipEntryMode('writeoff');
      // Initialize LC form data
      const lcData: Record<string, { wip_amount: number; billed_amount: number }> = {};
      disbursementLCs.forEach(lc => {
        lcData[lc.id] = {
          wip_amount: lc.wip_amount || 0,
          billed_amount: lc.billed_amount || 0,
        };
      });
      setLcFormData(lcData);
    }
  }, [isOpen, currentValues, localCounsels]);

  // Calculate derived values based on entry mode
  const calculatedValues = useMemo(() => {
    if (wipEntryMode === 'writeoff') {
      // User entered write-off, calculate adjusted WIP
      const netWip = Math.max(0, formData.wip_amount - formData.wip_write_off_amount);
      return { netWip, writeOff: formData.wip_write_off_amount };
    } else {
      // User entered adjusted WIP, calculate write-off
      const writeOff = Math.max(0, formData.wip_amount - formData.adjusted_wip);
      return { netWip: formData.adjusted_wip, writeOff };
    }
  }, [wipEntryMode, formData.wip_amount, formData.wip_write_off_amount, formData.adjusted_wip]);

  const updateField = (field: string, value: number | string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateLcField = (lcId: string, field: 'wip_amount' | 'billed_amount', value: number) => {
    setLcFormData(prev => ({
      ...prev,
      [lcId]: {
        ...prev[lcId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Build local counsel updates
      const lcUpdates: LocalCounselUpdate[] = disbursementLCs.map(lc => ({
        id: lc.id,
        firm_name: lc.firm_name,
        wip_amount: lcFormData[lc.id]?.wip_amount || 0,
        billed_amount: lcFormData[lc.id]?.billed_amount || 0,
        billing_mode: lc.billing_mode,
      }));

      await onSave({
        wip_amount: formData.wip_amount,
        wip_write_off_amount: calculatedValues.writeOff,
        billed_amount: formData.billed_amount,
        accounts_receivable: formData.accounts_receivable,
        paid_amount: formData.paid_amount,
        notes: formData.notes || undefined,
        localCounsels: lcUpdates.length > 0 ? lcUpdates : undefined,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Financial Snapshot</DialogTitle>
          <DialogDescription>
            {matterName ? `Update WIP, Accounts Receivable and Total Paid for ${matterName}` : 'Update financial figures for this matter'}
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
                    <RadioGroupItem value="writeoff" id="mode-writeoff" className="h-3 w-3" />
                    <Label htmlFor="mode-writeoff" className="text-xs cursor-pointer">Enter Write-off</Label>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="adjusted" id="mode-adjusted" className="h-3 w-3" />
                    <Label htmlFor="mode-adjusted" className="text-xs cursor-pointer">Enter Adjusted WIP</Label>
                  </div>
                </RadioGroup>
              </div>
              
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

                {wipEntryMode === 'writeoff' ? (
                  <>
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
                      <Label className="text-xs text-muted-foreground">Net WIP (calculated)</Label>
                      <div className="h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium text-sm">
                        {formatCurrency(calculatedValues.netWip, currency)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="adjusted_wip" className="text-xs text-primary">Adjusted WIP ({currencySymbol.trim()})</Label>
                      <Input
                        id="adjusted_wip"
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
                <Label htmlFor="billed_amount" className="text-xs">Total Billed ({currencySymbol.trim()})</Label>
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
                <Label htmlFor="accounts_receivable" className="text-xs">Accounts Receivable ({currencySymbol.trim()})</Label>
                <Input
                  id="accounts_receivable"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.accounts_receivable}
                  onChange={(e) => updateField('accounts_receivable', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="paid_amount" className="text-xs">Total Paid ({currencySymbol.trim()})</Label>
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
          </div>

          {/* Local Counsel Sections */}
          {disbursementLCs.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Local Counsel (Disbursement)</h4>
                {disbursementLCs.map(lc => (
                  <div key={lc.id} className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <h5 className="text-sm font-medium">{lc.firm_name}</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">WIP ({currencySymbol.trim()})</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={lcFormData[lc.id]?.wip_amount || 0}
                          onChange={(e) => updateLcField(lc.id, 'wip_amount', parseFloat(e.target.value) || 0)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Billed ({currencySymbol.trim()})</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={lcFormData[lc.id]?.billed_amount || 0}
                          onChange={(e) => updateLcField(lc.id, 'billed_amount', parseFloat(e.target.value) || 0)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

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
