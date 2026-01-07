import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useInvoices, Invoice, CreateInvoiceInput } from '@/lib/hooks/useInvoices';
import { useSnapshots } from '@/lib/hooks/useSnapshots';
import { formatCurrency } from '@/lib/currencyUtils';
import { format } from 'date-fns';
import { Plus, Trash2, Loader2, Receipt, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InvoiceHistorySectionProps {
  matterId: string;
  currency: string;
}

const invoiceStatuses = ['Draft', 'Sent', 'Part Paid', 'Paid', 'Overdue'] as const;

export function InvoiceHistorySection({ matterId, currency }: InvoiceHistorySectionProps) {
  const { invoices, isLoading, createInvoice, updateInvoice, deleteInvoice } = useInvoices(matterId);
  const { upsertTodaySnapshot } = useSnapshots();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Invoice>>({});
  const [isSaving, setIsSaving] = useState(false);

  // New invoice form state
  const [newInvoice, setNewInvoice] = useState({
    invoice_number: '',
    invoice_date: format(new Date(), 'yyyy-MM-dd'),
    billed_amount: '',
    due_date: '',
    status: 'Sent' as Invoice['status'],
    notes: '',
  });

  const aggregateBilled = invoices.reduce((sum, inv) => sum + inv.billed_amount, 0);
  const aggregatePaid = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0);

  const syncSnapshotWithInvoices = async (newAggregate: number) => {
    await upsertTodaySnapshot.mutateAsync({
      matterId,
      field: 'billed_amount',
      value: newAggregate,
    });
  };

  const handleAddInvoice = async () => {
    const amount = parseFloat(newInvoice.billed_amount.replace(/,/g, '')) || 0;
    if (!newInvoice.invoice_number.trim() || amount <= 0) {
      toast.error('Please enter invoice number and amount');
      return;
    }

    setIsSaving(true);
    try {
      const input: CreateInvoiceInput = {
        matter_id: matterId,
        invoice_number: newInvoice.invoice_number.trim(),
        invoice_date: newInvoice.invoice_date,
        billed_amount: amount,
        due_date: newInvoice.due_date || undefined,
        status: newInvoice.status,
        notes: newInvoice.notes || undefined,
      };
      
      await createInvoice.mutateAsync(input);
      await syncSnapshotWithInvoices(aggregateBilled + amount);
      
      // Reset form
      setNewInvoice({
        invoice_number: '',
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        billed_amount: '',
        due_date: '',
        status: 'Sent',
        notes: '',
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Failed to add invoice:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setEditValues({
      billed_amount: invoice.billed_amount,
      status: invoice.status,
      paid_amount: invoice.paid_amount,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleSaveEdit = async (invoice: Invoice) => {
    const newAmount = editValues.billed_amount ?? invoice.billed_amount;
    const oldAmount = invoice.billed_amount;
    
    setIsSaving(true);
    try {
      await updateInvoice.mutateAsync({
        id: invoice.id,
        billed_amount: newAmount,
        status: editValues.status ?? invoice.status,
        paid_amount: editValues.paid_amount ?? invoice.paid_amount,
      });
      
      // Sync snapshot if amount changed
      if (newAmount !== oldAmount) {
        const newAggregate = aggregateBilled - oldAmount + newAmount;
        await syncSnapshotWithInvoices(newAggregate);
      }
      
      cancelEditing();
    } catch (error) {
      console.error('Failed to update invoice:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    try {
      await deleteInvoice.mutateAsync(invoice.id);
      const newAggregate = aggregateBilled - invoice.billed_amount;
      await syncSnapshotWithInvoices(newAggregate);
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  };

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'Paid': return 'text-success bg-success/10';
      case 'Part Paid': return 'text-warning bg-warning/10';
      case 'Overdue': return 'text-danger bg-danger/10';
      case 'Sent': return 'text-primary bg-primary/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Invoice History</h4>
          <span className="text-xs text-muted-foreground">
            ({invoices.length} invoice{invoices.length !== 1 ? 's' : ''})
          </span>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-3 w-3 mr-1" />
              Add Invoice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Invoice</DialogTitle>
              <DialogDescription>
                Record a new invoice for this matter.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Number *</Label>
                  <Input
                    value={newInvoice.invoice_number}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })}
                    placeholder="e.g. INV-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    value={newInvoice.billed_amount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, billed_amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Date *</Label>
                  <Input
                    type="date"
                    value={newInvoice.invoice_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoice_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={newInvoice.status}
                  onValueChange={(value) => setNewInvoice({ ...newInvoice, status: value as Invoice['status'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceStatuses.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={newInvoice.notes}
                  onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddInvoice} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Add Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No invoices recorded yet. Click "Add Invoice" to create one.
        </p>
      ) : (
        <>
          {/* Summary */}
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Billed: </span>
              <span className="font-medium">{formatCurrency(aggregateBilled, currency)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Paid: </span>
              <span className="font-medium text-success">{formatCurrency(aggregatePaid, currency)}</span>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id} className="group">
                    <TableCell className="text-sm font-medium">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {editingId === invoice.id ? (
                        <Input
                          type="number"
                          value={editValues.billed_amount ?? invoice.billed_amount}
                          onChange={(e) => setEditValues({ ...editValues, billed_amount: parseFloat(e.target.value) || 0 })}
                          className="h-7 w-24 text-right text-sm"
                        />
                      ) : (
                        formatCurrency(invoice.billed_amount, currency)
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === invoice.id ? (
                        <Select
                          value={editValues.status ?? invoice.status}
                          onValueChange={(value) => setEditValues({ ...editValues, status: value as Invoice['status'] })}
                        >
                          <SelectTrigger className="h-7 text-xs w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {invoiceStatuses.map((status) => (
                              <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn("text-xs px-2 py-0.5 rounded", getStatusColor(invoice.status))}>
                          {invoice.status}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-right text-success">
                      {editingId === invoice.id ? (
                        <Input
                          type="number"
                          value={editValues.paid_amount ?? invoice.paid_amount}
                          onChange={(e) => setEditValues({ ...editValues, paid_amount: parseFloat(e.target.value) || 0 })}
                          className="h-7 w-24 text-right text-sm"
                        />
                      ) : (
                        invoice.paid_amount > 0 ? formatCurrency(invoice.paid_amount, currency) : '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {editingId === invoice.id ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleSaveEdit(invoice)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3 text-success" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={cancelEditing}
                              disabled={isSaving}
                            >
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => startEditing(invoice)}
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Delete invoice {invoice.invoice_number}? This will update the total billed amount.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteInvoice(invoice)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
