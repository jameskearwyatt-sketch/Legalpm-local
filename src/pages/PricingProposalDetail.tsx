import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  Save, 
  FileDown, 
  Send, 
  Plus, 
  Trash2, 
  Sparkles, 
  Upload, 
  History,
  FileText,
  Wand2,
  GripVertical,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { usePricingProposal, DraftProposalItem, BUDGET_CATEGORIES } from "@/lib/hooks/usePricingProposals";
import { useMatters } from "@/lib/hooks/useMatters";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

type PricingMethod = 'ai_suggested' | 'pricing_tool' | 'manual';

export default function PricingProposalDetail() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    proposal, 
    versions, 
    latestVersion,
    items: savedItems, 
    isLoading,
    updateProposal,
    saveVersion,
    markAsAgreed,
    fetchVersionItems 
  } = usePricingProposal(proposalId);
  
  const { matters } = useMatters();

  // Local state for editing
  const [draftItems, setDraftItems] = useState<DraftProposalItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isExtractingRfp, setIsExtractingRfp] = useState(false);
  const [isGeneratingAiPricing, setIsGeneratingAiPricing] = useState(false);
  const [isSendToMatterOpen, setIsSendToMatterOpen] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState<string>("");
  const [versionNotes, setVersionNotes] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isViewingHistory, setIsViewingHistory] = useState(false);

  // Initialize draft items from saved items
  useMemo(() => {
    if (savedItems.length > 0 && draftItems.length === 0 && !hasUnsavedChanges) {
      setDraftItems(savedItems.map(item => ({
        id: item.id,
        work_item: item.work_item,
        provider: item.provider,
        fee_amount: item.fee_amount,
        pricing_method: item.pricing_method,
        category: item.category,
        lc_firm_name: item.lc_firm_name || undefined,
        is_optional: item.is_optional,
        is_included: item.is_included,
        ai_rationale: item.ai_rationale,
      })));
    }
  }, [savedItems]);

  // Calculate totals
  const totals = useMemo(() => {
    const includedItems = draftItems.filter(item => 
      !item.is_optional || (item.is_optional && item.is_included !== false)
    );
    const bmTotal = includedItems
      .filter(item => item.provider === 'Baker McKenzie')
      .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
    const localCounselTotal = includedItems
      .filter(item => item.provider === 'Local Counsel')
      .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
    return {
      bmTotal,
      localCounselTotal,
      total: bmTotal + localCounselTotal,
    };
  }, [draftItems]);

  const currencySymbol = proposal?.currency === "GBP" ? "£" : proposal?.currency === "USD" ? "$" : "€";

  const formatCurrency = (value: number) => {
    return `${currencySymbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Add new item
  const addItem = () => {
    setDraftItems(prev => [...prev, {
      work_item: "",
      provider: "Baker McKenzie",
      fee_amount: 0,
      pricing_method: "manual",
      category: null,
      is_optional: false,
      is_included: true,
    }]);
    setHasUnsavedChanges(true);
  };

  // Update item
  const updateItem = (index: number, updates: Partial<DraftProposalItem>) => {
    setDraftItems(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
    setHasUnsavedChanges(true);
  };

  // Remove item
  const removeItem = (index: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  // Handle RFP file upload
  const handleRfpUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtractingRfp(true);

    try {
      // Read file content
      const formData = new FormData();
      formData.append('file', file);

      // Use parse-document-text edge function
      const { data, error } = await supabase.functions.invoke('parse-document-text', {
        body: formData,
      });

      if (error) throw error;

      const documentText = data.text;

      // Now use parse-engagement-letter to extract work items
      const { data: extractedData, error: extractError } = await supabase.functions.invoke('parse-engagement-letter', {
        body: { 
          text: documentText,
          currency: proposal?.currency || 'GBP'
        },
      });

      if (extractError) throw extractError;

      if (extractedData.items && extractedData.items.length > 0) {
        const newItems: DraftProposalItem[] = extractedData.items.map((item: any) => ({
          work_item: item.work_item,
          provider: item.provider === 'Local Counsel' ? 'Local Counsel' : 'Baker McKenzie',
          fee_amount: item.fee_amount || 0,
          pricing_method: 'ai_suggested' as PricingMethod,
          category: item.category || null,
          lc_firm_name: item.lc_firm_name,
          is_optional: false,
          is_included: true,
          ai_rationale: 'Extracted from RFP document',
        }));

        setDraftItems(prev => [...prev, ...newItems]);
        setHasUnsavedChanges(true);
        toast({ title: `Extracted ${newItems.length} work items from RFP` });
      } else {
        toast({ title: 'No work items found in document', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('RFP extraction error:', error);
      toast({ title: 'Failed to extract work items', description: error.message, variant: 'destructive' });
    } finally {
      setIsExtractingRfp(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Generate AI suggestions for additional work items
  const generateAiSuggestions = async () => {
    setIsGeneratingAiPricing(true);
    try {
      const existingItems = draftItems.map(i => i.work_item).join('\n');
      
      const { data, error } = await supabase.functions.invoke('suggest-work-items', {
        body: {
          existing_items: existingItems,
          proposal_name: proposal?.name,
          client_name: proposal?.client?.name,
        },
      });

      if (error) throw error;

      if (data.suggestions && data.suggestions.length > 0) {
        const newItems: DraftProposalItem[] = data.suggestions.map((item: any) => ({
          work_item: item.work_item,
          provider: item.provider === 'Local Counsel' ? 'Local Counsel' : 'Baker McKenzie',
          fee_amount: item.fee_amount || 0,
          pricing_method: 'ai_suggested' as PricingMethod,
          category: item.category || null,
          is_optional: true,
          is_included: false,
          ai_rationale: item.rationale || 'AI suggested additional work item',
        }));

        setDraftItems(prev => [...prev, ...newItems]);
        setHasUnsavedChanges(true);
        toast({ title: `Added ${newItems.length} AI-suggested work items` });
      } else {
        toast({ title: 'No additional suggestions at this time' });
      }
    } catch (error: any) {
      console.error('AI suggestions error:', error);
      toast({ title: 'Failed to generate suggestions', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingAiPricing(false);
    }
  };

  // Generate AI pricing for items without prices
  const generateAiPricing = async () => {
    setIsGeneratingAiPricing(true);
    try {
      const itemsNeedingPricing = draftItems.filter(i => !i.fee_amount || i.fee_amount === 0);
      
      if (itemsNeedingPricing.length === 0) {
        toast({ title: 'All items already have prices' });
        setIsGeneratingAiPricing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('suggest-pricing', {
        body: {
          items: itemsNeedingPricing.map(i => ({
            work_item: i.work_item,
            provider: i.provider,
            category: i.category,
          })),
          currency: proposal?.currency,
        },
      });

      if (error) throw error;

      if (data.prices) {
        setDraftItems(prev => prev.map(item => {
          if (!item.fee_amount || item.fee_amount === 0) {
            const priceInfo = data.prices.find((p: any) => p.work_item === item.work_item);
            if (priceInfo) {
              return {
                ...item,
                fee_amount: priceInfo.fee_amount,
                pricing_method: 'ai_suggested' as PricingMethod,
                ai_rationale: priceInfo.rationale || 'AI suggested pricing',
              };
            }
          }
          return item;
        }));
        setHasUnsavedChanges(true);
        toast({ title: 'AI pricing suggestions applied' });
      }
    } catch (error: any) {
      console.error('AI pricing error:', error);
      toast({ title: 'Failed to generate pricing', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingAiPricing(false);
    }
  };

  // Save version
  const handleSaveVersion = async () => {
    await saveVersion.mutateAsync({
      items: draftItems,
      notes: versionNotes,
    });
    setHasUnsavedChanges(false);
    setVersionNotes("");
  };

  // Export to Excel
  const exportToExcel = () => {
    const worksheetData = draftItems.map((item, index) => ({
      '#': index + 1,
      'Work Item': item.work_item,
      'Provider': item.provider,
      'Category': item.category || '',
      'Fee Amount': item.fee_amount,
      'Pricing Method': item.pricing_method === 'ai_suggested' ? 'AI Suggested' : 
                        item.pricing_method === 'pricing_tool' ? 'Pricing Tool' : 'Manual',
      'Optional': item.is_optional ? 'Yes' : 'No',
      'Included': item.is_included ? 'Yes' : 'No',
    }));

    // Add totals row
    worksheetData.push({
      '#': '',
      'Work Item': 'TOTAL',
      'Provider': '',
      'Category': '',
      'Fee Amount': totals.total,
      'Pricing Method': '',
      'Optional': '',
      'Included': '',
    } as any);

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pricing Proposal");

    const fileName = `${proposal?.name || 'Proposal'}_Pricing_V${proposal?.current_version || 1}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast({ title: 'Exported to Excel', description: fileName });
  };

  // Send to matter
  const handleSendToMatter = async () => {
    if (!selectedMatterId) {
      toast({ title: 'Please select a matter', variant: 'destructive' });
      return;
    }

    await markAsAgreed.mutateAsync({ matterId: selectedMatterId });
    setIsSendToMatterOpen(false);
    toast({ title: 'Proposal sent to matter successfully' });
  };

  // View version history
  const handleViewVersion = async (versionId: string) => {
    setSelectedVersionId(versionId);
    const versionItems = await fetchVersionItems(versionId);
    setDraftItems(versionItems.map(item => ({
      id: item.id,
      work_item: item.work_item,
      provider: item.provider,
      fee_amount: item.fee_amount,
      pricing_method: item.pricing_method,
      category: item.category,
      lc_firm_name: item.lc_firm_name || undefined,
      is_optional: item.is_optional,
      is_included: item.is_included,
      ai_rationale: item.ai_rationale,
    })));
    setIsViewingHistory(true);
  };

  // Client matters for the dropdown
  const clientMatters = matters.filter(m => m.client_id === proposal?.client_id);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!proposal) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Proposal not found</p>
          <Button className="mt-4" onClick={() => navigate('/pricing/proposals')}>
            Back to Proposals
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/pricing/proposals')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{proposal.name}</h1>
                <Badge variant={proposal.status === 'Agreed' ? 'default' : 'secondary'}>
                  {proposal.status}
                </Badge>
                <Badge variant="outline">V{proposal.current_version}</Badge>
              </div>
              <p className="text-muted-foreground">
                {proposal.client?.name} • {proposal.currency}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Badge variant="destructive">Unsaved changes</Badge>
            )}
            <Button variant="outline" onClick={exportToExcel}>
              <FileDown className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            {proposal.status === 'Draft' && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleSaveVersion}
                  disabled={!hasUnsavedChanges || saveVersion.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Version
                </Button>
                <Dialog open={isSendToMatterOpen} onOpenChange={setIsSendToMatterOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Send className="h-4 w-4 mr-2" />
                      Send to Matter
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Send Agreed Proposal to Matter</DialogTitle>
                      <DialogDescription>
                        Mark this proposal as agreed and create the initial budget for the selected matter.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Select Matter</Label>
                        <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a matter..." />
                          </SelectTrigger>
                          <SelectContent>
                            {clientMatters.map(matter => (
                              <SelectItem key={matter.id} value={matter.id}>
                                {matter.matter_name} ({matter.matter_number})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          Only showing matters for {proposal.client?.name}
                        </p>
                      </div>
                      <div className="bg-muted p-4 rounded-lg">
                        <p className="font-medium">Proposal Summary</p>
                        <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
                        <p className="text-sm text-muted-foreground">
                          BM: {formatCurrency(totals.bmTotal)} • LC: {formatCurrency(totals.localCounselTotal)}
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsSendToMatterOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSendToMatter}
                        disabled={!selectedMatterId || markAsAgreed.isPending}
                      >
                        {markAsAgreed.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Confirm & Send
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="items">
              <FileText className="h-4 w-4 mr-2" />
              Work Items
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              Version History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Baker McKenzie</p>
                  <p className="text-2xl font-bold">{formatCurrency(totals.bmTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Local Counsel</p>
                  <p className="text-2xl font-bold">{formatCurrency(totals.localCounselTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Work Items</p>
                  <p className="text-2xl font-bold">{draftItems.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Add Work Items</CardTitle>
                <CardDescription>
                  Upload an RFP, get AI suggestions, or add items manually
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleRfpUpload}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExtractingRfp}
                >
                  {isExtractingRfp ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload RFP
                </Button>
                <Button 
                  variant="outline" 
                  onClick={generateAiSuggestions}
                  disabled={isGeneratingAiPricing}
                >
                  {isGeneratingAiPricing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  AI Suggest Items
                </Button>
                <Button 
                  variant="outline" 
                  onClick={generateAiPricing}
                  disabled={isGeneratingAiPricing}
                >
                  {isGeneratingAiPricing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  AI Price All
                </Button>
                <Button onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </CardContent>
            </Card>

            {/* Work Items Table */}
            <Card>
              <CardHeader>
                <CardTitle>Work Items</CardTitle>
              </CardHeader>
              <CardContent>
                {draftItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No work items yet. Upload an RFP or add items manually.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Work Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead className="text-right">Fee</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-center">Optional</TableHead>
                        <TableHead className="text-center">Include</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftItems.map((item, index) => (
                        <TableRow 
                          key={index}
                          className={item.is_optional && !item.is_included ? 'opacity-50' : ''}
                        >
                          <TableCell>
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.work_item}
                              onChange={(e) => updateItem(index, { work_item: e.target.value })}
                              className="min-w-[200px]"
                              placeholder="Work item description"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.category || ''}
                              onValueChange={(value) => updateItem(index, { category: value || null })}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {BUDGET_CATEGORIES.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.provider}
                              onValueChange={(value: 'Baker McKenzie' | 'Local Counsel') => 
                                updateItem(index, { provider: value })
                              }
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Baker McKenzie">Baker McKenzie</SelectItem>
                                <SelectItem value="Local Counsel">Local Counsel</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.fee_amount || ''}
                              onChange={(e) => updateItem(index, { 
                                fee_amount: parseFloat(e.target.value) || 0,
                                pricing_method: 'manual'
                              })}
                              className="w-[120px] text-right"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                item.pricing_method === 'ai_suggested' 
                                  ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                  : item.pricing_method === 'pricing_tool'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : ''
                              }
                            >
                              {item.pricing_method === 'ai_suggested' ? '✨ AI' : 
                               item.pricing_method === 'pricing_tool' ? '📊 Tool' : '✏️ Manual'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={item.is_optional}
                              onCheckedChange={(checked) => updateItem(index, { 
                                is_optional: !!checked,
                                is_included: checked ? false : true
                              })}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={item.is_included}
                              onCheckedChange={(checked) => updateItem(index, { is_included: checked })}
                              disabled={!item.is_optional}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Save Version Notes */}
            {hasUnsavedChanges && (
              <Card>
                <CardHeader>
                  <CardTitle>Save New Version</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Version Notes (optional)</Label>
                    <Textarea
                      value={versionNotes}
                      onChange={(e) => setVersionNotes(e.target.value)}
                      placeholder="Describe the changes in this version..."
                    />
                  </div>
                  <Button onClick={handleSaveVersion} disabled={saveVersion.isPending}>
                    {saveVersion.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save as V{(proposal.current_version || 0) + 1}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Version History</CardTitle>
                <CardDescription>
                  View and compare previous versions of this proposal
                </CardDescription>
              </CardHeader>
              <CardContent>
                {versions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No versions saved yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>BM Total</TableHead>
                        <TableHead>LC Total</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {versions.map((version) => (
                        <TableRow key={version.id}>
                          <TableCell>
                            <Badge variant={version.version_number === proposal.current_version ? 'default' : 'outline'}>
                              V{version.version_number}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(version.total_amount)}
                          </TableCell>
                          <TableCell>{formatCurrency(version.bm_total)}</TableCell>
                          <TableCell>{formatCurrency(version.local_counsel_total)}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {version.notes || '-'}
                          </TableCell>
                          <TableCell>
                            {new Date(version.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewVersion(version.id)}
                            >
                              View
                            </Button>
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
