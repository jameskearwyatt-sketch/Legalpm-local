import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { useMatter, useMatters } from '@/lib/hooks/useMatters';
import { useSnapshots } from '@/lib/hooks/useSnapshots';
import { useInvoices } from '@/lib/hooks/useInvoices';
import { SnapshotForm } from '@/components/forms/SnapshotForm';
import { InvoiceForm } from '@/components/forms/InvoiceForm';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Plus, 
  Loader2,
  PoundSterling,
  Calendar,
  User,
  Building,
  FileText
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function MatterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: matter, isLoading: matterLoading } = useMatter(id!);
  const { deleteMatter } = useMatters();
  const { snapshots, isLoading: snapshotsLoading, deleteSnapshot } = useSnapshots(id);
  const { invoices, isLoading: invoicesLoading, deleteInvoice } = useInvoices(id);
  
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<any>(null);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), 'dd MMM yyyy');
  };

  if (matterLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!matter) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <h2 className="text-xl font-medium text-foreground">Matter not found</h2>
          <Button asChild className="mt-4">
            <Link to="/matters">Back to Matters</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const latestSnapshot = snapshots[0];
  const wipAmount = latestSnapshot?.wip_amount || 0;
  const billedAmount = latestSnapshot?.billed_amount || 0;
  const paidAmount = latestSnapshot?.paid_amount || 0;
  const budget = matter.agreed_budget_amount || 0;
  const totalUsed = billedAmount + wipAmount;
  const remainingBudget = budget - totalUsed;
  const budgetUsedPercent = budget > 0 ? (totalUsed / budget) * 100 : 0;
  const collectionRate = billedAmount > 0 ? (paidAmount / billedAmount) * 100 : 100;

  const chartData = [...snapshots].reverse().map(s => ({
    date: format(new Date(s.as_of_date), 'MMM dd'),
    wip: s.wip_amount,
    billed: s.billed_amount,
    paid: s.paid_amount,
  }));

  const handleDeleteMatter = async () => {
    await deleteMatter.mutateAsync(id!);
    navigate('/matters');
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" asChild className="-ml-2">
              <Link to="/matters">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
                  {matter.matter_name}
                </h1>
                <StatusBadge status={matter.status} />
              </div>
              <p className="text-muted-foreground">{matter.matter_number}</p>
            </div>
          </div>
          <div className="flex gap-2 ml-10 sm:ml-0">
            <Button variant="outline" asChild>
              <Link to={`/matters/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Matter</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this matter and all associated data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteMatter} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Meta info */}
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{matter.clients?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Lead Partner</p>
                  <p className="font-medium">{matter.lead_partner || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Practice Area</p>
                  <p className="font-medium">{matter.practice_area || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="font-medium">{formatDate(matter.start_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <PoundSterling className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Budget Type</p>
                  <p className="font-medium">{matter.budget_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Target Close</p>
                  <p className="font-medium">{formatDate(matter.target_close_date)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Budget overview */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg font-heading">Budget Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Budget Used</span>
                      <span className={cn(
                        "font-medium",
                        budgetUsedPercent > 100 && "text-danger",
                        budgetUsedPercent >= 80 && budgetUsedPercent <= 100 && "text-warning",
                        budgetUsedPercent < 80 && "text-success"
                      )}>
                        {budgetUsedPercent.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(budgetUsedPercent, 100)} 
                      className={cn(
                        "h-3",
                        budgetUsedPercent > 100 && "[&>div]:bg-danger",
                        budgetUsedPercent >= 80 && budgetUsedPercent <= 100 && "[&>div]:bg-warning",
                        budgetUsedPercent < 80 && "[&>div]:bg-success"
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Agreed Budget</p>
                      <p className="text-xl font-heading font-bold">{formatCurrency(budget)}</p>
                    </div>
                    <div className={cn(
                      "p-4 rounded-lg",
                      remainingBudget < 0 ? "bg-danger/10" : "bg-success/10"
                    )}>
                      <p className="text-sm text-muted-foreground">Remaining</p>
                      <p className={cn(
                        "text-xl font-heading font-bold",
                        remainingBudget < 0 ? "text-danger" : "text-success"
                      )}>
                        {formatCurrency(remainingBudget)}
                      </p>
                    </div>
                  </div>

                  {matter.budget_notes && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Budget Notes</p>
                      <p className="text-sm">{matter.budget_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg font-heading">Financial Summary</CardTitle>
                  {latestSnapshot && (
                    <CardDescription>
                      As of {formatDate(latestSnapshot.as_of_date)}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-muted-foreground">Work in Progress</span>
                    <span className="text-lg font-semibold">{formatCurrency(wipAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-muted-foreground">Billed</span>
                    <span className="text-lg font-semibold">{formatCurrency(billedAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="text-lg font-semibold text-success">{formatCurrency(paidAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-muted-foreground">Collection Rate</span>
                    <span className={cn(
                      "text-lg font-semibold",
                      collectionRate >= 80 && "text-success",
                      collectionRate >= 60 && collectionRate < 80 && "text-warning",
                      collectionRate < 60 && "text-danger"
                    )}>
                      {collectionRate.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="financials" className="space-y-6">
            {/* Chart */}
            {chartData.length > 1 && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg font-heading">Financial Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v) => `£${(v/1000)}k`} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend />
                        <Line type="monotone" dataKey="wip" name="WIP" stroke="hsl(var(--chart-3))" strokeWidth={2} />
                        <Line type="monotone" dataKey="billed" name="Billed" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                        <Line type="monotone" dataKey="paid" name="Paid" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Snapshots table */}
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-heading">Financial Snapshots</CardTitle>
                <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => setEditingSnapshot(null)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Snapshot
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingSnapshot ? 'Edit Snapshot' : 'Add Financial Snapshot'}</DialogTitle>
                    </DialogHeader>
                    <SnapshotForm
                      matterId={id!}
                      snapshot={editingSnapshot}
                      onSuccess={() => {
                        setSnapshotDialogOpen(false);
                        setEditingSnapshot(null);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {snapshotsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : snapshots.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No snapshots yet. Add your first financial snapshot to track progress.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">WIP</TableHead>
                        <TableHead className="text-right">Billed</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshots.map((snapshot) => (
                        <TableRow key={snapshot.id}>
                          <TableCell>{formatDate(snapshot.as_of_date)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(snapshot.wip_amount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(snapshot.billed_amount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(snapshot.paid_amount)}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {snapshot.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingSnapshot(snapshot);
                                  setSnapshotDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Snapshot</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this financial snapshot.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteSnapshot.mutate(snapshot.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-heading">Invoices</CardTitle>
                <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => setEditingInvoice(null)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Invoice
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'Add Invoice'}</DialogTitle>
                    </DialogHeader>
                    <InvoiceForm
                      matterId={id!}
                      invoice={editingInvoice}
                      onSuccess={() => {
                        setInvoiceDialogOpen(false);
                        setEditingInvoice(null);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : invoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No invoices yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(invoice.billed_amount)}</TableCell>
                          <TableCell>{formatDate(invoice.due_date)}</TableCell>
                          <TableCell>
                            <StatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(invoice.paid_amount)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingInvoice(invoice);
                                  setInvoiceDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this invoice.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteInvoice.mutate(invoice.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
