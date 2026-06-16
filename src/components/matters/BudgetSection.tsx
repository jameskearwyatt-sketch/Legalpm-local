import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { Trash2, Loader2, ChevronDown, History, Check, TrendingUp, Download, FileEdit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useBudgetVersions, DraftLineItem, BudgetLineItem } from '@/lib/hooks/useBudgetVersions';
import { useBudgetDrafts, BudgetDraft } from '@/lib/hooks/useBudgetDrafts';
import { useBudgetAmendments } from '@/lib/hooks/useBudgetAmendments';
import { useDetailedWipUpdates } from '@/lib/hooks/useDetailedWipUpdates';
import { useSnapshots } from '@/lib/hooks/useSnapshots';
import { useLocalCounsels } from '@/lib/hooks/useLocalCounsels';
import { useMatter } from '@/lib/hooks/useMatters';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CategorizedBudgetView } from './CategorizedBudgetView';
import { BudgetSummaryBoxes } from './BudgetSummaryBoxes';
import { DetailedWipUpdateModal } from './DetailedWipUpdateModal';
import { WipHistoryModal } from './WipHistoryModal';
import { formatCurrency as sharedFormatCurrency } from '@/lib/currencyUtils';
import { exportBudgetToExcel } from '@/lib/exportBudgetToExcel';
import { exportDraftBudgetToExcel } from '@/lib/exportDraftBudgetToExcel';

interface BudgetSectionProps {
  matterId: string;
  currency: string;
}

const providerOptions = ['Baker McKenzie', 'Local Counsel'] as const;
const currencyOptions = ['GBP', 'USD', 'EUR', 'CHF', 'AUD', 'CAD', 'SGD', 'SEK', 'Ringgit'] as const;

export function BudgetSection({ matterId, currency }: BudgetSectionProps) {
  const queryClient = useQueryClient();
  const { data: matter } = useMatter(matterId);
  const {
    versions,
    latestVersion,
    latestLineItems,
    isLoading,
    isLoadingLineItems,
    finalizeBudget,
    deleteBudgetVersion,
    fetchLineItems,
    toggleLineItemIncluded,
    updateLineItemOptional,
    updateLineItemCapped,
  } = useBudgetVersions(matterId);
  
  const { localCounsels, syncLocalCounselsFromBudget } = useLocalCounsels(matterId);
  const { drafts, createDraft, deleteDraft } = useBudgetDrafts(matterId);
  const { amendments: budgetAmendments } = useBudgetAmendments(matterId);
  const { latestWipUpdate } = useDetailedWipUpdates(matterId);
  const { snapshots } = useSnapshots(matterId);
  const latestSnapshot = snapshots?.[0];

  const [draftItems, setDraftItems] = useState<DraftLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // Store original values when editing starts for comparison
  const [originalItems, setOriginalItems] = useState<DraftLineItem[]>([]);
  // Store version 1 (original settled) line items for budget creep visibility
  const [settledItems, setSettledItems] = useState<DraftLineItem[]>([]);

  // Silent update for local counsel billing (no toast)
  const updateLocalCounselBilling = async (value: 'Direct' | 'Disb' | null) => {
    await supabase.from('matters').update({ local_counsel_billing: value }).eq('id', matterId);
    queryClient.invalidateQueries({ queryKey: ['matter', matterId] });
    queryClient.invalidateQueries({ queryKey: ['matters'] });
  };

  // Update different billing currency fields
  const updateBillingCurrencyField = async (field: string, value: any) => {
    await supabase.from('matters').update({ [field]: value }).eq('id', matterId);
    queryClient.invalidateQueries({ queryKey: ['matter', matterId] });
    queryClient.invalidateQueries({ queryKey: ['matters'] });
  };
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedVersionItems, setSelectedVersionItems] = useState<BudgetLineItem[]>([]);
  const [loadingVersionItems, setLoadingVersionItems] = useState(false);

  // Detailed WIP Update state
  const [isDetailedWipOpen, setIsDetailedWipOpen] = useState(false);
  const [isWipHistoryOpen, setIsWipHistoryOpen] = useState(false);
  
  // Line items collapsible state - controlled separately
  const [isLineItemsOpen, setIsLineItemsOpen] = useState(false);
  
  // Draft budget state
  const [showSaveDraftPrompt, setShowSaveDraftPrompt] = useState(false);
  const [showExportDraftPrompt, setShowExportDraftPrompt] = useState(false);
  const [isDraftsDialogOpen, setIsDraftsDialogOpen] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<BudgetDraft | null>(null);

  const hasExistingBudget = versions.length > 0;

  // Fetch version 1 (original settled) line items for budget creep display
  useEffect(() => {
    if (versions.length < 2) {
      // Only one version or none — no creep to show
      setSettledItems([]);
      return;
    }
    // versions are sorted descending, so version 1 is the last element
    const version1 = versions[versions.length - 1];
    if (!version1) return;
    
    fetchLineItems(version1.id).then(items => {
      setSettledItems(items.map(item => ({
        id: item.id,
        work_item: item.work_item,
        provider: item.provider,
        fee_amount: item.fee_amount,
        lc_firm_name: item.lc_firm_name || undefined,
        category: item.category || undefined,
      })));
    }).catch(err => {
      console.error('Failed to fetch settled items:', err);
      toast.error('Failed to load settled budget items', {
        description: 'Budget creep comparison will be unavailable.',
      });
      setSettledItems([]);
    });
  }, [versions]);
  
  // Auto-open line items when editing or no budget exists
  useEffect(() => {
    if (isEditing || !hasExistingBudget) {
      setIsLineItemsOpen(true);
    }
  }, [isEditing, hasExistingBudget]);

  // Initialize draft items from latest version when available
  // Only sync when NOT editing to preserve user edits
  useEffect(() => {
    if (isEditing) {
      // Don't overwrite draft items while editing
      return;
    }
    if (latestLineItems.length > 0) {
      setDraftItems(latestLineItems.map(item => ({
        id: item.id,
        work_item: item.work_item,
        detail: item.detail || null,
        provider: item.provider,
        fee_amount: item.fee_amount,
        lc_firm_name: item.lc_firm_name || undefined,
        is_optional: item.is_optional,
        is_included: item.is_included,
        is_capped: item.is_capped,
        is_additional_scope: item.is_additional_scope,
        category: item.category || undefined,
        wip_amount: item.wip_amount,
        wip_write_off: item.wip_write_off,
        wip_updated_at: item.wip_updated_at,
      })));
    } else if (!hasExistingBudget && draftItems.length === 0) {
      // Add one empty line for new budgets
      setDraftItems([{ work_item: '', provider: 'Baker McKenzie', fee_amount: 0 }]);
    }
  }, [latestLineItems, hasExistingBudget, isEditing]);

  // Currency conversion helpers
  const differentBillingCurrency = matter?.different_billing_currency ?? false;
  const quoteCurrency = matter?.quote_currency || currency;
  const billingCurrency = matter?.billing_currency || currency;
  const agreedBillingAmount = matter?.agreed_billing_amount || 0;
  const originalFeeUpperEnd = matter?.fee_amount_upper_end || 0;
  const payFullTimeCosts = matter?.pay_full_time_costs ?? false;
  
  // Calculate mandated exchange rate (billing currency per quote currency)
  const mandatedRate = (differentBillingCurrency && originalFeeUpperEnd > 0 && agreedBillingAmount > 0)
    ? agreedBillingAmount / originalFeeUpperEnd
    : 1;

  const formatCurrency = (value: number, curr?: string) => {
    const symbols: Record<string, string> = {
      GBP: '£', USD: '$', EUR: '€', Ringgit: 'RM ', CHF: 'CHF ', AUD: 'A$', CAD: 'C$', SGD: 'S$', SEK: 'kr ',
    };
    const targetCurrency = curr || currency;
    const symbol = symbols[targetCurrency] || targetCurrency + ' ';
    return symbol + new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  // Format with conversion for different billing currency
  // NOTE: Budget values are stored in the BILLING currency, not the quote currency.
  // The mandated rate was only used during initial budget creation to convert from quote to billing.
  // For display, we should just show values in the billing currency directly.
  const formatWithConversion = (value: number) => {
    // Just display in billing currency - values are already in billing currency
    const displayCurrency = differentBillingCurrency && billingCurrency ? billingCurrency : currency;
    return formatCurrency(value, displayCurrency);
  };

  const formatDate = (date: string) => format(new Date(date), 'dd MMM yyyy HH:mm');

  const addLineItem = () => {
    setDraftItems([...draftItems, { work_item: '', provider: 'Baker McKenzie', fee_amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setDraftItems(draftItems.filter((_, i) => i !== index));
  };

  // Check if we're in billing currency mode for editing
  const isInBillingCurrencyMode = differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0;

  const updateLineItem = (index: number, field: keyof DraftLineItem, value: string | number) => {
    // Create new array with new object at index to avoid mutating originalItems
    const updated = draftItems.map((item, i) => {
      if (i !== index) return item;
      // Create new object for the edited item
      const newItem = { ...item };
      if (field === 'fee_amount') {
        // Values are stored directly in billing currency - no conversion needed
        let parsedValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
        newItem.fee_amount = parsedValue;
      } else if (field === 'provider') {
        newItem.provider = value as 'Baker McKenzie' | 'Local Counsel';
        // Clear LC firm name when switching away from Local Counsel
        if (value !== 'Local Counsel') {
          newItem.lc_firm_name = undefined;
        }
      } else if (field === 'lc_firm_name') {
        newItem.lc_firm_name = value as string;
      } else if (field === 'detail') {
        newItem.detail = value as string || null;
      } else {
        newItem.work_item = value as string;
      }
      return newItem;
    });
    setDraftItems(updated);
  };
  
  // Get unique LC firm names from current draft items and existing local counsels
  const existingLcFirmNames = [
    ...new Set([
      ...localCounsels.map(lc => lc.firm_name),
      ...draftItems.filter(item => item.provider === 'Local Counsel' && item.lc_firm_name).map(item => item.lc_firm_name!)
    ])
  ].sort();

  // Calculate totals (current draft) - only include items that are not optional OR are optional and included
  const includedDraftItems = draftItems.filter(item => 
    !item.is_optional || (item.is_optional && item.is_included !== false)
  );
  const bmTotal = includedDraftItems
    .filter(item => item.provider === 'Baker McKenzie')
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  const localCounselTotal = includedDraftItems
    .filter(item => item.provider === 'Local Counsel')
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  const overallTotal = bmTotal + localCounselTotal;

  // Calculate totals including ALL items (for reference)
  const allItemsBmTotal = draftItems
    .filter(item => item.provider === 'Baker McKenzie')
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  const allItemsLcTotal = draftItems
    .filter(item => item.provider === 'Local Counsel')
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  const hasOptionalItems = draftItems.some(item => item.is_optional);

  // Calculate original totals for comparison during editing
  const originalBmTotal = originalItems
    .filter(item => item.provider === 'Baker McKenzie')
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  const originalLcTotal = originalItems
    .filter(item => item.provider === 'Local Counsel')
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  const originalOverallTotal = originalBmTotal + originalLcTotal;

  const handleFinalize = async () => {
    // Filter out empty items
    const validItems = draftItems.filter(item => item.work_item.trim() !== '');
    
    await finalizeBudget.mutateAsync({
      matter_id: matterId,
      line_items: validItems,
      notes: notes.trim() || undefined,
    });
    
    // Sync local counsel entries from budget line items
    const lcLineItems = validItems
      .filter(item => item.provider === 'Local Counsel' && item.lc_firm_name)
      .map(item => ({ firm_name: item.lc_firm_name!, fee_amount: item.fee_amount }));
    
    if (lcLineItems.length > 0) {
      await syncLocalCounselsFromBudget.mutateAsync(lcLineItems);
    }

    setNotes('');
    setIsEditing(false);
    setOriginalItems([]); // Clear original items after finalizing
  };

  const handleDeleteVersion = async (versionId: string) => {
    await deleteBudgetVersion.mutateAsync(versionId);
    // Reset draft items if we deleted the last version
    if (versions.length === 1) {
      setDraftItems([{ work_item: '', provider: 'Baker McKenzie', fee_amount: 0 }]);
    }
  };

  const startEditing = () => {
    // Store DEEP COPY of original items for comparison display (prevent mutation)
    setOriginalItems(draftItems.map(item => ({ ...item })));
    setIsEditing(true);
    if (draftItems.length === 0) {
      setDraftItems([{ work_item: '', provider: 'Baker McKenzie', fee_amount: 0 }]);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    // Reset to latest version
    if (latestLineItems.length > 0) {
      setDraftItems(latestLineItems.map(item => ({
        id: item.id,
        work_item: item.work_item,
        detail: item.detail || null,
        provider: item.provider,
        fee_amount: item.fee_amount,
        lc_firm_name: item.lc_firm_name || undefined,
        is_optional: item.is_optional,
        is_included: item.is_included,
        is_capped: item.is_capped,
        is_additional_scope: item.is_additional_scope,
        category: item.category || undefined,
        wip_amount: item.wip_amount,
        wip_write_off: item.wip_write_off,
        wip_updated_at: item.wip_updated_at,
      })));
    }
    setNotes('');
    setOriginalItems([]);
  };

  // Handle saving draft for client discussion
  const handleSaveDraft = async () => {
    const validItems = draftItems.filter(item => item.work_item.trim() !== '');
    if (validItems.length === 0) {
      toast.error('Please add at least one budget item');
      return;
    }
    
    await createDraft.mutateAsync({
      matter_id: matterId,
      name: `Draft - ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      notes: notes.trim() || undefined,
      line_items: draftItems,
    });
    
    // Show the export prompt
    setShowExportDraftPrompt(true);
  };

  // Handle exporting draft to Excel
  const handleExportDraft = async (draft?: BudgetDraft) => {
    const itemsToExport = draft ? draft.line_items : draftItems;
    
    // Get existing budget items for comparison (if there's an existing budget)
    const existingItems = hasExistingBudget && latestLineItems.length > 0 
      ? latestLineItems.map(item => ({
          work_item: item.work_item,
          provider: item.provider,
          fee_amount: item.fee_amount,
          lc_firm_name: item.lc_firm_name || undefined,
          category: item.category || undefined,
        }))
      : [];
    
    try {
      await exportDraftBudgetToExcel({
        items: itemsToExport,
        matterName: matter?.matter_display_name || matter?.matter_name || 'Unknown Matter',
        clientName: matter?.clients?.display_name || matter?.clients?.name || 'Unknown Client',
        currency: billingCurrency,
        draftName: draft?.name || 'Draft Budget Proposal',
        notes: draft?.notes || notes || undefined,
        conversionRate: mandatedRate,
        existingItems,
      });
      toast.success('Draft budget exported to Excel');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export draft');
    }
  };

  // Load draft into editor
  const loadDraftForEditing = (draft: BudgetDraft) => {
    setDraftItems(draft.line_items);
    setNotes(draft.notes || '');
    if (!isEditing) {
      startEditing();
    }
    setIsDraftsDialogOpen(false);
    toast.success('Draft loaded. You can now edit and save as final budget.');
  };

  // Finalize from a saved draft
  const handleFinalizeDraft = async (draft: BudgetDraft) => {
    setDraftItems(draft.line_items);
    setNotes(draft.notes || '');
    
    // Filter out empty items
    const validItems = draft.line_items.filter(item => item.work_item.trim() !== '');
    
    await finalizeBudget.mutateAsync({
      matter_id: matterId,
      line_items: validItems,
      notes: draft.notes?.trim() || undefined,
    });
    
    // Sync local counsel entries from budget line items
    const lcLineItems = validItems
      .filter(item => item.provider === 'Local Counsel' && item.lc_firm_name)
      .map(item => ({ firm_name: item.lc_firm_name!, fee_amount: item.fee_amount }));
    
    if (lcLineItems.length > 0) {
      await syncLocalCounselsFromBudget.mutateAsync(lcLineItems);
    }
    
    // Delete the draft after finalizing
    await deleteDraft.mutateAsync(draft.id);
    
    setIsDraftsDialogOpen(false);
    setNotes('');
    setIsEditing(false);
  };

  const handleItemEdit = (index: number, field: keyof DraftLineItem, value: string | number) => {
    updateLineItem(index, field, value);
  };

  const loadVersionItems = async (versionId: string) => {
    if (selectedVersionId === versionId) {
      setSelectedVersionId(null);
      setSelectedVersionItems([]);
      return;
    }
    
    setLoadingVersionItems(true);
    setSelectedVersionId(versionId);
    try {
      const items = await fetchLineItems(versionId);
      setSelectedVersionItems(items);
    } catch (error) {
      console.error('Failed to load version items:', error);
    } finally {
      setLoadingVersionItems(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-heading">Budget</CardTitle>
        <div className="flex items-center gap-2">
          {/* Detailed WIP Update button - show when budget exists and not editing */}
          {hasExistingBudget && latestVersion && !isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailedWipOpen(true)}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Detailed Budget Utilisation Update
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsWipHistoryOpen(true)}
              >
                <History className="h-4 w-4 mr-2" />
                Budget Utilisation History
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await exportBudgetToExcel({
                      items: draftItems,
                      matterName: matter?.matter_display_name || matter?.matter_name || 'Unknown Matter',
                      clientName: matter?.clients?.display_name || matter?.clients?.name || 'Unknown Client',
                      currency: billingCurrency,
                      versionNumber: latestVersion?.version_number,
                      versionDate: latestVersion?.finalized_at,
                      conversionRate: mandatedRate,
                    });
                    toast.success('Budget report exported successfully');
                  } catch (error) {
                    console.error('Export failed:', error);
                    toast.error('Failed to export budget report');
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
            </>
          )}
          {hasExistingBudget && latestVersion && (
            <span className="text-sm text-muted-foreground">
              Version {latestVersion.version_number} • Finalized {formatDate(latestVersion.finalized_at)}
            </span>
          )}
          {hasExistingBudget && latestVersion && !isEditing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Budget Version {latestVersion.version_number}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you wish to delete this budget? This will remove all line items and cannot be undone.
                    {versions.length > 1 && (
                      <span className="block mt-2">
                        The previous version (Version {versions[1]?.version_number}) will become the current budget.
                      </span>
                    )}
                    {versions.length === 1 && (
                      <span className="block mt-2">
                        This is the only budget version. The budget will be reset to zero.
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteVersion(latestVersion.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteBudgetVersion.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Delete'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Summary Boxes - Always Visible */}
        <BudgetSummaryBoxes
          items={draftItems}
          formatCurrency={formatCurrency}
          currency={currency}
          billingCurrency={billingCurrency}
          differentBillingCurrency={differentBillingCurrency}
          agreedBillingAmount={agreedBillingAmount}
          mandatedRate={mandatedRate}
        />

        {/* Budget and Utilization Update Dates */}
        {hasExistingBudget && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t border-border/50 pt-3">
            {/* Budget Date */}
            <div className="flex items-center gap-1.5">
              <span className="font-medium">Budget:</span>
              <span>
                {budgetAmendments.length > 0 
                  ? `Updated ${format(new Date(budgetAmendments[0].amendment_date), 'dd MMM yyyy')}`
                  : 'Original budget'
                }
              </span>
            </div>
            
            {/* Utilization Update Date */}
            <div className="flex items-center gap-1.5">
              <span className="font-medium">Utilisation:</span>
              <span>
                {latestWipUpdate 
                  ? `Updated ${format(new Date(latestWipUpdate.updated_at), 'dd MMM yyyy')}`
                  : 'No utilisation recorded'
                }
              </span>
            </div>
            
            {/* Staleness Warning - show if utilization is >1 month older than financial snapshot */}
            {(() => {
              if (!latestWipUpdate || !latestSnapshot) return null;
              
              const wipDate = new Date(latestWipUpdate.updated_at);
              const snapshotDate = new Date(latestSnapshot.updated_at);
              const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
              
              if (snapshotDate.getTime() - wipDate.getTime() > oneMonthMs) {
                return (
                  <span className="text-destructive flex items-center gap-1">
                    ⚠️ Utilisation is stale vs. financial snapshot
                  </span>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Collapsible Budget Line Items */}
        <Collapsible open={isLineItemsOpen} onOpenChange={setIsLineItemsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground p-0 h-auto py-2 border-b">
              <span className="flex items-center gap-2 text-sm font-medium">
                View Line Items ({draftItems.filter(i => i.work_item.trim()).length} items)
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isLineItemsOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            {/* Budget Editing Summary - Show when editing */}
            {isEditing && hasExistingBudget && originalItems.length > 0 && (
              <div className="mb-4 p-3 bg-muted/30 rounded-lg space-y-2">
                <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground">
                  <div></div>
                  <div className="text-right">Current</div>
                  <div className="text-right">New</div>
                </div>
                
                {/* BM Total */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-muted-foreground">Baker McKenzie:</span>
                  <div className="text-right text-muted-foreground">
                    {formatCurrency(
                      differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                        ? originalBmTotal * mandatedRate
                        : originalBmTotal,
                      differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency
                    )}
                  </div>
                  <div className={cn(
                    "text-right font-medium",
                    Math.abs(bmTotal - originalBmTotal) > 0.01 && "text-blue-600 dark:text-blue-400"
                  )}>
                    {formatCurrency(
                      differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                        ? bmTotal * mandatedRate
                        : bmTotal,
                      differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency
                    )}
                  </div>
                </div>
                
                {/* LC Total */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-muted-foreground">Local Counsel:</span>
                  <div className="text-right text-muted-foreground">
                    {formatCurrency(
                      differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                        ? originalLcTotal * mandatedRate
                        : originalLcTotal,
                      differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency
                    )}
                  </div>
                  <div className={cn(
                    "text-right font-medium",
                    Math.abs(localCounselTotal - originalLcTotal) > 0.01 && "text-blue-600 dark:text-blue-400"
                  )}>
                    {formatCurrency(
                      differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                        ? localCounselTotal * mandatedRate
                        : localCounselTotal,
                      differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency
                    )}
                  </div>
                </div>
                
                {/* Overall Total */}
                <div className="grid grid-cols-3 gap-2 text-sm font-semibold border-t pt-2">
                  <span>Overall:</span>
                  <div className="text-right text-muted-foreground font-normal">
                    {formatCurrency(
                      differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                        ? originalOverallTotal * mandatedRate
                        : originalOverallTotal,
                      differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency
                    )}
                  </div>
                  <div className={cn(
                    "text-right",
                    Math.abs(overallTotal - originalOverallTotal) > 0.01 ? "text-blue-600 dark:text-blue-400" : "text-primary"
                  )}>
                    {formatCurrency(
                      differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                        ? overallTotal * mandatedRate
                        : overallTotal,
                      differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <CategorizedBudgetView
              items={draftItems}
              onItemsChange={setDraftItems}
              onItemEdit={handleItemEdit}
              onRemoveItem={removeLineItem}
              onAddItem={addLineItem}
              isEditing={isEditing}
              hasExistingBudget={hasExistingBudget}
              formatCurrency={formatCurrency}
              currency={currency}
              billingCurrency={billingCurrency}
              quoteCurrency={quoteCurrency}
              differentBillingCurrency={differentBillingCurrency}
              agreedBillingAmount={agreedBillingAmount}
              mandatedRate={mandatedRate}
              existingLcFirmNames={existingLcFirmNames}
              hasOptionalItems={hasOptionalItems}
              originalItems={originalItems}
              updateLineItemOptional={updateLineItemOptional}
              toggleLineItemIncluded={toggleLineItemIncluded}
              updateLineItemCapped={updateLineItemCapped}
              matterId={matterId}
              settledItems={settledItems}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Different Billing Currency Section */}
        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={differentBillingCurrency}
                onChange={async (e) => {
                  await updateBillingCurrencyField('different_billing_currency', e.target.checked);
                  if (!e.target.checked) {
                    // Reset related fields when unchecked
                    await updateBillingCurrencyField('quote_currency', null);
                    await updateBillingCurrencyField('billing_currency', null);
                    await updateBillingCurrencyField('agreed_billing_amount', 0);
                  }
                }}
                className="h-4 w-4 rounded border cursor-pointer"
              />
              <span className="text-sm">Was fee quoted in a different currency to the currency in which fees will be billed?</span>
            </label>
          </div>

          {differentBillingCurrency && (
            <div className="space-y-4 pl-6 border-l-2 border-muted ml-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Currency in which fee was quoted</Label>
                  <Select
                    value={quoteCurrency}
                    onValueChange={(v) => updateBillingCurrencyField('quote_currency', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Currency in which fees will be billed</Label>
                  <Select
                    value={billingCurrency}
                    onValueChange={(v) => updateBillingCurrencyField('billing_currency', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Upper end estimate agreed with client in billing currency ({billingCurrency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={agreedBillingAmount || ''}
                  onChange={(e) => updateBillingCurrencyField('agreed_billing_amount', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="max-w-xs"
                />
              </div>
              {agreedBillingAmount > 0 && originalFeeUpperEnd > 0 && (
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <span className="font-medium">Mandated exchange rate:</span>{' '}
                  {mandatedRate.toFixed(4)} {billingCurrency}/{quoteCurrency}
                  <span className="block text-xs mt-1">
                    ({formatCurrency(originalFeeUpperEnd, quoteCurrency)} → {formatCurrency(agreedBillingAmount, billingCurrency)})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full Time Costs Option */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={payFullTimeCosts}
              onChange={async (e) => {
                await updateBillingCurrencyField('pay_full_time_costs', e.target.checked);
              }}
              className="h-4 w-4 rounded border cursor-pointer"
            />
            <span className="text-sm">Client pays full time costs (no estimate/budget tracking)</span>
          </label>
          {payFullTimeCosts && (
            <p className="text-xs text-muted-foreground mt-2 pl-6">
              Budget and headroom will show as N/A in the matters table since the client will pay whatever time costs are incurred.
            </p>
          )}
        </div>

        {(isEditing || !hasExistingBudget) && (
          <div className="space-y-3">
            <Label>{hasExistingBudget ? 'Update Notes' : 'Budget Notes'}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={hasExistingBudget 
                ? "Why is this budget being updated? (e.g., Client agreed to additional scope)" 
                : "Any notes about this budget (optional)"}
              rows={2}
            />
          </div>
        )}

        {/* Show current budget notes if viewing (not editing) */}
        {hasExistingBudget && !isEditing && latestVersion?.notes && (
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm text-muted-foreground italic">{latestVersion.notes}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            {!hasExistingBudget ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={createDraft.isPending || draftItems.every(i => !i.work_item.trim())}
                  className="flex-1"
                >
                  {createDraft.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileEdit className="h-4 w-4 mr-2" />
                  )}
                  Save Draft for Discussion
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={finalizeBudget.isPending || draftItems.every(i => !i.work_item.trim())}
                  className="flex-1"
                >
                  {finalizeBudget.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save Budget (Agreed)
                </Button>
              </>
            ) : isEditing ? (
              <>
                <Button variant="outline" onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={createDraft.isPending}
                  className="flex-1"
                >
                  {createDraft.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileEdit className="h-4 w-4 mr-2" />
                  )}
                  Save Draft for Discussion
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={finalizeBudget.isPending}
                  className="flex-1"
                >
                  {finalizeBudget.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save Budget (Agreed)
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={startEditing} className="flex-1">
                  Update Budget
                </Button>
                {drafts.length > 0 && (
                  <Button variant="outline" onClick={() => setIsDraftsDialogOpen(true)}>
                    <FileEdit className="h-4 w-4 mr-2" />
                    View Drafts ({drafts.length})
                  </Button>
                )}
              </>
            )}
          </div>
          
          {/* Show draft indicator when not editing */}
          {!isEditing && drafts.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              <FileEdit className="h-3.5 w-3.5" />
              <span>{drafts.length} draft{drafts.length > 1 ? 's' : ''} saved for client discussion</span>
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-xs"
                onClick={() => setIsDraftsDialogOpen(true)}
              >
                View &amp; Manage
              </Button>
            </div>
          )}
        </div>

        {/* Export Draft Prompt Dialog */}
        <Dialog open={showExportDraftPrompt} onOpenChange={setShowExportDraftPrompt}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Draft Saved Successfully</DialogTitle>
              <DialogDescription>
                Your draft budget has been saved. Would you like to download it as an Excel file to share with the client?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowExportDraftPrompt(false);
                  setIsEditing(false);
                }}
              >
                No, Continue Editing
              </Button>
              <Button 
                onClick={async () => {
                  await handleExportDraft();
                  setShowExportDraftPrompt(false);
                  setIsEditing(false);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Excel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Drafts Management Dialog */}
        <Dialog open={isDraftsDialogOpen} onOpenChange={setIsDraftsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Saved Draft Budgets</DialogTitle>
              <DialogDescription>
                Draft budgets saved for client discussion. You can download, edit, or finalize these drafts.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No drafts saved yet.</p>
              ) : (
                drafts.map((draft) => (
                  <div 
                    key={draft.id} 
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{draft.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          Created {format(new Date(draft.created_at), 'dd MMM yyyy HH:mm')}
                        </p>
                        {draft.notes && (
                          <p className="text-sm text-muted-foreground mt-1 italic">{draft.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {differentBillingCurrency && mandatedRate !== 1 ? (
                          <>
                            <p className="font-semibold">{formatCurrency(draft.total_amount * mandatedRate, billingCurrency)}</p>
                            <p className="text-xs text-muted-foreground">
                              ({formatCurrency(draft.total_amount, quoteCurrency)})
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              BM: {formatCurrency(draft.bm_total * mandatedRate, billingCurrency)} | LC: {formatCurrency(draft.local_counsel_total * mandatedRate, billingCurrency)}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold">{formatCurrency(draft.total_amount, quoteCurrency)}</p>
                            <p className="text-xs text-muted-foreground">
                              BM: {formatCurrency(draft.bm_total, quoteCurrency)} | LC: {formatCurrency(draft.local_counsel_total, quoteCurrency)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportDraft(draft)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Download Excel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadDraftForEditing(draft)}
                      >
                        <FileEdit className="h-3.5 w-3.5 mr-1.5" />
                        Edit Draft
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleFinalizeDraft(draft)}
                        disabled={finalizeBudget.isPending}
                      >
                        {finalizeBudget.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Save as Agreed Budget
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this draft? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteDraft.mutate(draft.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Budget History */}
        {versions.length > 1 && (
          <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Budget History ({versions.length} versions)
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", isHistoryOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={cn(
                      "p-3 rounded-lg text-sm space-y-2 transition-colors",
                      version.id === latestVersion?.id ? "bg-primary/10 border border-primary/20" : "bg-muted/30 hover:bg-muted/50",
                      selectedVersionId === version.id && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <button
                        className="font-medium text-left flex-1 cursor-pointer"
                        onClick={() => loadVersionItems(version.id)}
                      >
                        Version {version.version_number}
                        {version.id === latestVersion?.id && <span className="ml-2 text-xs text-primary">(Current)</span>}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(version.finalized_at)}</span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Budget Version {version.version_number}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you wish to delete this budget version? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteVersion(version.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div 
                      className="grid grid-cols-3 gap-2 text-xs cursor-pointer"
                      onClick={() => loadVersionItems(version.id)}
                    >
                      <div>
                        <span className="text-muted-foreground">BM:</span>
                        <span className="ml-1">
                          {formatCurrency(
                            differentBillingCurrency ? version.bm_total * mandatedRate : version.bm_total,
                            differentBillingCurrency ? billingCurrency : quoteCurrency
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">LC:</span>
                        <span className="ml-1">
                          {formatCurrency(
                            differentBillingCurrency ? version.local_counsel_total * mandatedRate : version.local_counsel_total,
                            differentBillingCurrency ? billingCurrency : quoteCurrency
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total:</span>
                        <span className="ml-1 font-medium">
                          {formatCurrency(
                            differentBillingCurrency ? version.total_amount * mandatedRate : version.total_amount,
                            differentBillingCurrency ? billingCurrency : quoteCurrency
                          )}
                        </span>
                      </div>
                    </div>
                    {version.notes && (
                      <p className="text-xs text-muted-foreground italic">{version.notes}</p>
                    )}

                    {/* Show line items when selected */}
                    {selectedVersionId === version.id && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        {loadingVersionItems ? (
                          <div className="flex justify-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {selectedVersionItems.map((item) => (
                              <div key={item.id} className="flex justify-between text-xs">
                                <span>{item.work_item}</span>
                                <span className="text-muted-foreground">
                                  {item.provider === 'Baker McKenzie' ? 'BM' : 'LC'}: {formatCurrency(
                                    differentBillingCurrency ? item.fee_amount * mandatedRate : item.fee_amount,
                                    differentBillingCurrency ? billingCurrency : quoteCurrency
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>

      {/* Detailed WIP Update Modal */}
      <DetailedWipUpdateModal
        isOpen={isDetailedWipOpen}
        onClose={() => setIsDetailedWipOpen(false)}
        lineItems={latestLineItems}
        matterId={matterId}
        formatCurrency={formatCurrency}
        billingCurrency={billingCurrency}
        quoteCurrency={quoteCurrency}
        mandatedRate={mandatedRate}
        differentBillingCurrency={differentBillingCurrency}
      />

      {/* WIP History Modal */}
      <WipHistoryModal
        isOpen={isWipHistoryOpen}
        onClose={() => setIsWipHistoryOpen(false)}
        matterId={matterId}
        formatCurrency={formatCurrency}
        billingCurrency={billingCurrency}
        quoteCurrency={quoteCurrency}
        mandatedRate={mandatedRate}
        differentBillingCurrency={differentBillingCurrency}
      />
    </Card>
  );
}
