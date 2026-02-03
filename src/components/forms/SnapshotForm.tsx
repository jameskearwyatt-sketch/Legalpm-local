import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClearableDateInput } from '@/components/ui/clearable-date-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSnapshots, FinancialSnapshot, CreateSnapshotInput } from '@/lib/hooks/useSnapshots';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { format } from 'date-fns';
import { getCurrencySymbol, formatCurrency } from '@/lib/currencyUtils';

const snapshotSchema = z.object({
  as_of_date: z.string().min(1, 'Date is required'),
  wip_amount: z.number().min(0, 'Raw WIP must be 0 or greater'),
  wip_write_off_amount: z.number().min(0, 'Write-off must be 0 or greater'),
  billed_amount: z.number().min(0, 'Total Billed must be 0 or greater'),
  accounts_receivable: z.number().min(0, 'Accounts Receivable must be 0 or greater'),
  paid_amount: z.number().min(0, 'Total Paid must be 0 or greater'),
  notes: z.string().optional(),
});

interface SnapshotFormProps {
  matterId: string;
  snapshot?: FinancialSnapshot | null;
  onSuccess: () => void;
  currency?: string;
}

export function SnapshotForm({ matterId, snapshot, onSuccess, currency = 'GBP' }: SnapshotFormProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const { createSnapshot, updateSnapshot } = useSnapshots(matterId);
  const isEditing = !!snapshot;

  // IMPORTANT: In the database, wip_amount IS already NET (after write-offs)
  // For the form, we display Raw WIP = NET + Write-off
  const storedNetWip = snapshot?.wip_amount || 0;
  const storedWriteOff = snapshot?.wip_write_off_amount || 0;
  const initialRawWip = storedNetWip + storedWriteOff; // Reverse-calculate for display
  
  const [formData, setFormData] = useState({
    as_of_date: snapshot?.as_of_date || format(new Date(), 'yyyy-MM-dd'),
    wip_amount: initialRawWip, // Display Raw WIP in form
    wip_write_off_amount: storedWriteOff,
    billed_amount: snapshot?.billed_amount || 0,
    accounts_receivable: (snapshot as any)?.accounts_receivable || 0,
    paid_amount: snapshot?.paid_amount || 0,
    notes: snapshot?.notes || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate net WIP (Raw WIP - Write-offs) - this is what gets saved
  const netWip = useMemo(() => {
    return Math.max(0, formData.wip_amount - formData.wip_write_off_amount);
  }, [formData.wip_amount, formData.wip_write_off_amount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validated = snapshotSchema.parse(formData);
      setIsSubmitting(true);

      if (isEditing) {
        // Save NET WIP, not raw WIP
        await updateSnapshot.mutateAsync({ 
          id: snapshot.id, 
          ...validated,
          wip_amount: netWip, // Override with NET value
        });
      } else {
        // Save NET WIP, not raw WIP
        await createSnapshot.mutateAsync({
          matter_id: matterId,
          ...validated,
          wip_amount: netWip, // Override with NET value
        } as CreateSnapshotInput);
      }
      onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="as_of_date">As of Date *</Label>
        <ClearableDateInput
          id="as_of_date"
          value={formData.as_of_date}
          onChange={(value) => updateField('as_of_date', value)}
          className={errors.as_of_date ? 'border-destructive' : ''}
        />
        {errors.as_of_date && <p className="text-sm text-destructive">{errors.as_of_date}</p>}
      </div>

      {/* WIP Section with Write-offs */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
        <h4 className="text-sm font-medium text-muted-foreground">Work in Progress</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="wip_amount">Raw WIP ({currencySymbol.trim()})</Label>
            <Input
              id="wip_amount"
              type="number"
              min="0"
              step="0.01"
              value={formData.wip_amount}
              onChange={(e) => updateField('wip_amount', parseFloat(e.target.value) || 0)}
              className={errors.wip_amount ? 'border-destructive' : ''}
            />
            {errors.wip_amount && <p className="text-sm text-destructive">{errors.wip_amount}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="wip_write_off_amount">Write-offs ({currencySymbol.trim()})</Label>
            <Input
              id="wip_write_off_amount"
              type="number"
              min="0"
              step="0.01"
              value={formData.wip_write_off_amount}
              onChange={(e) => updateField('wip_write_off_amount', parseFloat(e.target.value) || 0)}
              className={errors.wip_write_off_amount ? 'border-destructive' : ''}
            />
            {errors.wip_write_off_amount && <p className="text-sm text-destructive">{errors.wip_write_off_amount}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Net WIP ({currencySymbol.trim()})</Label>
            <div className="h-10 px-3 py-2 bg-muted rounded-md border flex items-center font-medium">
              {formatCurrency(netWip, currency)}
            </div>
            <p className="text-xs text-muted-foreground">Raw WIP − Write-offs</p>
          </div>
        </div>
      </div>

      {/* Total Billed, Accounts Receivable, and Total Paid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="billed_amount">Total Billed ({currencySymbol.trim()})</Label>
          <Input
            id="billed_amount"
            type="number"
            min="0"
            step="0.01"
            value={formData.billed_amount}
            onChange={(e) => updateField('billed_amount', parseFloat(e.target.value) || 0)}
            className={errors.billed_amount ? 'border-destructive' : ''}
          />
          {errors.billed_amount && <p className="text-sm text-destructive">{errors.billed_amount}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="accounts_receivable">Accounts Receivable ({currencySymbol.trim()})</Label>
          <Input
            id="accounts_receivable"
            type="number"
            min="0"
            step="0.01"
            value={formData.accounts_receivable}
            onChange={(e) => updateField('accounts_receivable', parseFloat(e.target.value) || 0)}
            className={errors.accounts_receivable ? 'border-destructive' : ''}
          />
          {errors.accounts_receivable && <p className="text-sm text-destructive">{errors.accounts_receivable}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="paid_amount">Total Paid ({currencySymbol.trim()})</Label>
          <Input
            id="paid_amount"
            type="number"
            min="0"
            step="0.01"
            value={formData.paid_amount}
            onChange={(e) => updateField('paid_amount', parseFloat(e.target.value) || 0)}
            className={errors.paid_amount ? 'border-destructive' : ''}
          />
          {errors.paid_amount && <p className="text-sm text-destructive">{errors.paid_amount}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Any notes for this snapshot..."
          rows={2}
        />
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Saving...' : 'Creating...'}
            </>
          ) : isEditing ? (
            'Save Changes'
          ) : (
            'Add Snapshot'
          )}
        </Button>
      </div>
    </form>
  );
}
