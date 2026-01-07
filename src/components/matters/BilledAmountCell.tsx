import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, X, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { useMatterBills } from '@/lib/hooks/useMatterBills';
import { useSnapshots } from '@/lib/hooks/useSnapshots';

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
  const [newAmount, setNewAmount] = useState('');
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { bills, totalBilled, isLoading, addBill, updateBill, deleteBill } = useMatterBills(matterId);
  const { upsertTodaySnapshot } = useSnapshots();

  // Use bills total if we have bills, otherwise fall back to snapshot
  const displayAmount = bills.length > 0 ? totalBilled : currentBilledAmount;

  useEffect(() => {
    if ((mode === 'add' || editingBillId) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [mode, editingBillId]);

  const syncSnapshot = async (newTotal: number) => {
    await upsertTodaySnapshot.mutateAsync({
      matterId,
      field: 'billed_amount',
      value: newTotal,
    });
  };

  const handleAddBill = async () => {
    const amount = parseFloat(newAmount.replace(/,/g, '')) || 0;
    if (amount <= 0) return;

    setIsSaving(true);
    try {
      await addBill.mutateAsync(amount);
      await syncSnapshot(totalBilled + amount);
      setNewAmount('');
      setMode('view');
    } catch (error) {
      console.error('Failed to add bill:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateBill = async (billId: string, oldAmount: number) => {
    const newAmt = parseFloat(editValue.replace(/,/g, '')) || 0;
    if (newAmt === oldAmount) {
      setEditingBillId(null);
      return;
    }

    setIsSaving(true);
    try {
      await updateBill.mutateAsync({ id: billId, amount: newAmt });
      await syncSnapshot(totalBilled - oldAmount + newAmt);
      setEditingBillId(null);
    } catch (error) {
      console.error('Failed to update bill:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBill = async (billId: string, amount: number) => {
    setIsSaving(true);
    try {
      await deleteBill.mutateAsync(billId);
      await syncSnapshot(totalBilled - amount);
    } catch (error) {
      console.error('Failed to delete bill:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingBill = (billId: string, amount: number) => {
    setEditingBillId(billId);
    setEditValue(amount.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') action();
    else if (e.key === 'Escape') {
      setMode('view');
      setEditingBillId(null);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setMode('view');
      setEditingBillId(null);
      setNewAmount('');
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
            <Pencil className={cn(
              "text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity",
              compact ? "h-2 w-2" : "h-3 w-3"
            )} />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          {/* Header with total */}
          <div className="flex justify-between items-center pb-2 border-b">
            <span className="text-sm font-medium">Total Billed</span>
            <span className="text-lg font-semibold">{formatCurrency(displayAmount, currency)}</span>
          </div>

          {/* Bills list in adjust mode */}
          {mode === 'adjust' && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : bills.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No bills to adjust</p>
              ) : (
                bills.map((bill, index) => (
                  <div key={bill.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12">Bill {index + 1}:</span>
                    {editingBillId === bill.id ? (
                      <>
                        <Input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, () => handleUpdateBill(bill.id, bill.amount))}
                          className="h-7 flex-1 text-sm"
                          disabled={isSaving}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleUpdateBill(bill.id, bill.amount)}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-success" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditingBillId(null)}
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{formatCurrency(bill.amount, currency)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => startEditingBill(bill.id, bill.amount)}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleDeleteBill(bill.id, bill.amount)}
                          disabled={isSaving}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setMode('view')}
              >
                Done
              </Button>
            </div>
          )}

          {/* Add bill mode */}
          {mode === 'add' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  type="text"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleAddBill)}
                  className="h-8 flex-1"
                  placeholder="Enter amount..."
                  disabled={isSaving}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleAddBill}
                  disabled={isSaving || !newAmount}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-success" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setMode('view')}
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          )}

          {/* View mode with action buttons */}
          {mode === 'view' && (
            <div className="flex gap-2">
              {bills.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setMode('adjust')}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Adjust
                </Button>
              )}
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setMode('add')}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Bill
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
