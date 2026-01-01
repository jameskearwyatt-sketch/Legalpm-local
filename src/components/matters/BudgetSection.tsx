import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Trash2, Loader2, ChevronDown, History, Check, FileText, Upload, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useBudgetVersions, DraftLineItem, BudgetLineItem } from '@/lib/hooks/useBudgetVersions';
import { useLocalCounsels } from '@/lib/hooks/useLocalCounsels';
import { useMatter } from '@/lib/hooks/useMatters';
import { useAssumptions } from '@/lib/hooks/useAssumptions';
import { extractAssumptionsFromText, ExtractedAssumption, labelColors } from '@/components/matters/AssumptionsSection';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  } = useBudgetVersions(matterId);
  
  const { localCounsels, syncLocalCounselsFromBudget } = useLocalCounsels(matterId);

  const [draftItems, setDraftItems] = useState<DraftLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  // Track which line items were AI-suggested (by index)
  const [aiSuggestedIndices, setAiSuggestedIndices] = useState<Set<number>>(new Set());
  // Store original values when editing starts for comparison
  const [originalItems, setOriginalItems] = useState<DraftLineItem[]>([]);

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
  
  // Import from engagement letter state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importTab, setImportTab] = useState<'paste' | 'upload'>('paste');
  const fileInputRef = useState<HTMLInputElement | null>(null);
  
  // Assumptions import after budget import
  const [showAssumptionsOffer, setShowAssumptionsOffer] = useState(false);
  const [pendingAssumptionsText, setPendingAssumptionsText] = useState('');
  const [isExtractingAssumptions, setIsExtractingAssumptions] = useState(false);
  const [extractedAssumptions, setExtractedAssumptions] = useState<ExtractedAssumption[]>([]);
  const [showAssumptionsPreview, setShowAssumptionsPreview] = useState(false);
  
  const { createBulkAssumptions } = useAssumptions(matterId);

  const hasExistingBudget = versions.length > 0;

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
        provider: item.provider,
        fee_amount: item.fee_amount,
        lc_firm_name: item.lc_firm_name || undefined,
      })));
    } else if (!hasExistingBudget && draftItems.length === 0) {
      // Add one empty line for new budgets
      setDraftItems([{ work_item: '', provider: 'Baker McKenzie', fee_amount: 0 }]);
    }
  }, [latestLineItems, hasExistingBudget, isEditing]);

  // Currency conversion helpers
  const differentBillingCurrency = (matter as any)?.different_billing_currency ?? false;
  const quoteCurrency = (matter as any)?.quote_currency || currency;
  const billingCurrency = (matter as any)?.billing_currency || currency;
  const agreedBillingAmount = (matter as any)?.agreed_billing_amount || 0;
  const originalFeeUpperEnd = matter?.fee_amount_upper_end || 0;
  
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
  const formatWithConversion = (value: number) => {
    if (differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0) {
      const convertedValue = value * mandatedRate;
      return (
        <div className="flex flex-col items-end">
          <span>{formatCurrency(value, quoteCurrency)}</span>
          <span className="text-xs text-muted-foreground">
            ({formatCurrency(convertedValue, billingCurrency)})
          </span>
        </div>
      );
    }
    return formatCurrency(value);
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
        let parsedValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
        // If in billing currency mode, convert back to quote currency for storage
        if (isInBillingCurrencyMode && mandatedRate > 0) {
          parsedValue = parsedValue / mandatedRate;
        }
        newItem.fee_amount = parsedValue;
      } else if (field === 'provider') {
        newItem.provider = value as 'Baker McKenzie' | 'Local Counsel';
        // Clear LC firm name when switching away from Local Counsel
        if (value !== 'Local Counsel') {
          newItem.lc_firm_name = undefined;
        }
      } else if (field === 'lc_firm_name') {
        newItem.lc_firm_name = value as string;
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

  // Import from engagement letter
  const handleImportFromEngagementLetter = async (textContent: string) => {
    if (!textContent.trim()) {
      toast.error('Please provide text to parse');
      return;
    }

    setIsImporting(true);
    try {
      const response = await supabase.functions.invoke('parse-engagement-letter', {
        body: { text: textContent, currency }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to parse engagement letter');
      }

      const { items } = response.data;
      
      if (!items || items.length === 0) {
        toast.error('No budget items found in the text');
        return;
      }

      // Convert to draft items and append to existing items
      const newItems: DraftLineItem[] = items.map((item: any) => ({
        work_item: item.work_item?.substring(0, 100) || '',
        provider: item.provider === 'Local Counsel' ? 'Local Counsel' : 'Baker McKenzie',
        fee_amount: Number(item.fee_amount) || 0,
      }));

      // Filter out empty placeholder items and add new ones
      const existingNonEmpty = draftItems.filter(item => item.work_item.trim() !== '');
      setDraftItems([...existingNonEmpty, ...newItems]);
      
      // Start editing mode if not already
      if (!isEditing && hasExistingBudget) {
        setIsEditing(true);
      }

      setIsImportOpen(false);
      toast.success(`Imported ${items.length} budget items as draft`);
      
      // Offer to import assumptions from the same text
      setPendingAssumptionsText(textContent);
      setShowAssumptionsOffer(true);
    } catch (error) {
      console.error('Error importing engagement letter:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse engagement letter');
    } finally {
      setIsImporting(false);
    }
  };

  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const fileType = file.type;

    // For text files, read directly
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      const text = await file.text();
      setImportText(text);
      setImportTab('paste');
      toast.success('File loaded. Review and click Import.');
      return;
    }

    // For PDF and Word files, use the parse-document-text edge function
    const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');
    const isWord = fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   fileType === 'application/msword' ||
                   fileName.endsWith('.docx') || 
                   fileName.endsWith('.doc');

    if (isPDF || isWord) {
      setIsUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to parse document');
        }

        const result = await response.json();
        if (result.text) {
          setImportText(result.text);
          setImportTab('paste');
          toast.success('Document parsed. Review the extracted text and click Import.');
        } else {
          throw new Error('No text extracted from document');
        }
      } catch (error) {
        console.error('Error parsing document:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to parse document');
      } finally {
        setIsUploadingFile(false);
      }
      return;
    }

    toast.error('Unsupported file type. Please upload a PDF, Word document, or text file.');
  };

  // Assumptions import handlers
  const handleExtractAssumptions = async () => {
    if (!pendingAssumptionsText.trim()) return;
    
    setIsExtractingAssumptions(true);
    try {
      const extracted = await extractAssumptionsFromText(pendingAssumptionsText);
      if (extracted.length > 0) {
        setExtractedAssumptions(extracted);
        setShowAssumptionsOffer(false);
        setShowAssumptionsPreview(true);
        toast.success(`Found ${extracted.length} assumptions`);
      } else {
        toast.info('No assumptions found in the document');
        setShowAssumptionsOffer(false);
      }
    } catch (error) {
      console.error('Error extracting assumptions:', error);
      toast.error('Failed to extract assumptions');
    } finally {
      setIsExtractingAssumptions(false);
    }
  };

  const toggleAssumptionSelection = (index: number) => {
    setExtractedAssumptions(prev => 
      prev.map((a, i) => i === index ? { ...a, selected: !a.selected } : a)
    );
  };

  const selectedAssumptionsCount = extractedAssumptions.filter(a => a.selected).length;

  const handleImportSelectedAssumptions = async () => {
    const selected = extractedAssumptions.filter(a => a.selected);
    if (selected.length === 0) {
      toast.error('Please select at least one assumption');
      return;
    }

    try {
      await createBulkAssumptions.mutateAsync(
        selected.map(a => ({
          label: a.label,
          assumption_text: a.assumption_text,
          is_standard: a.is_standard,
          source_document: 'Engagement Letter Import',
        }))
      );
      setShowAssumptionsPreview(false);
      setExtractedAssumptions([]);
      setPendingAssumptionsText('');
      setImportText('');
    } catch (error) {
      // Error handled in hook
    }
  };

  const skipAssumptionsImport = () => {
    setShowAssumptionsOffer(false);
    setShowAssumptionsPreview(false);
    setExtractedAssumptions([]);
    setPendingAssumptionsText('');
    setImportText('');
  };

  // Calculate totals (current draft)
  const bmTotal = draftItems
    .filter(item => item.provider === 'Baker McKenzie')
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  const localCounselTotal = draftItems
    .filter(item => item.provider === 'Local Counsel')
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  const overallTotal = bmTotal + localCounselTotal;

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
    setAiSuggestedIndices(new Set()); // Clear AI suggestions after finalizing
    setPastedText('');
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
        provider: item.provider,
        fee_amount: item.fee_amount,
      })));
    }
    setNotes('');
    setPastedText('');
    setAiSuggestedIndices(new Set());
    setOriginalItems([]);
  };

  // AI summarization for budget update rationale - also extracts budget changes
  const handleSummarizeRationale = async () => {
    if (!pastedText.trim()) {
      toast.error('Please paste some text first');
      return;
    }

    setIsSummarizing(true);
    try {
      // Send current line items for context
      const currentLineItems = draftItems.map(item => ({
        work_item: item.work_item,
        provider: item.provider,
        fee_amount: item.fee_amount,
      }));

      const response = await supabase.functions.invoke('summarize-amendment-rationale', {
        body: { 
          text: pastedText,
          currentLineItems,
        },
      });

      if (response.error) throw response.error;
      
      const { summary, line_item_updates } = response.data || {};
      
      if (summary) {
        setNotes(summary);
      }
      
      // Process line item updates from AI
      if (line_item_updates && Array.isArray(line_item_updates) && line_item_updates.length > 0) {
        const newSuggestedIndices = new Set<number>();
        let updatedItems = [...draftItems];
        let updatesCount = 0;
        let newCount = 0;
        
        for (const update of line_item_updates) {
          if (!update.work_item || typeof update.fee_amount !== 'number') continue;
          
          // If AI provided a matched_index and it's not a new item, use that directly
          let targetIndex = -1;
          
          if (!update.is_new && typeof update.matched_index === 'number' && update.matched_index >= 0 && update.matched_index < updatedItems.length) {
            targetIndex = update.matched_index;
          } else if (!update.is_new) {
            // Fallback: fuzzy match by work item name and provider preference
            const normalizedUpdateName = update.work_item.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // First try exact provider + name match
            targetIndex = updatedItems.findIndex(item => {
              const normalizedItemName = item.work_item.toLowerCase().replace(/[^a-z0-9]/g, '');
              const providerMatch = !update.provider || item.provider === update.provider;
              return providerMatch && (
                normalizedItemName.includes(normalizedUpdateName.substring(0, 8)) ||
                normalizedUpdateName.includes(normalizedItemName.substring(0, 8))
              );
            });
            
            // If no match with provider, try without
            if (targetIndex < 0) {
              targetIndex = updatedItems.findIndex(item => {
                const normalizedItemName = item.work_item.toLowerCase().replace(/[^a-z0-9]/g, '');
                return normalizedItemName.includes(normalizedUpdateName.substring(0, 8)) ||
                       normalizedUpdateName.includes(normalizedItemName.substring(0, 8));
              });
            }
          }
          
          if (targetIndex >= 0) {
            // Check if the fee actually changed before marking as AI suggested
            const currentFee = updatedItems[targetIndex].fee_amount || 0;
            const feeChanged = Math.abs(currentFee - update.fee_amount) > 0.01;
            
            if (feeChanged) {
              // Update existing item at the matched index
              updatedItems[targetIndex] = {
                ...updatedItems[targetIndex],
                fee_amount: update.fee_amount,
                provider: update.provider || updatedItems[targetIndex].provider,
              };
              newSuggestedIndices.add(targetIndex);
              updatesCount++;
            }
            // If fee didn't change, skip this item entirely
          } else {
            // Add as new item at the end
            const newIndex = updatedItems.length;
            updatedItems.push({
              work_item: update.work_item,
              provider: update.provider || 'Baker McKenzie',
              fee_amount: update.fee_amount,
            });
            newSuggestedIndices.add(newIndex);
            newCount++;
          }
        }
        
        setDraftItems(updatedItems);
        setAiSuggestedIndices(newSuggestedIndices);
        const message = [
          updatesCount > 0 ? `${updatesCount} update(s)` : '',
          newCount > 0 ? `${newCount} new item(s)` : ''
        ].filter(Boolean).join(' and ');
        toast.success(`AI suggested ${message}. Review highlighted items.`);
      } else if (summary) {
        toast.success('Rationale summarized and added to notes');
      } else {
        throw new Error('No data returned from AI');
      }
      
      setPastedText(''); // Clear the pasted text after successful processing
    } catch (error) {
      console.error('Error summarizing:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Clear AI suggestion highlighting when user manually edits an item
  const handleItemEdit = (index: number, field: keyof DraftLineItem, value: string | number) => {
    updateLineItem(index, field, value);
    // Remove from AI suggested when user edits
    if (aiSuggestedIndices.has(index)) {
      const newIndices = new Set(aiSuggestedIndices);
      newIndices.delete(index);
      setAiSuggestedIndices(newIndices);
    }
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
        {/* Budget Line Items */}
        <div className="space-y-3">
          {/* Header row - different layout when editing vs viewing */}
          {isEditing && hasExistingBudget ? (
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground px-1">
              <div className="col-span-4">Work Item</div>
              <div className="col-span-2">Provider</div>
              <div className="col-span-2 text-right">
                Current
              </div>
              <div className="col-span-3 text-right">
                New ({differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency})
              </div>
              <div className="col-span-1"></div>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground px-1">
              <div className="col-span-5">Work Item</div>
              <div className="col-span-3">Provider</div>
              <div className="col-span-3 text-right">
                Upper End Fee ({differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency})
              </div>
              <div className="col-span-1"></div>
            </div>
          )}

          {/* AI Suggestions Legend */}
          {isEditing && aiSuggestedIndices.size > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-md">
              <Sparkles className="h-3 w-3" />
              <span>
                AI suggested {aiSuggestedIndices.size} update(s) — highlighted in blue. Review and edit as needed.
              </span>
            </div>
          )}

          {isLoadingLineItems && !isEditing ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            draftItems.map((item, index) => {
              const displayAmount = differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                ? (item.fee_amount || 0) * mandatedRate
                : item.fee_amount || 0;
              const showConversion = differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0 && !isEditing && hasExistingBudget;
              const isAiSuggested = aiSuggestedIndices.has(index);
              
              // Get original value for comparison during editing - match by ID, not index
              const originalItem = item.id 
                ? originalItems.find(orig => orig.id === item.id) 
                : undefined; // New items without ID have no original
              const originalFee = originalItem?.fee_amount || 0;
              const originalDisplayFee = isInBillingCurrencyMode ? originalFee * mandatedRate : originalFee;
              const newFee = item.fee_amount || 0;
              const newDisplayFee = isInBillingCurrencyMode ? newFee * mandatedRate : newFee;
              const hasChanged = isEditing && hasExistingBudget && originalItem && Math.abs(newFee - originalFee) > 0.01;
              const isNewItem = isEditing && hasExistingBudget && !item.id; // New items don't have an ID
              
              // Editing mode with comparison columns
              if (isEditing && hasExistingBudget) {
                return (
                  <div key={index} className="space-y-1">
                    <div 
                      className={cn(
                        "grid grid-cols-12 gap-2 items-center rounded-md transition-colors py-1",
                        isAiSuggested && "bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300 dark:ring-blue-700 px-1 -mx-1",
                        isNewItem && !isAiSuggested && "bg-green-50 dark:bg-green-950/30 ring-1 ring-green-300 dark:ring-green-700 px-1 -mx-1"
                      )}
                    >
                      <div className="col-span-4">
                        <Input
                          value={item.work_item}
                          onChange={(e) => handleItemEdit(index, 'work_item', e.target.value)}
                          placeholder="e.g., Due diligence review"
                          className={cn(
                            "text-sm",
                            isAiSuggested && "border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 font-medium",
                            isNewItem && !isAiSuggested && "border-green-400 dark:border-green-600"
                          )}
                        />
                      </div>
                      <div className="col-span-2">
                        <Select
                          value={item.provider}
                          onValueChange={(v) => handleItemEdit(index, 'provider', v)}
                        >
                          <SelectTrigger className={cn(
                            "text-sm",
                            isAiSuggested && "border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300"
                          )}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {providerOptions.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Current (original) value - read only */}
                      <div className="col-span-2 text-right">
                        {originalItem ? (
                          <span className="text-muted-foreground text-sm">
                            {formatCurrency(originalDisplayFee, differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency)}
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 dark:text-green-400 italic">NEW</span>
                        )}
                      </div>
                      {/* New value - editable */}
                      <div className="col-span-3">
                        <Input
                          type="number"
                          value={isInBillingCurrencyMode 
                            ? (Math.round(newDisplayFee) || '') 
                            : (newFee || '')}
                          onChange={(e) => handleItemEdit(index, 'fee_amount', e.target.value)}
                          placeholder="0"
                          className={cn(
                            "text-right text-sm",
                            isAiSuggested && "border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 font-medium",
                            hasChanged && !isAiSuggested && "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 font-medium",
                            isNewItem && !isAiSuggested && "border-green-400 dark:border-green-600"
                          )}
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {draftItems.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeLineItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* LC Firm Name input - shown when provider is Local Counsel */}
                    {item.provider === 'Local Counsel' && (
                      <div className="grid grid-cols-12 gap-2 items-center pl-4">
                        <div className="col-span-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">LC Firm:</span>
                            <Input
                              value={item.lc_firm_name || ''}
                              onChange={(e) => handleItemEdit(index, 'lc_firm_name', e.target.value)}
                              placeholder="e.g., Smith & Partners"
                              className="text-sm h-8"
                              list={`lc-firms-${index}`}
                            />
                            {existingLcFirmNames.length > 0 && (
                              <datalist id={`lc-firms-${index}`}>
                                {existingLcFirmNames.map(name => (
                                  <option key={name} value={name} />
                                ))}
                              </datalist>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              
              // Normal viewing mode (no budget yet or just viewing)
              return (
                <div key={index} className="space-y-1">
                  <div 
                    className={cn(
                      "grid grid-cols-12 gap-2 items-center rounded-md transition-colors",
                      isAiSuggested && isEditing && "bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300 dark:ring-blue-700 p-1 -mx-1"
                    )}
                  >
                    <div className="col-span-5">
                      <Input
                        value={item.work_item}
                        onChange={(e) => handleItemEdit(index, 'work_item', e.target.value)}
                        placeholder="e.g., Due diligence review"
                        disabled={!isEditing && hasExistingBudget}
                        className={cn(
                          isAiSuggested && isEditing && "border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 font-medium"
                        )}
                      />
                    </div>
                    <div className="col-span-3">
                      <Select
                        value={item.provider}
                        onValueChange={(v) => handleItemEdit(index, 'provider', v)}
                        disabled={!isEditing && hasExistingBudget}
                      >
                        <SelectTrigger className={cn(
                          isAiSuggested && isEditing && "border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {providerOptions.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      {!hasExistingBudget ? (
                        <Input
                          type="number"
                          value={isInBillingCurrencyMode 
                            ? (Math.round((item.fee_amount || 0) * mandatedRate) || '') 
                            : (item.fee_amount || '')}
                          onChange={(e) => handleItemEdit(index, 'fee_amount', e.target.value)}
                          placeholder="0"
                          className="text-right"
                        />
                      ) : (
                        <div className="text-right">
                          <div className="font-medium">
                            {formatCurrency(displayAmount, differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency)}
                          </div>
                          {showConversion && (
                            <div className="text-xs text-muted-foreground">
                              (quoted: {formatCurrency(item.fee_amount || 0, quoteCurrency)})
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {!hasExistingBudget && draftItems.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeLineItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* LC Firm Name input - shown when provider is Local Counsel and editing/creating */}
                  {item.provider === 'Local Counsel' && (!hasExistingBudget || isEditing) && (
                    <div className="grid grid-cols-12 gap-2 items-center pl-4">
                      <div className="col-span-5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">LC Firm:</span>
                          <Input
                            value={item.lc_firm_name || ''}
                            onChange={(e) => handleItemEdit(index, 'lc_firm_name', e.target.value)}
                            placeholder="e.g., Smith & Partners"
                            className="text-sm h-8"
                            list={`lc-firms-normal-${index}`}
                          />
                          {existingLcFirmNames.length > 0 && (
                            <datalist id={`lc-firms-normal-${index}`}>
                              {existingLcFirmNames.map(name => (
                                <option key={name} value={name} />
                              ))}
                            </datalist>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* LC Firm Name display - shown when viewing existing budget */}
                  {item.provider === 'Local Counsel' && hasExistingBudget && !isEditing && item.lc_firm_name && (
                    <div className="grid grid-cols-12 gap-2 items-center pl-4">
                      <div className="col-span-5">
                        <span className="text-xs text-muted-foreground">LC Firm: {item.lc_firm_name}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Add Line Item Button and Import Button */}
          {(isEditing || !hasExistingBudget) && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={addLineItem}
                className="flex-1 border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Work Item
              </Button>
              {/* Only show Import from Engagement Letter for the very first budget (no existing versions) */}
              {!hasExistingBudget && (
                <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-dashed"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Import from Engagement Letter
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Import Budget from Engagement Letter</DialogTitle>
                    <DialogDescription>
                      Paste engagement letter text or upload a file. AI will extract work items, providers, and fees as draft items for your review.
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs value={importTab} onValueChange={(v) => setImportTab(v as 'paste' | 'upload')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="paste">Paste Text</TabsTrigger>
                      <TabsTrigger value="upload">Upload File</TabsTrigger>
                    </TabsList>
                    <TabsContent value="paste" className="space-y-4">
                      <Textarea
                        placeholder="Paste the engagement letter or fee arrangement text here..."
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        rows={12}
                        className="font-mono text-sm"
                      />
                    </TabsContent>
                    <TabsContent value="upload" className="space-y-4">
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Upload a PDF, Word document, or text file
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Supported formats: .pdf, .docx, .doc, .txt
                        </p>
                        <input
                          type="file"
                          accept=".txt,.pdf,.doc,.docx,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="engagement-file-upload"
                          disabled={isUploadingFile}
                        />
                        <Button variant="outline" size="sm" asChild disabled={isUploadingFile}>
                          <label htmlFor="engagement-file-upload" className="cursor-pointer">
                            {isUploadingFile ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Extracting text...
                              </>
                            ) : (
                              'Choose File'
                            )}
                          </label>
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => handleImportFromEngagementLetter(importText)}
                      disabled={isImporting || !importText.trim()}
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Parsing...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Import as Draft
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              )}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t pt-4 space-y-2">
          {/* Show header row for Current vs New during editing */}
          {isEditing && hasExistingBudget && originalItems.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground mb-2">
              <div></div>
              <div className="text-right">Current</div>
              <div className="text-right">New</div>
            </div>
          )}
          
          {/* Baker McKenzie Total */}
          <div className={cn(
            "flex justify-between items-end text-sm",
            isEditing && hasExistingBudget && originalItems.length > 0 && "grid grid-cols-3 gap-2"
          )}>
            <span className="text-muted-foreground">Baker McKenzie Total:</span>
            {isEditing && hasExistingBudget && originalItems.length > 0 ? (
              <>
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
                  {Math.abs(bmTotal - originalBmTotal) > 0.01 && (
                    <span className={cn(
                      "ml-1 text-xs",
                      bmTotal > originalBmTotal ? "text-amber-600" : "text-green-600"
                    )}>
                      ({bmTotal > originalBmTotal ? '+' : ''}{formatCurrency(
                        differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                          ? (bmTotal - originalBmTotal) * mandatedRate
                          : bmTotal - originalBmTotal,
                        differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency
                      )})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-right">
                <span className="font-medium">
                  {differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                    ? formatCurrency(bmTotal * mandatedRate, billingCurrency)
                    : formatCurrency(bmTotal, quoteCurrency)}
                </span>
                {differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0 && (
                  <div className="text-xs text-muted-foreground">
                    (quoted: {formatCurrency(bmTotal, quoteCurrency)})
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Local Counsel Total */}
          <div className={cn(
            "flex justify-between items-start text-sm",
            isEditing && hasExistingBudget && originalItems.length > 0 && "grid grid-cols-3 gap-2 items-center"
          )}>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Local Counsel Total:</span>
              {!isEditing && localCounselTotal > 0 && (() => {
                const hasSelection = matter?.local_counsel_billing === 'Disb' || matter?.local_counsel_billing === 'Direct';
                return (
                  <div className="flex items-center gap-2">
                    <label 
                      className={cn(
                        "flex items-center gap-1 cursor-pointer text-xs",
                        hasSelection ? "text-success" : "text-destructive"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={matter?.local_counsel_billing === 'Disb'}
                        onChange={async () => {
                          const newValue = matter?.local_counsel_billing === 'Disb' ? null : 'Disb';
                          await updateLocalCounselBilling(newValue);
                        }}
                        className={cn(
                          "h-3 w-3 rounded-sm border cursor-pointer accent-current",
                          matter?.local_counsel_billing === 'Disb' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                        )}
                      />
                      Disb
                    </label>
                    <label 
                      className={cn(
                        "flex items-center gap-1 cursor-pointer text-xs",
                        hasSelection ? "text-success" : "text-destructive"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={matter?.local_counsel_billing === 'Direct'}
                        onChange={async () => {
                          const newValue = matter?.local_counsel_billing === 'Direct' ? null : 'Direct';
                          await updateLocalCounselBilling(newValue);
                        }}
                        className={cn(
                          "h-3 w-3 rounded-sm border cursor-pointer accent-current",
                          matter?.local_counsel_billing === 'Direct' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                        )}
                      />
                      Direct
                    </label>
                  </div>
                );
              })()}
            </div>
            {isEditing && hasExistingBudget && originalItems.length > 0 ? (
              <>
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
                  {Math.abs(localCounselTotal - originalLcTotal) > 0.01 && (
                    <span className={cn(
                      "ml-1 text-xs",
                      localCounselTotal > originalLcTotal ? "text-amber-600" : "text-green-600"
                    )}>
                      ({localCounselTotal > originalLcTotal ? '+' : ''}{formatCurrency(
                        differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                          ? (localCounselTotal - originalLcTotal) * mandatedRate
                          : localCounselTotal - originalLcTotal,
                        differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency
                      )})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-right">
                <span className="font-medium">
                  {differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                    ? formatCurrency(localCounselTotal * mandatedRate, billingCurrency)
                    : formatCurrency(localCounselTotal, quoteCurrency)}
                </span>
                {differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0 && localCounselTotal > 0 && (
                  <div className="text-xs text-muted-foreground">
                    (quoted: {formatCurrency(localCounselTotal, quoteCurrency)})
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Overall Budget Total */}
          <div className={cn(
            "flex justify-between items-end text-base font-semibold border-t pt-2",
            isEditing && hasExistingBudget && originalItems.length > 0 && "grid grid-cols-3 gap-2"
          )}>
            <span>Overall Budget:</span>
            {isEditing && hasExistingBudget && originalItems.length > 0 ? (
              <>
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
                  {Math.abs(overallTotal - originalOverallTotal) > 0.01 && (
                    <span className={cn(
                      "ml-1 text-sm",
                      overallTotal > originalOverallTotal ? "text-amber-600" : "text-green-600"
                    )}>
                      ({overallTotal > originalOverallTotal ? '+' : ''}{formatCurrency(
                        differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                          ? (overallTotal - originalOverallTotal) * mandatedRate
                          : overallTotal - originalOverallTotal,
                        differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : quoteCurrency
                      )})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-right">
                <span className="text-primary">
                  {differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0
                    ? formatCurrency(overallTotal * mandatedRate, billingCurrency)
                    : formatCurrency(overallTotal, quoteCurrency)}
                </span>
                {differentBillingCurrency && agreedBillingAmount > 0 && originalFeeUpperEnd > 0 && (
                  <div className="text-xs text-muted-foreground font-normal">
                    (quoted: {formatCurrency(overallTotal, quoteCurrency)})
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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

        {/* Notes - shown for both initial and updates */}
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
            
            {/* AI Summarization for budget updates - only show when editing existing budget */}
            {hasExistingBudget && (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  Paste correspondence to auto-generate rationale
                </div>
                <Textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste email exchange or client notes here..."
                  rows={3}
                  className="text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSummarizeRationale}
                  disabled={isSummarizing || !pastedText.trim()}
                  className="w-full"
                >
                  {isSummarizing ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3 w-3" />
                  )}
                  Summarize with AI
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Show current budget notes if viewing (not editing) */}
        {hasExistingBudget && !isEditing && latestVersion?.notes && (
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm text-muted-foreground italic">{latestVersion.notes}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {!hasExistingBudget ? (
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
              Finalize Initial Budget
            </Button>
          ) : isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEditing} className="flex-1">
                Cancel
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
                Update Budget
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEditing} className="flex-1">
              Update Budget
            </Button>
          )}
        </div>

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
                        <span className="ml-1">{formatCurrency(version.bm_total)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">LC:</span>
                        <span className="ml-1">{formatCurrency(version.local_counsel_total)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total:</span>
                        <span className="ml-1 font-medium">{formatCurrency(version.total_amount)}</span>
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
                                  {item.provider === 'Baker McKenzie' ? 'BM' : 'LC'}: {formatCurrency(item.fee_amount)}
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

      {/* Assumptions Import Offer Dialog */}
      <Dialog open={showAssumptionsOffer} onOpenChange={setShowAssumptionsOffer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Assumptions?</DialogTitle>
            <DialogDescription>
              Would you like to also extract and import assumptions from the same engagement letter?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={skipAssumptionsImport}>
              Skip
            </Button>
            <Button onClick={handleExtractAssumptions} disabled={isExtractingAssumptions}>
              {isExtractingAssumptions ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Extracting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Yes, Extract Assumptions
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assumptions Preview Dialog */}
      <Dialog open={showAssumptionsPreview} onOpenChange={(open) => {
        if (!open) skipAssumptionsImport();
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Assumptions</DialogTitle>
            <DialogDescription>
              Select the assumptions you want to import ({selectedAssumptionsCount} of {extractedAssumptions.length} selected)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2 justify-end">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setExtractedAssumptions(prev => prev.map(a => ({ ...a, selected: true })))}
              >
                Select All
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setExtractedAssumptions(prev => prev.map(a => ({ ...a, selected: false })))}
              >
                Deselect All
              </Button>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {extractedAssumptions.map((assumption, index) => (
                <div 
                  key={index}
                  className={`border rounded-lg p-3 space-y-2 cursor-pointer transition-colors ${
                    assumption.selected 
                      ? 'bg-background border-primary/50' 
                      : 'bg-muted/30 border-muted opacity-60'
                  }`}
                  onClick={() => toggleAssumptionSelection(index)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      checked={assumption.selected}
                      onCheckedChange={() => toggleAssumptionSelection(index)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={labelColors[assumption.label] || labelColors['Other']}>
                          {assumption.label}
                        </Badge>
                        {assumption.is_standard && (
                          <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                            Standard
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{assumption.assumption_text}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={skipAssumptionsImport}>
              Skip
            </Button>
            <Button 
              onClick={handleImportSelectedAssumptions}
              disabled={createBulkAssumptions.isPending || selectedAssumptionsCount === 0}
            >
              {createBulkAssumptions.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Importing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Import {selectedAssumptionsCount} Assumption{selectedAssumptionsCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
