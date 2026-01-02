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
  DollarSign,
  HelpCircle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  usePricingProposal, 
  DraftProposalItem, 
  BUDGET_CATEGORIES,
  RateCard,
  ProposalAssumptions,
  DEFAULT_RATE_CARD,
  DEFAULT_ASSUMPTIONS,
  EstimationMethod
} from "@/lib/hooks/usePricingProposals";
import { useMatters } from "@/lib/hooks/useMatters";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currencyUtils";
import { IterativePricingDialog, FeeOwnerHours } from "@/components/pricing/IterativePricingDialog";
import { EditableRateCard } from "@/components/pricing/EditableRateCard";
import { CategorizedProposalView, categoryBgColors, categoryTextColors, categoryBorderColors } from "@/components/pricing/CategorizedProposalView";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableProposalItem } from "@/components/pricing/DraggableProposalItem";

type PricingMethod = 'ai_suggested' | 'pricing_tool' | 'manual';
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
    updateCurrentVersion,
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

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

  // Estimate hours for non-iterative items based on estimation method
  // Pyramid: Partner (fewest) -> Senior Associate -> Associate -> Trainee (most)
  // Partner-heavy: Flat structure with similar hours across grades
  // Junior-heavy: Most hours at trainee/associate level, minimal partner involvement
  const getEstimationDistribution = (method: EstimationMethod) => {
    switch (method) {
      case 'partner-heavy':
        // Flat structure: partner does about the same as others
        return { partner: 0.25, seniorAssoc: 0.25, associate: 0.25, trainee: 0.25 };
      case 'junior-heavy':
        // Partner does little to no hours, most at trainee/junior level
        return { partner: 0.05, seniorAssoc: 0.10, associate: 0.40, trainee: 0.45 };
      case 'pyramid':
      default:
        // Standard pyramid: Partner (fewest) -> Trainee (most)
        return { partner: 0.10, seniorAssoc: 0.20, associate: 0.35, trainee: 0.35 };
    }
  };

  const estimateHoursFromFee = (feeAmount: number, discountMultiplier: number) => {
    const dist = getEstimationDistribution(assumptions.estimationMethod || 'pyramid');
    
    // Discounted rates
    const partnerRate = rateCard.partner.rate * discountMultiplier;
    const seniorAssocRate = rateCard.seniorAssociate.rate * discountMultiplier;
    const associateRate = rateCard.associate.rate * discountMultiplier;
    const traineeRate = rateCard.trainee.rate * discountMultiplier;
    
    // Weighted average rate based on distribution
    const blendedRateFromDist = 
      (dist.partner * partnerRate) + 
      (dist.seniorAssoc * seniorAssocRate) + 
      (dist.associate * associateRate) + 
      (dist.trainee * traineeRate);
    
    // Total estimated hours
    const totalEstimatedHours = blendedRateFromDist > 0 ? feeAmount / blendedRateFromDist : 0;
    
    return {
      partnerHours: totalEstimatedHours * dist.partner,
      seniorAssociateHours: totalEstimatedHours * dist.seniorAssoc,
      associateHours: totalEstimatedHours * dist.associate,
      traineeHours: totalEstimatedHours * dist.trainee,
    };
  };

  const summary = useMemo(() => {
    const rates = rateCard;
    const ass = assumptions;
    const discountMultiplier = 1 - (ass.afaDiscount / 100);

    // Sum hours from all Baker McKenzie items
    let totalPartnerHours = 0;
    let totalSeniorAssociateHours = 0;
    let totalAssociateHours = 0;
    let totalTraineeHours = 0;
    
    draftItems
      .filter(item => item.provider === 'Baker McKenzie' && (item.is_included !== false || !item.is_optional))
      .forEach(item => {
        const isIterative = item.pricing_method === 'pricing_tool';
        
        if (isIterative) {
          // Use actual hours data from iterative pricing
          const partnerHours = item.partner_hours || 0;
          const associateHours = item.associate_hours || 0;
          const numTurns = item.num_turns || 1;
          const itemType = item.item_type || 'documentation';
          
          let decayFactor = 1;
          if (itemType === 'negotiation') decayFactor = ass.negotiatedDocsDecay;
          else if (itemType === 'due_diligence') decayFactor = ass.ddDecay;
          
          totalPartnerHours += calculateNegotiationHours(partnerHours, decayFactor, numTurns);
          totalAssociateHours += calculateNegotiationHours(associateHours, decayFactor, numTurns);
        } else {
          // Estimate hours using pyramid structure for manual/AI items
          const feeAmount = item.fee_amount || 0;
          if (feeAmount > 0) {
            const estimated = estimateHoursFromFee(feeAmount, discountMultiplier);
            totalPartnerHours += estimated.partnerHours;
            totalSeniorAssociateHours += estimated.seniorAssociateHours;
            totalAssociateHours += estimated.associateHours;
            totalTraineeHours += estimated.traineeHours;
          }
        }
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

    // Revenue by grade
    const partnerRevenue = totalPartnerHours * afaPartnerRate;
    const seniorAssociateRevenue = totalSeniorAssociateHours * afaSeniorAssociateRate;
    const associateRevenue = totalAssociateHours * afaAssociateRate;
    const traineeRevenue = totalTraineeHours * afaTraineeRate;
    const totalRevenue = partnerRevenue + seniorAssociateRevenue + associateRevenue + traineeRevenue;

    // Cost by grade
    const partnerCost = totalPartnerHours * rates.partner.cost;
    const seniorAssociateCost = totalSeniorAssociateHours * rates.seniorAssociate.cost;
    const associateCost = totalAssociateHours * rates.associate.cost;
    const traineeCost = totalTraineeHours * rates.trainee.cost;
    const totalCost = partnerCost + seniorAssociateCost + associateCost + traineeCost;

    // Margin
    const margin = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

    // Blended rate
    const totalHours = totalPartnerHours + totalSeniorAssociateHours + totalAssociateHours + totalTraineeHours;
    const blendedRate = totalHours > 0 ? totalRevenue / totalHours : 0;

    return {
      totalPartnerHours,
      totalSeniorAssociateHours,
      totalAssociateHours,
      totalTraineeHours,
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
    setDraftItems(prev => {
      const updatedItems = prev.map((item, i) => 
        i === index ? { ...item, ...updates } : item
      );
      
      // If category changed, auto-sort to group with same category items
      if ('category' in updates && updates.category) {
        const categoryOrder = Object.fromEntries(
          BUDGET_CATEGORIES.map((cat, idx) => [cat, idx])
        );
        
        updatedItems.sort((a, b) => {
          const catA = a.category || '';
          const catB = b.category || '';
          
          // Uncategorized items go to the end
          if (!catA && catB) return 1;
          if (catA && !catB) return -1;
          if (!catA && !catB) return 0;
          
          // Sort by category order
          const orderA = categoryOrder[catA] ?? 999;
          const orderB = categoryOrder[catB] ?? 999;
          return orderA - orderB;
        });
      }
      
      return updatedItems;
    });
    setHasUnsavedChanges(true);
  };

  // Remove work item
  const removeItem = (index: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  // Handle drag end for reordering items
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = parseInt(active.id as string);
    const newIndex = parseInt(over.id as string);

    setDraftItems(prev => arrayMove(prev, oldIndex, newIndex));
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
      pricing_method: 'pricing_tool',
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
            // Match by checking if the AI response work_item contains or starts with the original work_item
            const priceInfo = data.prices.find((p: any) => 
              p.work_item === item.work_item || 
              p.work_item?.startsWith(item.work_item) ||
              item.work_item?.startsWith(p.work_item)
            );
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

  // Sanitize items before saving - map 'iterative' to 'pricing_tool' for DB constraint
  const sanitizeItemsForSave = (items: typeof draftItems) => {
    return items.map(item => ({
      ...item,
      pricing_method: item.pricing_method === 'iterative' as any ? 'pricing_tool' : item.pricing_method,
    }));
  };

  // Save as current version (overwrites)
  const handleSaveCurrentVersion = async () => {
    await updateCurrentVersion.mutateAsync({
      items: sanitizeItemsForSave(draftItems),
      notes: versionNotes,
    });
    setHasUnsavedChanges(false);
    setVersionNotes("");
  };

  // Save as new version
  const handleSaveNewVersion = async () => {
    await saveVersion.mutateAsync({
      items: sanitizeItemsForSave(draftItems),
      notes: versionNotes,
    });
    setHasUnsavedChanges(false);
    setVersionNotes("");
  };

  // Export to Excel with nice formatting
  const exportToExcel = async () => {
    const currencySymbol = getCurrencySymbol(proposal?.currency || 'GBP');
    
    // Category order for sorting
    const categoryOrder: Record<string, number> = {
      'Pre-signing': 1,
      'Signing': 2,
      'Completion': 3,
      'Post-completion': 4,
      'Project management': 5,
      '': 6 // Uncategorized last
    };
    
    // Filter included items and sort by category
    const sortedItems = [...draftItems]
      .filter(item => item.is_included || !item.is_optional)
      .sort((a, b) => {
        const orderA = categoryOrder[a.category || ''] ?? 99;
        const orderB = categoryOrder[b.category || ''] ?? 99;
        return orderA - orderB;
      });
    
    // Group by category and calculate subtotals
    const categorizedData: { category: string; items: typeof sortedItems; subtotal: number }[] = [];
    let currentCategory = '';
    let currentItems: typeof sortedItems = [];
    let currentSubtotal = 0;
    
    sortedItems.forEach(item => {
      const cat = item.category || 'Other';
      if (cat !== currentCategory && currentItems.length > 0) {
        categorizedData.push({ category: currentCategory, items: currentItems, subtotal: currentSubtotal });
        currentItems = [];
        currentSubtotal = 0;
      }
      currentCategory = cat;
      currentItems.push(item);
      currentSubtotal += item.fee_amount;
    });
    if (currentItems.length > 0) {
      categorizedData.push({ category: currentCategory, items: currentItems, subtotal: currentSubtotal });
    }
    
    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pricing Proposal');
    
    // Set column widths
    worksheet.columns = [
      { key: 'category', width: 22 },
      { key: 'workItem', width: 55 },
      { key: 'provider', width: 20 },
      { key: 'estimate', width: 18 },
    ];
    
    // Title row with client name and proposal name
    const clientName = proposal?.client?.name || 'Client';
    const proposalName = proposal?.name || 'Pricing Proposal';
    const titleRow = worksheet.addRow([`${clientName} - ${proposalName}`, '', '', '']);
    titleRow.font = { bold: true, size: 16 };
    titleRow.height = 28;
    worksheet.mergeCells('A1:D1');
    
    // Empty row
    worksheet.addRow(['', '', '', '']);
    
    // Header row
    const headerRow = worksheet.addRow(['Category', 'Work Item', 'Provider', 'Estimate']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1a365d' } // Dark blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.height = 24;
    // Align Estimate header to right
    headerRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    headerRow.eachCell(cell => {
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF1a365d' } }
      };
    });
    
    let grandTotal = 0;
    let rowIndex = 0;
    
    // Colors for alternating rows
    const lightGray = { argb: 'FFF7FAFC' };
    const white = { argb: 'FFFFFFFF' };
    const subtotalBg = { argb: 'FFEDF2F7' };
    const totalBg = { argb: 'FF2D3748' };
    
    categorizedData.forEach(({ category, items, subtotal }) => {
      items.forEach((item, idx) => {
        const row = worksheet.addRow([
          idx === 0 ? category : '',
          item.work_item,
          item.provider,
          item.fee_amount
        ]);
        
        // Alternating row colors
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: rowIndex % 2 === 0 ? white : lightGray
        };
        row.alignment = { vertical: 'middle' };
        
        // Format currency
        row.getCell(4).numFmt = `"${currencySymbol}"#,##0`;
        row.getCell(4).alignment = { horizontal: 'right' };
        
        // Bold category name
        if (idx === 0) {
          row.getCell(1).font = { bold: true };
        }
        
        rowIndex++;
      });
      
      // Subtotal row
      const subtotalRow = worksheet.addRow(['', `${category} Subtotal`, '', subtotal]);
      subtotalRow.font = { bold: true };
      subtotalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: subtotalBg
      };
      subtotalRow.getCell(4).numFmt = `"${currencySymbol}"#,##0`;
      subtotalRow.getCell(4).alignment = { horizontal: 'right' };
      subtotalRow.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E0' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E0' } }
        };
      });
      
      grandTotal += subtotal;
      
      // Empty row between categories
      worksheet.addRow(['', '', '', '']);
      rowIndex = 0; // Reset for next category
    });
    
    // Grand total row
    const totalRow = worksheet.addRow(['', 'TOTAL ESTIMATE', '', grandTotal]);
    totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: totalBg
    };
    totalRow.height = 26;
    totalRow.getCell(4).numFmt = `"${currencySymbol}"#,##0`;
    totalRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.eachCell(cell => {
      cell.alignment = { vertical: 'middle' };
    });
    
    // Generate and download file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `${proposal?.name || 'Proposal'}_Pricing_V${proposal?.current_version || 1}.xlsx`;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
    
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
    setHasUnsavedChanges(false);
    setActiveTab('items');
    const viewedVersion = versions.find(v => v.id === versionId);
    toast({ title: `Viewing version ${viewedVersion?.version_number || ''}` });
  };

  // Return to current/latest version
  const handleReturnToCurrentVersion = async () => {
    if (!latestVersion) return;
    const currentItems = await fetchVersionItems(latestVersion.id);
    setDraftItems(currentItems.map(item => ({
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
    setSelectedVersionId(null);
    setIsViewingHistory(false);
    setHasUnsavedChanges(false);
    toast({ title: 'Returned to current version' });
  };

  // Check if viewing a historical (non-current) version
  const viewingHistoricalVersion = isViewingHistory && selectedVersionId && 
    versions.find(v => v.id === selectedVersionId)?.version_number !== proposal?.current_version;

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
      <div className="space-y-6 pb-20">
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
                <Badge variant="outline">
                  V{viewingHistoricalVersion && selectedVersionId 
                    ? versions.find(v => v.id === selectedVersionId)?.version_number || proposal.current_version
                    : proposal.current_version}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {proposal.client?.name} • {proposal.currency}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {viewingHistoricalVersion ? (
              <Button onClick={handleReturnToCurrentVersion} variant="default">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Current Version
              </Button>
            ) : (
              <>
                {hasUnsavedChanges && (
                  <Badge variant="destructive">Unsaved changes</Badge>
                )}
                <Button variant="outline" onClick={exportToExcel}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                {proposal.status === 'Draft' && (
                  <>
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
              </>
            )}
          </div>
        </div>

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="assumptions">
              <Calculator className="h-4 w-4 mr-2" />
              Assumptions
            </TabsTrigger>
            <TabsTrigger value="items">
              <FileText className="h-4 w-4 mr-2" />
              Work Items
            </TabsTrigger>
            <TabsTrigger value="summary">
              <TrendingUp className="h-4 w-4 mr-2" />
              Summary
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
            {/* Historical Version Banner */}
            {viewingHistoricalVersion && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Viewing Version {versions.find(v => v.id === selectedVersionId)?.version_number}
                    </p>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      This is a historical version (read-only). Current version is V{proposal.current_version}.
                    </p>
                  </div>
                </div>
                <Button onClick={handleReturnToCurrentVersion} variant="outline" className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to Current Version
                </Button>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Total Fee</p>
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

            {/* Action Buttons - hide when viewing historical version */}
            {!viewingHistoricalVersion && (
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
            )}

            {/* Category Summary with Auto-Categorize */}
            {draftItems.length > 0 && !viewingHistoricalVersion && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <CategorizedProposalView
                    items={draftItems}
                    onItemsChange={(updatedItems) => {
                      setDraftItems(updatedItems);
                      setHasUnsavedChanges(true);
                    }}
                    formatCurrency={formatCurrency}
                    currencySymbol={currencySymbol}
                  />
                </CardContent>
              </Card>
            )}

            {/* Work Items Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Work Items</span>
                  {viewingHistoricalVersion && (
                    <Badge variant="secondary" className="ml-2">
                      Read-only (historical)
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <TableScrollControls>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[30px]"></TableHead>
                              <TableHead className="w-[40px]"></TableHead>
                              <TableHead className="min-w-[280px]">Work Item</TableHead>
                              <TableHead className="w-[110px]">Category</TableHead>
                              <TableHead className="w-[120px]">Provider</TableHead>
                              <TableHead className="w-[50px] text-center">Calc</TableHead>
                              <TableHead className="text-right w-[90px]">Fee</TableHead>
                              <TableHead className="w-[70px]">Method</TableHead>
                              <TableHead className="text-center w-[45px]">Opt</TableHead>
                              <TableHead className="text-center w-[45px]">Inc</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <SortableContext
                              items={draftItems.map((_, index) => index.toString())}
                              strategy={verticalListSortingStrategy}
                            >
                              {draftItems.map((item, index) => (
                                <DraggableProposalItem
                                  key={index}
                                  id={index.toString()}
                                  item={item}
                                  index={index}
                                  onUpdate={updateItem}
                                  onRemove={removeItem}
                                  onOpenIterativePricing={openIterativePricing}
                                  formatCurrency={formatCurrency}
                                  viewingHistoricalVersion={viewingHistoricalVersion}
                                />
                              ))}
                            </SortableContext>
                          </TableBody>
                        </Table>
                      </div>
                    </TableScrollControls>
                  </DndContext>
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
                      disabled={viewingHistoricalVersion}
                    />
                  </div>
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
                      <p className="text-2xl font-bold">{formatCurrency(workItemTotals.total)}</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Pricing Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-2 max-w-md">
                  <Label>Fee Currency</Label>
                  <Select
                    value={proposal?.currency || 'GBP'}
                    onValueChange={(value) => updateProposal.mutate({ currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2 max-w-md">
                  <Label>AFA Discount (%)</Label>
                  <Input
                    type="number"
                    value={assumptions.afaDiscount}
                    onChange={(e) => setAssumptions(prev => ({ ...prev, afaDiscount: parseFloat(e.target.value) || 0 }))}
                    min={0}
                    max={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    Discount applied to standard billing rates for alternative fee arrangements
                  </p>
                </div>

                <div className="grid gap-2 max-w-md">
                  <div className="flex items-center gap-2">
                    <Label>Hours Estimation Method</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">
                            When work items are priced manually or by AI (rather than iteratively), 
                            this determines how hours are estimated across fee earner grades for 
                            summary calculations and blended rate.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={assumptions.estimationMethod || 'pyramid'}
                    onValueChange={(value: EstimationMethod) => setAssumptions(prev => ({ ...prev, estimationMethod: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select estimation method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pyramid">
                        <div className="flex flex-col items-start">
                          <span>Pyramid</span>
                          <span className="text-xs text-muted-foreground">Partner least hours, trainee most</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="partner-heavy">
                        <div className="flex flex-col items-start">
                          <span>Partner-heavy</span>
                          <span className="text-xs text-muted-foreground">Flat structure, similar hours across grades</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="junior-heavy">
                        <div className="flex flex-col items-start">
                          <span>Junior-heavy</span>
                          <span className="text-xs text-muted-foreground">Minimal partner, most hours at junior level</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

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
                  View and compare previous versions of this proposal. Current version is V{proposal.current_version}.
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
                        <TableHead>Status</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>BM Total</TableHead>
                        <TableHead>LC Total</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {versions.map((version) => {
                        const isCurrent = version.version_number === proposal.current_version;
                        const isViewing = selectedVersionId === version.id;
                        
                        return (
                          <TableRow 
                            key={version.id} 
                            className={cn(
                              isViewing && "bg-muted/50",
                              isCurrent && "border-l-4 border-l-primary"
                            )}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant={isCurrent ? 'default' : 'outline'}>
                                  V{version.version_number}
                                </Badge>
                                {isViewing && (
                                  <Badge variant="secondary" className="text-xs">
                                    Viewing
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {isCurrent ? (
                                <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                                  Current
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">Historical</span>
                              )}
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
                              {isCurrent ? (
                                isViewingHistory ? (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleReturnToCurrentVersion}
                                  >
                                    Return to Current
                                  </Button>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Editing</span>
                                )
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewVersion(version.id)}
                                >
                                  View
                                </Button>
                              )}
                              {versions.length > 1 && !isCurrent && (
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
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Bottom Save Bar */}
        {proposal.status === 'Draft' && !viewingHistoricalVersion && (
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex items-center justify-end gap-3 py-3 px-6">
              {hasUnsavedChanges && (
                <span className="text-sm text-muted-foreground mr-auto">
                  You have unsaved changes
                </span>
              )}
              <Button 
                variant="outline" 
                onClick={handleSaveCurrentVersion}
                disabled={!hasUnsavedChanges || updateCurrentVersion.isPending || saveVersion.isPending}
              >
                {updateCurrentVersion.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save as Current Version
              </Button>
              <Button 
                onClick={handleSaveNewVersion}
                disabled={!hasUnsavedChanges || updateCurrentVersion.isPending || saveVersion.isPending}
              >
                {saveVersion.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save as New Version (V{(proposal.current_version || 0) + 1})
              </Button>
            </div>
          </div>
        )}

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
