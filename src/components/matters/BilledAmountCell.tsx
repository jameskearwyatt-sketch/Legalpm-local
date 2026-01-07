import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, X, Loader2, Pencil, Plus, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { useInvoices, CreateInvoiceInput } from '@/lib/hooks/useInvoices';
import { useSnapshots } from '@/lib/hooks/useSnapshots';
import { format } from 'date-fns';

interface BilledAmountCellProps {
  matterId: string;
  currentBilledAmount: number;
  currency: string;
  compact?: boolean;
}

export function BilledAmountCell({ 
  matterId, 
  currentBilledAmount, 
  currency, 
  compact = true 
}: BilledAmountCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'adjust' | 'add'>('view');
  const [adjustValue, setAdjustValue] = useState(currentBilledAmount.toString());
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newInvoiceAmount, setNewInvoiceAmount] = useState('');
  const [newInvoiceDate, setNewInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { invoices, createInvoice, isLoading: invoicesLoading } = useInvoices(matterId);
  const { upsertTodaySnapshot } = useSnapshots();

  // Calculate aggregate billed from invoices
  const aggregateBilled = invoices.reduce((sum, inv) => sum + inv.billed_amount, 0);
  const displayAmount = invoices.length > 0 ? aggregateBilled : currentBilledAmount;

  useEffect(() => {
    if (mode === 'adjust' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [mode]);

  useEffect(() => {
    setAdjustValue(displayAmount.toString());
  }, [displayAmount]);

  const handleAdjust = async () => {
    const numValue = parseFloat(adjustValue.replace(/,/g, '')) || 0;
    if (numValue === displayAmount) {
      setMode('view');
      return;
    }
    
    setIsSaving(true);
    try {
      await upsertTodaySnapshot.mutateAsync({
        matterId,
        field: 'billed_amount',
        value: numValue,
      });
      setMode('view');
    } catch (error) {
      console.error('Failed to adjust billed amount:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddInvoice = async () => {
    const amount = parseFloat(newInvoiceAmount.replace(/,/g, '')) || 0;
    if (!newInvoiceNumber.trim() || amount <= 0) return;

    setIsSaving(true);
    try {
      const invoiceInput: CreateInvoiceInput = {
        matter_id: matterId,
        invoice_number: newInvoiceNumber.trim(),
        invoice_date: newInvoiceDate,
        billed_amount: amount,
        status: 'Sent',
      };
      
      await createInvoice.mutateAsync(invoiceInput);
      
      // Update the snapshot with the new aggregate
      const newAggregate = aggregateBilled + amount;
      await upsertTodaySnapshot.mutateAsync({
        matterId,
        field: 'billed_amount',
        value: newAggregate,
      });
      
      // Reset form
      setNewInvoiceNumber('');
      setNewInvoiceAmount('');
      setNewInvoiceDate(format(new Date(), 'yyyy-MM-dd'));
      setMode('view');
    } catch (error) {
      console.error('Failed to add invoice:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'adjust') handleAdjust();
      else if (mode === 'add') handleAddInvoice();
    } else if (e.key === 'Escape') {
      setMode('view');
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setMode('view');
      setNewInvoiceNumber('');
      setNewInvoiceAmount('');
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "text-right rounded transition-all cursor-pointer group",
            "border border-dashed border-primary/30 hover:border-primary hover:bg-primary/5",
            compact ? "px-1 py-0 text-xs" : "w-full px-2 py-1"
          )}
          title="Click to manage billing"
        >
          <span className={cn("flex items-center justify-end", compact ? "gap-0.5" : "gap-1")}>
            {formatCurrency(displayAmount, currency)}
            {invoices.length > 0 && (
              <Receipt className={cn(
                "text-primary/50",
                compact ? "h-2 w-2" : "h-3 w-3"
              )} />
            )}
            <Pencil className={cn(
              "text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity",
              compact ? "h-2 w-2" : "h-3 w-3"
            )} />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        {mode === 'view' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Billed</span>
              <span className="text-lg font-semibold">{formatCurrency(displayAmount, currency)}</span>
            </div>
            
            {invoicesLoading ? (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length > 0 ? (
              <div className="border-t pt-2 space-y-1 max-h-32 overflow-y-auto">
                <p className="text-xs text-muted-foreground mb-1">{invoices.length} invoice(s)</p>
                {invoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{inv.invoice_number}</span>
                    <span>{formatCurrency(inv.billed_amount, currency)}</span>
                  </div>
                ))}
                {invoices.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{invoices.length - 5} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">No invoices recorded</p>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setMode('adjust')}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Adjust
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setMode('add')}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Invoice
              </Button>
            </div>
          </div>
        )}

        {mode === 'adjust' && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Adjust Total Billed</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                type="text"
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8"
                disabled={isSaving}
              />
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAdjust}>
                    <Check className="h-4 w-4 text-success" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMode('view')}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              This adjusts the snapshot total directly without creating an invoice record.
            </p>
          </div>
        )}

        {mode === 'add' && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Add New Invoice</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Invoice Number</Label>
                <Input
                  ref={inputRef}
                  type="text"
                  value={newInvoiceNumber}
                  onChange={(e) => setNewInvoiceNumber(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-8"
                  placeholder="e.g. INV-001"
                  disabled={isSaving}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Amount</Label>
                <Input
                  type="text"
                  value={newInvoiceAmount}
                  onChange={(e) => setNewInvoiceAmount(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-8"
                  placeholder="0.00"
                  disabled={isSaving}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={newInvoiceDate}
                  onChange={(e) => setNewInvoiceDate(e.target.value)}
                  className="h-8"
                  disabled={isSaving}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setMode('view')}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleAddInvoice}
                disabled={isSaving || !newInvoiceNumber.trim() || !newInvoiceAmount}
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
