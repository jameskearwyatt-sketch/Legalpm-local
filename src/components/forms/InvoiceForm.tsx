import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClearableDateInput } from '@/components/ui/clearable-date-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInvoices, Invoice, CreateInvoiceInput } from '@/lib/hooks/useInvoices';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { format } from 'date-fns';
import { getCurrencySymbol } from '@/lib/currencyUtils';

const invoiceSchema = z.object({
  invoice_number: z.string().min(1, 'Invoice number is required').max(50),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  billed_amount: z.number().min(0, 'Amount must be 0 or greater'),
  due_date: z.string().optional(),
  status: z.enum(['Draft', 'Sent', 'Part Paid', 'Paid', 'Overdue']).default('Draft'),
  paid_amount: z.number().min(0).default(0),
  paid_date: z.string().optional(),
  notes: z.string().optional(),
});

interface InvoiceFormProps {
  matterId: string;
  invoice?: Invoice | null;
  onSuccess: () => void;
  currency?: string;
}

export function InvoiceForm({ matterId, invoice, onSuccess, currency = 'GBP' }: InvoiceFormProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const { createInvoice, updateInvoice } = useInvoices(matterId);
  const isEditing = !!invoice;

  const [formData, setFormData] = useState({
    invoice_number: invoice?.invoice_number || '',
    invoice_date: invoice?.invoice_date || format(new Date(), 'yyyy-MM-dd'),
    billed_amount: invoice?.billed_amount || 0,
    due_date: invoice?.due_date || '',
    status: invoice?.status || 'Draft' as const,
    paid_amount: invoice?.paid_amount || 0,
    paid_date: invoice?.paid_date || '',
    notes: invoice?.notes || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validated = invoiceSchema.parse(formData);
      setIsSubmitting(true);

      if (isEditing) {
        await updateInvoice.mutateAsync({ id: invoice.id, ...validated });
      } else {
        await createInvoice.mutateAsync({
          matter_id: matterId,
          ...validated,
        } as CreateInvoiceInput);
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invoice_number">Invoice Number *</Label>
          <Input
            id="invoice_number"
            value={formData.invoice_number}
            onChange={(e) => updateField('invoice_number', e.target.value)}
            placeholder="INV-001"
            className={errors.invoice_number ? 'border-destructive' : ''}
          />
          {errors.invoice_number && <p className="text-sm text-destructive">{errors.invoice_number}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(v) => updateField('status', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Sent">Sent</SelectItem>
              <SelectItem value="Part Paid">Part Paid</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invoice_date">Invoice Date *</Label>
          <ClearableDateInput
            id="invoice_date"
            value={formData.invoice_date}
            onChange={(value) => updateField('invoice_date', value)}
            className={errors.invoice_date ? 'border-destructive' : ''}
          />
          {errors.invoice_date && <p className="text-sm text-destructive">{errors.invoice_date}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date">Due Date</Label>
          <ClearableDateInput
            id="due_date"
            value={formData.due_date}
            onChange={(value) => updateField('due_date', value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="billed_amount">Billed Amount ({currencySymbol.trim()}) *</Label>
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
          <Label htmlFor="paid_amount">Paid Amount ({currencySymbol.trim()})</Label>
          <Input
            id="paid_amount"
            type="number"
            min="0"
            step="0.01"
            value={formData.paid_amount}
            onChange={(e) => updateField('paid_amount', parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      {(formData.status === 'Part Paid' || formData.status === 'Paid') && (
        <div className="space-y-2">
          <Label htmlFor="paid_date">Paid Date</Label>
          <ClearableDateInput
            id="paid_date"
            value={formData.paid_date}
            onChange={(value) => updateField('paid_date', value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Any notes..."
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
            'Add Invoice'
          )}
        </Button>
      </div>
    </form>
  );
}
