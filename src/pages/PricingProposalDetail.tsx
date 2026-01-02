import { useState, useMemo, useRef, useEffect } from "react";
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
import { TableScrollControls } from "@/components/ui/table-scroll-controls";
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
  CheckCircle2,
  TrendingUp,
  Calculator,
  Users,
  Clock,
  Percent,
  DollarSign
} from "lucide-react";
import { 
  usePricingProposal, 
  DraftProposalItem, 
  BUDGET_CATEGORIES,
  RateCard,
  ProposalAssumptions,
  DEFAULT_RATE_CARD,
  DEFAULT_ASSUMPTIONS
} from "@/lib/hooks/usePricingProposals";
import { useMatters } from "@/lib/hooks/useMatters";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { IterativePricingDialog, FeeOwnerHours } from "@/components/pricing/IterativePricingDialog";
import { EditableRateCard } from "@/components/pricing/EditableRateCard";

type PricingMethod = 'ai_suggested' | 'pricing_tool' | 'manual' | 'iterative';
type ItemType = 'documentation' | 'negotiation' | 'due_diligence' | 'meeting';

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
    fetchVersionItems,
    deleteVersion
  } = usePricingProposal(proposalId);
  
  const { matters } = useMatters();

  // Local state for editing work items
  const [draftItems, setDraftItems] = useState<DraftProposalItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isExtractingRfp, setIsExtractingRfp] = useState(false);
  const [isGeneratingAiPricing, setIsGeneratingAiPricing] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isDeletingVersion, setIsDeletingVersion] = useState(false);
  const [isSendToMatterOpen, setIsSendToMatterOpen] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState<string>("");
  const [versionNotes, setVersionNotes] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState("items");

  // Local state for proposal-specific settings
  const [rateCard, setRateCard] = useState<RateCard>(DEFAULT_RATE_CARD);
  const [assumptions, setAssumptions] = useState<ProposalAssumptions>(DEFAULT_ASSUMPTIONS);

  // Iterative pricing dialog state
  const [iterativeDialogOpen, setIterativeDialogOpen] = useState(false);
  const [iterativeDialogIndex, setIterativeDialogIndex] = useState<number | null>(null);

  // Sync local state with proposal data
  useEffect(() => {
    if (proposal) {
      setRateCard(proposal.rate_card || DEFAULT_RATE_CARD);
      setAssumptions(proposal.assumptions || DEFAULT_ASSUMPTIONS);
    }
  }, [proposal]);

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
        partner_hours: item.partner_hours || 0,
        associate_hours: item.associate_hours || 0,
        num_turns: item.num_turns || 1,
        item_type: item.item_type || 'documentation',
      })));
    }
  }, [savedItems]);

  // Calculate work items totals
  const workItemTotals = useMemo(() => {
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

  // Calculate hours with decay for negotiation turns
  const calculateNegotiationHours = (baseHours: number, decay: number, turns: number) => {
    let total = baseHours;
    let currentHours = baseHours;
    for (let i = 1; i < turns; i++) {
      currentHours = currentHours * decay;
      total += currentHours;
    }
    return total;
  };

  // Calculate iterative price for a work item
  const calculateIterativePrice = (item: DraftProposalItem) => {
    const partnerHours = item.partner_hours || 0;
    const associateHours = item.associate_hours || 0;
    const numTurns = item.num_turns || 1;
    const itemType = item.item_type || 'documentation';
    
    // Choose decay factor based on item type
    let decayFactor = 1; // No decay for documentation
    if (itemType === 'negotiation') {
      decayFactor = assumptions.negotiatedDocsDecay;
    } else if (itemType === 'due_diligence') {
      decayFactor = assumptions.ddDecay;
    }
    
    // Calculate total hours with decay
    const totalPartnerHours = calculateNegotiationHours(partnerHours, decayFactor, numTurns);
    const totalAssociateHours = calculateNegotiationHours(associateHours, decayFactor, numTurns);
    
    // Apply AFA discount
    const discountMultiplier = 1 - (assumptions.afaDiscount / 100);
    const partnerRate = rateCard.partner.rate * discountMultiplier;
    const associateRate = rateCard.associate.rate * discountMultiplier;
    
    return Math.round((totalPartnerHours * partnerRate) + (totalAssociateHours * associateRate));
  };

  // Calculate summary from work items
  const summary = useMemo(() => {
    const rates = rateCard;
    const ass = assumptions;
    const discountMultiplier = 1 - (ass.afaDiscount / 100);

    // Sum hours from all Baker McKenzie items
    let totalPartnerHours = 0;
    let totalAssociateHours = 0;
    
    draftItems
      .filter(item => item.provider === 'Baker McKenzie' && (item.is_included !== false || !item.is_optional))
      .forEach(item => {
        const partnerHours = item.partner_hours || 0;
        const associateHours = item.associate_hours || 0;
        const numTurns = item.num_turns || 1;
        const itemType = item.item_type || 'documentation';
        
        let decayFactor = 1;
        if (itemType === 'negotiation') decayFactor = ass.negotiatedDocsDecay;
        else if (itemType === 'due_diligence') decayFactor = ass.ddDecay;
        
        totalPartnerHours += calculateNegotiationHours(partnerHours, decayFactor, numTurns);
        totalAssociateHours += calculateNegotiationHours(associateHours, decayFactor, numTurns);
      });

    // Add meeting hours
    const meetingPartnerHours = ass.numMeetings * ass.meetingHoursPartner;
    const meetingAssociateHours = ass.numMeetings * ass.meetingHoursAssociate;
    totalPartnerHours += meetingPartnerHours;
    totalAssociateHours += meetingAssociateHours;

    // Rates with discount
    const afaPartnerRate = rates.partner.rate * discountMultiplier;
    const afaSeniorAssociateRate = rates.seniorAssociate.rate * discountMultiplier;
    const afaAssociateRate = rates.associate.rate * discountMultiplier;
    const afaTraineeRate = rates.trainee.rate * discountMultiplier;

    // Revenue - for now only using partner and associate 
    const partnerRevenue = totalPartnerHours * afaPartnerRate;
    const associateRevenue = totalAssociateHours * afaAssociateRate;
    const seniorAssociateRevenue = 0;
    const traineeRevenue = 0;
    const totalRevenue = partnerRevenue + associateRevenue;

    // Cost
    const partnerCost = totalPartnerHours * rates.partner.cost;
    const associateCost = totalAssociateHours * rates.associate.cost;
    const seniorAssociateCost = 0;
    const traineeCost = 0;
    const totalCost = partnerCost + associateCost;

    // Margin
    const margin = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

    // Blended rate
    const totalHours = totalPartnerHours + totalAssociateHours;
    const blendedRate = totalHours > 0 ? totalRevenue / totalHours : 0;

    return {
      totalPartnerHours,
      totalSeniorAssociateHours: 0,
      totalAssociateHours,
      totalTraineeHours: 0,
      totalHours,
      afaPartnerRate,
      afaSeniorAssociateRate,
      afaAssociateRate,
      afaTraineeRate,
      partnerRevenue,
      seniorAssociateRevenue,
      associateRevenue,
      traineeRevenue,
      totalRevenue,
      partnerCost,
      seniorAssociateCost,
      associateCost,
      traineeCost,
      totalCost,
      margin,
      marginPercent,
      blendedRate,
    };
  }, [draftItems, rateCard, assumptions]);

  const currencySymbol = proposal?.currency === "GBP" ? "£" : proposal?.currency === "USD" ? "$" : "€";

  const formatCurrency = (value: number) => {
    return `${currencySymbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatHours = (value: number) => {
    return value.toFixed(1);
  };

  // Save proposal settings (rate card, assumptions)
  const saveProposalSettings = async () => {
    await updateProposal.mutateAsync({
      rate_card: rateCard,
      assumptions: assumptions,
    });
    toast({ title: 'Settings saved' });
  };

  // Add new work item
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

  // Update work item
  const updateItem = (index: number, updates: Partial<DraftProposalItem>) => {
    setDraftItems(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
    setHasUnsavedChanges(true);
  };

  // Remove work item
  const removeItem = (index: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  // Open iterative pricing dialog for a work item
  const openIterativePricing = (index: number) => {
    setIterativeDialogIndex(index);
    setIterativeDialogOpen(true);
  };

  // Apply iterative pricing result to work item
  const applyIterativePricing = (result: {
    feeOwnerHours: FeeOwnerHours;
    numTurns: number;
    itemType: string;
    calculatedFee: number;
  }) => {
    if (iterativeDialogIndex === null) return;
    
    updateItem(iterativeDialogIndex, {
      partner_hours: result.feeOwnerHours.partner || 0,
      associate_hours: result.feeOwnerHours.associate || 0,
      num_turns: result.numTurns,
      item_type: result.itemType as 'documentation' | 'negotiation' | 'due_diligence' | 'meeting',
      fee_amount: result.calculatedFee,
      pricing_method: 'iterative',
    });
  };

  // Get current item for iterative dialog
  const currentIterativeItem = iterativeDialogIndex !== null ? draftItems[iterativeDialogIndex] : null;

  // Handle RFP file upload
  const handleRfpUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtractingRfp(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('parse-document-text', {
        body: formData,
      });

      if (error) throw error;

      const documentText = data.text;

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

    worksheetData.push({
      '#': '',
      'Work Item': 'TOTAL',
      'Provider': '',
      'Category': '',
      'Fee Amount': workItemTotals.total,
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
      partner_hours: item.partner_hours || 0,
      associate_hours: item.associate_hours || 0,
      num_turns: item.num_turns || 1,
      item_type: item.item_type || 'documentation',
    })));
    setIsViewingHistory(true);
    setActiveTab('items');
    toast({ title: `Viewing version ${versions.find(v => v.id === versionId)?.version_number || ''}` });
  };

  // Delete version
  const handleDeleteVersion = async (versionId: string) => {
    if (versions.length <= 1) {
      toast({ title: 'Cannot delete the only version', variant: 'destructive' });
      return;
    }
    setIsDeletingVersion(true);
    try {
      await deleteVersion.mutateAsync(versionId);
    } finally {
      setIsDeletingVersion(false);
    }
  };

  // Auto-categorize work items using AI
  const handleAutoCategorize = async () => {
    const itemsToCategorize = draftItems
      .map((item, index) => ({ ...item, index }))
      .filter(item => item.work_item.trim());
    
    if (itemsToCategorize.length === 0) {
      toast({ title: 'No items to categorize' });
      return;
    }

    setIsCategorizing(true);
    try {
      const response = await supabase.functions.invoke('categorize-budget-items', {
        body: { 
          items: itemsToCategorize.map(item => ({
            index: item.index,
            work_item: item.work_item
          }))
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to categorize items');
      }

      const { categorizations } = response.data;
      
      if (!categorizations || categorizations.length === 0) {
        toast({ title: 'No categorizations returned', variant: 'destructive' });
        return;
      }

      // Apply categorizations
      const updatedItems = [...draftItems];
      categorizations.forEach((cat: { index: number; category: string }) => {
        if (updatedItems[cat.index]) {
          updatedItems[cat.index] = { ...updatedItems[cat.index], category: cat.category };
        }
      });
      
      setDraftItems(updatedItems);
      setHasUnsavedChanges(true);
      toast({ title: `Categorized ${categorizations.length} items` });
    } catch (error) {
      console.error('Error categorizing items:', error);
      toast({ title: error instanceof Error ? error.message : 'Failed to categorize items', variant: 'destructive' });
    } finally {
      setIsCategorizing(false);
    }
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
          <Button className="mt-4" onClick={() => navigate('/pricing')}>
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
            <Button variant="ghost" size="icon" onClick={() => navigate('/pricing')}>
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
                        <p className="text-2xl font-bold">{formatCurrency(workItemTotals.total)}</p>
                        <p className="text-sm text-muted-foreground">
                          BM: {formatCurrency(workItemTotals.bmTotal)} • LC: {formatCurrency(workItemTotals.localCounselTotal)}
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

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="items">
              <FileText className="h-4 w-4 mr-2" />
              Work Items
            </TabsTrigger>
            <TabsTrigger value="summary">
              <TrendingUp className="h-4 w-4 mr-2" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="assumptions">
              <Calculator className="h-4 w-4 mr-2" />
              Assumptions
            </TabsTrigger>
            <TabsTrigger value="rates">
              <Users className="h-4 w-4 mr-2" />
              Rate Card
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* WORK ITEMS TAB */}
          <TabsContent value="items" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(workItemTotals.total)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Baker McKenzie</p>
                  <p className="text-2xl font-bold">{formatCurrency(workItemTotals.bmTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Local Counsel</p>
                  <p className="text-2xl font-bold">{formatCurrency(workItemTotals.localCounselTotal)}</p>
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
                <Button 
                  variant="outline" 
                  onClick={handleAutoCategorize}
                  disabled={isCategorizing || draftItems.filter(i => i.work_item.trim()).length === 0}
                >
                  {isCategorizing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Auto-Categorize
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
                <CardTitle className="flex items-center justify-between">
                  <span>Work Items</span>
                  {isViewingHistory && (
                    <Badge variant="outline" className="ml-2">
                      Viewing historical version
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {draftItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No work items yet. Upload an RFP or add items manually.</p>
                  </div>
                ) : (
                  <TableScrollControls>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[30px]"></TableHead>
                            <TableHead className="min-w-[280px]">Work Item</TableHead>
                            <TableHead className="w-[110px]">Category</TableHead>
                            <TableHead className="w-[100px]">Type</TableHead>
                            <TableHead className="w-[120px]">Provider</TableHead>
                            <TableHead className="w-[50px] text-center">Calc</TableHead>
                            <TableHead className="text-right w-[90px]">Fee</TableHead>
                            <TableHead className="w-[70px]">Method</TableHead>
                            <TableHead className="text-center w-[45px]">Opt</TableHead>
                            <TableHead className="text-center w-[45px]">Inc</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {draftItems.map((item, index) => {
                            const calcFee = item.provider === 'Baker McKenzie' ? calculateIterativePrice(item) : 0;
                            return (
                              <TableRow 
                                key={index}
                                className={item.is_optional && !item.is_included ? 'opacity-50' : ''}
                              >
                                <TableCell>
                                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                </TableCell>
                                <TableCell className="align-top py-2">
                                  <Textarea
                                    value={item.work_item}
                                    onChange={(e) => updateItem(index, { work_item: e.target.value })}
                                    className="min-w-[250px] text-sm resize-none"
                                    placeholder="Work item description"
                                    rows={2}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={item.category || ''}
                                    onValueChange={(value) => updateItem(index, { category: value || null })}
                                  >
                                    <SelectTrigger className="w-[120px]">
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
                                    value={item.item_type || 'documentation'}
                                    onValueChange={(value: ItemType) => updateItem(index, { item_type: value })}
                                  >
                                    <SelectTrigger className="w-[120px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="documentation">Documentation</SelectItem>
                                      <SelectItem value="negotiation">Negotiation</SelectItem>
                                      <SelectItem value="due_diligence">Due Diligence</SelectItem>
                                      <SelectItem value="meeting">Meeting</SelectItem>
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
                                    <SelectTrigger className="w-[130px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Baker McKenzie">Baker McKenzie</SelectItem>
                                      <SelectItem value="Local Counsel">Local Counsel</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-center">
                                  {item.provider === 'Baker McKenzie' ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openIterativePricing(index)}
                                      title="Iterative pricing calculator"
                                      className="h-8 w-8"
                                    >
                                      <Calculator className="h-4 w-4 text-primary" />
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={item.fee_amount || ''}
                                    onChange={(e) => updateItem(index, { 
                                      fee_amount: parseFloat(e.target.value) || 0,
                                      pricing_method: 'manual'
                                    })}
                                    className="w-[100px] text-right"
                                    placeholder="0"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={
                                      item.pricing_method === 'ai_suggested' 
                                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                        : item.pricing_method === 'iterative'
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : ''
                                    }
                                  >
                                    {item.pricing_method === 'ai_suggested' ? '✨ AI' : 
                                     item.pricing_method === 'iterative' ? '📊 Iter' : '✏️ Man'}
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
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </TableScrollControls>
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

          {/* SUMMARY TAB */}
          <TabsContent value="summary" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Fee</p>
                      <p className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                      <p className="text-2xl font-bold">{formatHours(summary.totalHours)}</p>
                    </div>
                    <Clock className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Blended Rate</p>
                      <p className="text-2xl font-bold">{formatCurrency(summary.blendedRate)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Fee Breakdown by Grade</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Partner</TableCell>
                      <TableCell className="text-right">{formatHours(summary.totalPartnerHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.afaPartnerRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.partnerRevenue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Senior Associate</TableCell>
                      <TableCell className="text-right">{formatHours(summary.totalSeniorAssociateHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.afaSeniorAssociateRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.seniorAssociateRevenue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Associate</TableCell>
                      <TableCell className="text-right">{formatHours(summary.totalAssociateHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.afaAssociateRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.associateRevenue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Trainee</TableCell>
                      <TableCell className="text-right">{formatHours(summary.totalTraineeHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.afaTraineeRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.traineeRevenue)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatHours(summary.totalHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.blendedRate)} (blended)</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.totalRevenue)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ASSUMPTIONS TAB */}
          <TabsContent value="assumptions" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Pricing Parameters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>AFA Discount (%)</Label>
                    <Input
                      type="number"
                      value={assumptions.afaDiscount}
                      onChange={(e) => setAssumptions(prev => ({ ...prev, afaDiscount: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Number of Negotiation Turns</Label>
                    <Input
                      type="number"
                      value={assumptions.numNegotiationTurns}
                      onChange={(e) => setAssumptions(prev => ({ ...prev, numNegotiationTurns: parseInt(e.target.value) || 1 }))}
                      min={1}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Negotiation Decay Factor</Label>
                    <Input
                      type="number"
                      value={assumptions.negotiatedDocsDecay}
                      onChange={(e) => setAssumptions(prev => ({ ...prev, negotiatedDocsDecay: parseFloat(e.target.value) || 0.5 }))}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <p className="text-xs text-muted-foreground">Each subsequent turn = previous × this factor</p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Due Diligence Decay Factor</Label>
                    <Input
                      type="number"
                      value={assumptions.ddDecay}
                      onChange={(e) => setAssumptions(prev => ({ ...prev, ddDecay: parseFloat(e.target.value) || 0.35 }))}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Meetings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Number of Additional Meetings</Label>
                    <Input
                      type="number"
                      value={assumptions.numMeetings}
                      onChange={(e) => setAssumptions(prev => ({ ...prev, numMeetings: parseInt(e.target.value) || 0 }))}
                      min={0}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Partner Hours per Meeting</Label>
                    <Input
                      type="number"
                      value={assumptions.meetingHoursPartner}
                      onChange={(e) => setAssumptions(prev => ({ ...prev, meetingHoursPartner: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      step={0.5}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Associate Hours per Meeting</Label>
                    <Input
                      type="number"
                      value={assumptions.meetingHoursAssociate}
                      onChange={(e) => setAssumptions(prev => ({ ...prev, meetingHoursAssociate: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      step={0.5}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveProposalSettings} disabled={updateProposal.isPending}>
                {updateProposal.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Assumptions
              </Button>
            </div>
          </TabsContent>

          {/* RATE CARD TAB */}
          <TabsContent value="rates" className="space-y-4">
            <EditableRateCard
              rateCard={rateCard}
              currencySymbol={currencySymbol}
              onSave={async (newRateCard) => {
                setRateCard(newRateCard);
                await updateProposal.mutateAsync({ rate_card: newRateCard });
                toast({ title: 'Rate card saved' });
              }}
              isSaving={updateProposal.isPending}
            />
          </TabsContent>

          {/* HISTORY TAB */}
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
                          <TableCell className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewVersion(version.id)}
                            >
                              View
                            </Button>
                            {versions.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDeleteVersion(version.id)}
                                disabled={isDeletingVersion}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
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

        {/* Iterative Pricing Dialog */}
        <IterativePricingDialog
          open={iterativeDialogOpen}
          onOpenChange={setIterativeDialogOpen}
          workItemName={currentIterativeItem?.work_item || ''}
          rateCard={rateCard}
          assumptions={assumptions}
          currencySymbol={currencySymbol}
          initialHours={{
            partner: currentIterativeItem?.partner_hours || 0,
            associate: currentIterativeItem?.associate_hours || 0,
          }}
          initialTurns={currentIterativeItem?.num_turns || 1}
          initialItemType={currentIterativeItem?.item_type || 'documentation'}
          onApply={applyIterativePricing}
        />
      </div>
    </AppLayout>
  );
}
