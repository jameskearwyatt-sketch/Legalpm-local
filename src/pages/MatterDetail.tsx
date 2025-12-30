import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useMatter, useMatters } from '@/lib/hooks/useMatters';
import { useSnapshots } from '@/lib/hooks/useSnapshots';
import { useBudgetAmendments } from '@/lib/hooks/useBudgetAmendments';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Loader2,
  PoundSterling,
  Calendar,
  User,
  Building,
  FileText,
  Check,
  X,
  ChevronDown,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function MatterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: matter, isLoading: matterLoading } = useMatter(id!);
  const { deleteMatter, updateMatter } = useMatters();
  const { snapshots } = useSnapshots(id);
  const { amendments, isLoading: amendmentsLoading } = useBudgetAmendments(id);
  
  const [isEditingMatterNumber, setIsEditingMatterNumber] = useState(false);
  const [editedMatterNumber, setEditedMatterNumber] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const formatCurrency = (value: number, currency: string = 'GBP') => {
    const currencySymbols: Record<string, string> = {
      'GBP': '£',
      'USD': '$',
      'EUR': '€',
    };
    const symbol = currencySymbols[currency] || currency + ' ';
    return `${symbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), 'dd MMM yyyy');
  };

  const handleStartEditMatterNumber = () => {
    setEditedMatterNumber(matter?.matter_number || '');
    setIsEditingMatterNumber(true);
  };

  const handleSaveMatterNumber = async () => {
    if (!matter) return;
    await updateMatter.mutateAsync({
      id: matter.id,
      matter_number: editedMatterNumber,
    });
    setIsEditingMatterNumber(false);
  };

  const handleCancelEditMatterNumber = () => {
    setIsEditingMatterNumber(false);
    setEditedMatterNumber('');
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
  const bmFee = matter.bm_fee_component || 0;
  const localCounsel = matter.local_counsel_fee || 0;
  const totalUsed = billedAmount + wipAmount;
  const remainingBudget = budget - totalUsed;
  const budgetUsedPercent = budget > 0 ? (totalUsed / budget) * 100 : 0;
  const collectionRate = billedAmount > 0 ? (paidAmount / billedAmount) * 100 : 100;
  const currency = matter.fee_currency || matter.currency || 'GBP';

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
              {/* Editable Matter Number */}
              <div className="flex items-center gap-2">
                {isEditingMatterNumber ? (
                  <>
                    <Input
                      value={editedMatterNumber}
                      onChange={(e) => setEditedMatterNumber(e.target.value)}
                      className="h-7 w-48 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleSaveMatterNumber}
                      disabled={updateMatter.isPending}
                    >
                      <Check className="h-4 w-4 text-success" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCancelEditMatterNumber}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <button
                    onClick={handleStartEditMatterNumber}
                    className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors text-left"
                  >
                    {matter.matter_number}
                  </button>
                )}
              </div>
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

        {/* Overview - No tabs needed, just show both cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Budget overview */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Budget Overview</CardTitle>
              {matter.fee_type && (
                <CardDescription className="text-xs text-muted-foreground">
                  {matter.fee_type}
                </CardDescription>
              )}
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
                  <p className="text-xl font-heading font-bold">{formatCurrency(budget, currency)}</p>
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
                    {formatCurrency(remainingBudget, currency)}
                  </p>
                </div>
              </div>

              {/* BM Fee and Local Counsel breakdown */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">BM Fee Component</span>
                  <span className="font-medium">{formatCurrency(bmFee, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Local Counsel</span>
                  <span className="font-medium">{formatCurrency(localCounsel, currency)}</span>
                </div>
              </div>

              {matter.budget_notes && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Budget Notes</p>
                  <p className="text-sm">{matter.budget_notes}</p>
                </div>
              )}

              {/* Budget History Collapsible */}
              <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <History className="mr-2 h-4 w-4" />
                    Budget History
                    <ChevronDown className={cn(
                      "ml-auto h-4 w-4 transition-transform",
                      isHistoryOpen && "rotate-180"
                    )} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  {amendmentsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : amendments && amendments.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {amendments.map((amendment) => (
                        <div key={amendment.id} className="p-3 rounded-lg bg-muted/30 text-sm space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{formatDate(amendment.amendment_date)}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Budget:</span>
                              <span className="ml-1">
                                {formatCurrency(amendment.previous_budget, currency)} → {formatCurrency(amendment.new_budget, currency)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">BM:</span>
                              <span className="ml-1">
                                {formatCurrency(amendment.previous_bm_fee, currency)} → {formatCurrency(amendment.new_bm_fee, currency)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">LC:</span>
                              <span className="ml-1">
                                {formatCurrency(amendment.previous_local_counsel, currency)} → {formatCurrency(amendment.new_local_counsel, currency)}
                              </span>
                            </div>
                          </div>
                          {amendment.notes && (
                            <p className="text-xs text-muted-foreground italic mt-1">{amendment.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No budget amendments recorded yet.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Financial Summary */}
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
                <span className="text-lg font-semibold">{formatCurrency(wipAmount, currency)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-muted-foreground">Billed</span>
                <span className="text-lg font-semibold">{formatCurrency(billedAmount, currency)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-muted-foreground">Paid</span>
                <span className="text-lg font-semibold text-success">{formatCurrency(paidAmount, currency)}</span>
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
      </div>
    </AppLayout>
  );
}
