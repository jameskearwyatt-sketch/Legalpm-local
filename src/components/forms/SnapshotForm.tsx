import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSnapshots, FinancialSnapshot, CreateSnapshotInput } from '@/lib/hooks/useSnapshots';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { format } from 'date-fns';

const snapshotSchema = z.object({
  as_of_date: z.string().min(1, 'Date is required'),
  wip_amount: z.number().min(0, 'WIP must be 0 or greater'),
  billed_amount: z.number().min(0, 'Billed must be 0 or greater'),
  paid_amount: z.number().min(0, 'Paid must be 0 or greater'),
  notes: z.string().optional(),
});

interface SnapshotFormProps {
  matterId: string;
  snapshot?: FinancialSnapshot | null;
  onSuccess: () => void;
}

export function SnapshotForm({ matterId, snapshot, onSuccess }: SnapshotFormProps) {
  const { createSnapshot, updateSnapshot } = useSnapshots(matterId);
  const isEditing = !!snapshot;

  const [formData, setFormData] = useState({
    as_of_date: snapshot?.as_of_date || format(new Date(), 'yyyy-MM-dd'),
    wip_amount: snapshot?.wip_amount || 0,
    billed_amount: snapshot?.billed_amount || 0,
    paid_amount: snapshot?.paid_amount || 0,
    notes: snapshot?.notes || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validated = snapshotSchema.parse(formData);
      setIsSubmitting(true);

      if (isEditing) {
        await updateSnapshot.mutateAsync({ id: snapshot.id, ...validated });
      } else {
        await createSnapshot.mutateAsync({
          matter_id: matterId,
          ...validated,
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
        <Input
          id="as_of_date"
          type="date"
          value={formData.as_of_date}
          onChange={(e) => updateField('as_of_date', e.target.value)}
          className={errors.as_of_date ? 'border-destructive' : ''}
        />
        {errors.as_of_date && <p className="text-sm text-destructive">{errors.as_of_date}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="wip_amount">WIP (£)</Label>
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
          <Label htmlFor="billed_amount">Billed (£)</Label>
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
          <Label htmlFor="paid_amount">Paid (£)</Label>
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
