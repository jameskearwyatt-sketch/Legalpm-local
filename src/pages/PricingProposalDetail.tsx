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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TableScrollControls } from "@/components/ui/table-scroll-controls";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  HelpCircle,
  RotateCcw,
  Layers,
  AlertCircle,
  Settings2,
  Scale
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  usePricingProposal, 
  DraftProposalItem, 
  ProposalPhase,
  BUDGET_CATEGORIES,
  RateCard,
  ProposalAssumptions,
  DEFAULT_RATE_CARD,
  DEFAULT_ASSUMPTIONS,
  EstimationMethod,
  ExportFigureSettings,
  FigureType,
  SendToMatterFigure,
  areFigureSettingsComplete
} from "@/lib/hooks/usePricingProposals";
import { getItemFeeByFigureType } from "@/lib/afaFilterUtils";
import { useMatters } from "@/lib/hooks/useMatters";
import { useProposalAFAs, AFA_TYPE_LABELS } from "@/lib/hooks/useProposalAFAs";
import { useExchangeRates } from "@/lib/hooks/useExchangeRates";
import { useUserSettings } from "@/lib/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currencyUtils";
import { IterativePricingDialog, FeeOwnerHours } from "@/components/pricing/IterativePricingDialog";
import { EditableRateCard } from "@/components/pricing/EditableRateCard";
import { CategorizedProposalView, categoryBgColors, categoryTextColors, categoryBorderColors } from "@/components/pricing/CategorizedProposalView";
import { PhasedWorkItemsView } from "@/components/pricing/PhasedWorkItemsView";
import { LocalCounselPanel } from "@/components/pricing/LocalCounselPanel";
import { AFATab } from "@/components/pricing/AFATab";
import { ScopeAssumptionsTab, ScopeAssumptionsState, getAssumptionNarratives } from "@/components/pricing/ScopeAssumptionsTab";
import { exportAFAProposalToExcel } from "@/lib/exportAFAProposalToExcel";
import { applyAFAFilters, getAFASummary } from "@/lib/afaFilterUtils";
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
    reactivateProposal,
    fetchVersionItems,
    deleteVersion
  } = usePricingProposal(proposalId);
  
  const { matters } = useMatters();
  const { afas: proposalAFAs } = useProposalAFAs(proposalId);
  const { data: exchangeRatesData } = useExchangeRates();
  const { saveDefaultRateCard } = useUserSettings();

  // Local state for editing work items
  const [draftItems, setDraftItems] = useState<DraftProposalItem[]>([]);
  const [phases, setPhases] = useState<ProposalPhase[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isExtractingRfp, setIsExtractingRfp] = useState(false);
  const [isGeneratingAiPricing, setIsGeneratingAiPricing] = useState(false);
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
  const [isDeletingVersion, setIsDeletingVersion] = useState(false);
  const [isSendToMatterOpen, setIsSendToMatterOpen] = useState(false);
  const [isReactivateDialogOpen, setIsReactivateDialogOpen] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState<string>("");
  const [versionNotes, setVersionNotes] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState("items");
  const [afaDiscountPercent, setAfaDiscountPercent] = useState(0);

  // Local state for proposal-specific settings
  // rateCard stores TEAM RATES (base rates in user's default currency)
  const [rateCard, setRateCard] = useState<RateCard>(DEFAULT_RATE_CARD);
  // feeRateCard stores FEE RATES (rates in proposal's fee currency, used for calculations)
  const [feeRateCard, setFeeRateCard] = useState<RateCard>(DEFAULT_RATE_CARD);
  const [assumptions, setAssumptions] = useState<ProposalAssumptions>(DEFAULT_ASSUMPTIONS);
  const [scopeAssumptions, setScopeAssumptions] = useState<ScopeAssumptionsState | null>(null);

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
      // Load scope assumptions from proposal (now properly typed)
      if (proposal.scope_assumptions) {
        setScopeAssumptions(proposal.scope_assumptions);
      }
      // Load phases from proposal work_phases
      if (proposal.work_phases && Array.isArray(proposal.work_phases)) {
        // Convert legacy WorkPhase format to ProposalPhase if needed
        const loadedPhases: ProposalPhase[] = proposal.work_phases.map((p: any) => ({
          id: p.id || `phase-${Date.now()}-${Math.random()}`,
          name: p.name || 'Unnamed Phase',
          is_included: p.is_included !== false,
        }));
        setPhases(loadedPhases);
      }
    }
  }, [proposal]);

  // Track if we've initialized from saved items to prevent re-initialization
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize draft items from saved items and extract custom categories
  // Only initialize once when savedItems first arrive, not on every re-render
  useEffect(() => {
    if (savedItems.length > 0 && !isInitialized) {
      // Map saved items to draft items - MUST preserve all fields including fee_lower/fee_upper
      setDraftItems(savedItems.map(item => ({
        id: item.id,
        work_item: item.work_item,
        provider: item.provider,
        fee_amount: item.fee_amount,
        fee_lower: item.fee_lower,  // Preserve saved fee range
        fee_upper: item.fee_upper,  // Preserve saved fee range
        pricing_method: item.pricing_method,
        category: item.category,
        phase_id: (item as any).phase_id || null,  // Load phase assignment
        lc_firm_name: item.lc_firm_name || undefined,
        lc_country: item.lc_country || undefined,
        lc_library_id: item.lc_library_id || undefined,
        lc_currency: item.lc_currency || undefined,
        is_optional: item.is_optional,
        is_included: item.is_included ?? true,  // Default to included
        ai_rationale: item.ai_rationale,
        partner_hours: item.partner_hours || 0,
        associate_hours: item.associate_hours || 0,
        num_turns: item.num_turns || 1,
        item_type: item.item_type || 'documentation',
      })));

      // Extract custom categories from saved items
      const extractedCategories = savedItems
        .map(item => item.category)
        .filter((cat): cat is string => 
          cat !== null && 
          cat !== undefined && 
          !(BUDGET_CATEGORIES as readonly string[]).includes(cat)
        );
      const uniqueCustomCategories = [...new Set(extractedCategories)];
      if (uniqueCustomCategories.length > 0) {
        setCustomCategories(uniqueCustomCategories);
      }
      
      setIsInitialized(true);
    }
  }, [savedItems, isInitialized]);

  // Calculate work items totals using the afaBaseFigure setting
  // This ensures AFA calculations use the user-selected baseline (lower/midpoint/upper)
  // Items with is_included === false are excluded from all calculations
  const workItemTotals = useMemo(() => {
    const includedItems = draftItems.filter(item => item.is_included !== false);
    
    // Use the afaBaseFigure setting to determine which fee to use for BM items
    const baseFigure: FigureType = assumptions.afaBaseFigure || 'midpoint';
    
    const bmTotal = includedItems
      .filter(item => item.provider === 'Baker McKenzie')
      .reduce((sum, item) => sum + getItemFeeByFigureType(item, baseFigure), 0);
    
    // Local counsel always uses fee_amount (handled by getItemFeeByFigureType)
    const localCounselTotal = includedItems
      .filter(item => item.provider === 'Local Counsel')
      .reduce((sum, item) => sum + getItemFeeByFigureType(item, baseFigure), 0);
    
    // Also calculate the explicit lower/upper totals for reference
    const lowerTotal = includedItems.reduce((sum, item) => {
      return sum + getItemFeeByFigureType(item, 'lower');
    }, 0);
    const upperTotal = includedItems.reduce((sum, item) => {
      return sum + getItemFeeByFigureType(item, 'upper');
    }, 0);
    
    return {
      bmTotal,
      localCounselTotal,
      total: bmTotal + localCounselTotal,
      lowerTotal,
      upperTotal,
    };
  }, [draftItems, assumptions.afaBaseFigure]);

  const enabledAFAs = useMemo(() => {
    return proposalAFAs.filter(a => a.is_enabled);
  }, [proposalAFAs]);

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
    
    // Use standard rates (no discount applied to baseline - AFA handles discounts separately)
    const partnerRate = rateCard.partner.rate;
    const associateRate = rateCard.associate.rate;
    
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

  // Use feeRateCard (fee currency rates) for consistent back-calculation
  // This ensures hours × fee rates = the original fee amount
  const estimateHoursFromFee = useMemo(() => {
    return (feeAmount: number, discountMultiplier: number) => {
      const dist = getEstimationDistribution(assumptions.estimationMethod || 'pyramid');
      
      // Use FEE RATES (not team rates) to back-calculate hours
      // This ensures: estimated hours × fee rate = original fee amount
      const partnerRate = feeRateCard.partner.rate * discountMultiplier;
      const seniorAssocRate = feeRateCard.seniorAssociate.rate * discountMultiplier;
      const associateRate = feeRateCard.associate.rate * discountMultiplier;
      const traineeRate = feeRateCard.trainee.rate * discountMultiplier;
      
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
  }, [feeRateCard, assumptions.estimationMethod]);

  // State for user-overridden hours (when user manually edits estimated hours in Summary tab)
  const [hourOverrides, setHourOverrides] = useState<{
    partner?: number;
    seniorAssociate?: number;
    associate?: number;
    trainee?: number;
  }>({});

  const summary = useMemo(() => {
    const rates = feeRateCard; // Use fee currency rates for calculations
    const ass = assumptions;

    // Track hours from items with actual hour data (iterative pricing) vs estimated
    let confirmedPartnerHours = 0;
    let confirmedAssociateHours = 0;
    let estimatedPartnerHours = 0;
    let estimatedSeniorAssociateHours = 0;
    let estimatedAssociateHours = 0;
    let estimatedTraineeHours = 0;
    let hasEstimatedHours = false;
    
    draftItems
      .filter(item => item.provider === 'Baker McKenzie' && (item.is_included !== false || !item.is_optional))
      .forEach(item => {
        const isIterative = item.pricing_method === 'pricing_tool';
        
        if (isIterative) {
          // Use actual hours data from iterative pricing - these are CONFIRMED
          const partnerHours = item.partner_hours || 0;
          const associateHours = item.associate_hours || 0;
          const numTurns = item.num_turns || 1;
          const itemType = item.item_type || 'documentation';
          
          let decayFactor = 1;
          if (itemType === 'negotiation') decayFactor = ass.negotiatedDocsDecay;
          else if (itemType === 'due_diligence') decayFactor = ass.ddDecay;
          
          confirmedPartnerHours += calculateNegotiationHours(partnerHours, decayFactor, numTurns);
          confirmedAssociateHours += calculateNegotiationHours(associateHours, decayFactor, numTurns);
        } else {
          // For manual/AI items, we DON'T estimate by default - mark as needing estimation
          const feeAmount = item.fee_amount || 0;
          if (feeAmount > 0) {
            hasEstimatedHours = true;
            const estimated = estimateHoursFromFee(feeAmount, 1);
            estimatedPartnerHours += estimated.partnerHours;
            estimatedSeniorAssociateHours += estimated.seniorAssociateHours;
            estimatedAssociateHours += estimated.associateHours;
            estimatedTraineeHours += estimated.traineeHours;
          }
        }
      });

    // Add meeting hours (these are configured, so considered "confirmed")
    const meetingPartnerHours = ass.numMeetings * ass.meetingHoursPartner;
    const meetingAssociateHours = ass.numMeetings * ass.meetingHoursAssociate;
    confirmedPartnerHours += meetingPartnerHours;
    confirmedAssociateHours += meetingAssociateHours;

    // Apply user overrides if they've manually edited estimated hours
    // If user has overridden a grade, use their value instead of the system estimate
    const finalPartnerHours = confirmedPartnerHours + (hourOverrides.partner !== undefined ? hourOverrides.partner : estimatedPartnerHours);
    const finalSeniorAssociateHours = hourOverrides.seniorAssociate !== undefined ? hourOverrides.seniorAssociate : estimatedSeniorAssociateHours;
    const finalAssociateHours = confirmedAssociateHours + (hourOverrides.associate !== undefined ? hourOverrides.associate : estimatedAssociateHours);
    const finalTraineeHours = hourOverrides.trainee !== undefined ? hourOverrides.trainee : estimatedTraineeHours;

    // Standard rates from user's rate card (NEVER modified automatically)
    const afaPartnerRate = rates.partner.rate;
    const afaSeniorAssociateRate = rates.seniorAssociate.rate;
    const afaAssociateRate = rates.associate.rate;
    const afaTraineeRate = rates.trainee.rate;

    // Revenue by grade
    const partnerRevenue = finalPartnerHours * afaPartnerRate;
    const seniorAssociateRevenue = finalSeniorAssociateHours * afaSeniorAssociateRate;
    const associateRevenue = finalAssociateHours * afaAssociateRate;
    const traineeRevenue = finalTraineeHours * afaTraineeRate;
    const totalRevenue = partnerRevenue + seniorAssociateRevenue + associateRevenue + traineeRevenue;

    // Cost by grade
    const partnerCost = finalPartnerHours * rates.partner.cost;
    const seniorAssociateCost = finalSeniorAssociateHours * rates.seniorAssociate.cost;
    const associateCost = finalAssociateHours * rates.associate.cost;
    const traineeCost = finalTraineeHours * rates.trainee.cost;
    const totalCost = partnerCost + seniorAssociateCost + associateCost + traineeCost;

    // Blended rate
    const totalHours = finalPartnerHours + finalSeniorAssociateHours + finalAssociateHours + finalTraineeHours;
    const blendedRate = totalHours > 0 ? totalRevenue / totalHours : 0;

    return {
      totalPartnerHours: finalPartnerHours,
      totalSeniorAssociateHours: finalSeniorAssociateHours,
      totalAssociateHours: finalAssociateHours,
      totalTraineeHours: finalTraineeHours,
      totalHours,
      // Breakdown of confirmed vs estimated (for display purposes)
      confirmedPartnerHours,
      confirmedAssociateHours,
      estimatedPartnerHours: hourOverrides.partner !== undefined ? hourOverrides.partner : estimatedPartnerHours,
      estimatedSeniorAssociateHours: hourOverrides.seniorAssociate !== undefined ? hourOverrides.seniorAssociate : estimatedSeniorAssociateHours,
      estimatedAssociateHours: hourOverrides.associate !== undefined ? hourOverrides.associate : estimatedAssociateHours,
      estimatedTraineeHours: hourOverrides.trainee !== undefined ? hourOverrides.trainee : estimatedTraineeHours,
      hasEstimatedHours,
      hasUserOverrides: Object.keys(hourOverrides).length > 0,
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
      blendedRate,
    };
  }, [draftItems, feeRateCard, assumptions, hourOverrides]);

  const currencySymbol = getCurrencySymbol(proposal?.currency || 'GBP');
  
  // Get the team rate currency (defaults to fee currency if not set)
  const teamRateCurrency = proposal?.team_rate_currency || proposal?.currency || 'GBP';
  const feeCurrency = proposal?.currency || 'GBP';
  
  // Calculate exchange rate from team currency to fee currency
  // If currencies are the same, rate is 1
  // Otherwise, we need to convert: team rate * exchangeRate = fee rate
  const teamToFeeExchangeRate = useMemo(() => {
    if (teamRateCurrency === feeCurrency) return 1;
    const rates = exchangeRatesData?.rates;
    if (!rates) return 1;
    
    // Rates are expressed as "1 USD = X units of currency"
    // To convert teamCurrency to feeCurrency:
    // If team is GBP and fee is USD: we need (1 USD / 0.79 GBP) = 1.266 USD per GBP
    const teamRate = rates[teamRateCurrency];
    const feeRate = rates[feeCurrency];
    
    if (!teamRate || teamRate === 0 || !feeRate || feeRate === 0) return 1;
    
    // fee_amount = team_amount * (feeRate / teamRate)
    return feeRate / teamRate;
  }, [teamRateCurrency, feeCurrency, exchangeRatesData?.rates]);

  // Derive feeRateCard from rateCard when exchange rate or rateCard changes
  useEffect(() => {
    // Convert team rates to fee rates
    const convertedRateCard: RateCard = {
      partner: { 
        rate: Math.round(rateCard.partner.rate * teamToFeeExchangeRate), 
        cost: rateCard.partner.cost 
      },
      seniorAssociate: { 
        rate: Math.round(rateCard.seniorAssociate.rate * teamToFeeExchangeRate), 
        cost: rateCard.seniorAssociate.cost 
      },
      associate: { 
        rate: Math.round(rateCard.associate.rate * teamToFeeExchangeRate), 
        cost: rateCard.associate.cost 
      },
      trainee: { 
        rate: Math.round(rateCard.trainee.rate * teamToFeeExchangeRate), 
        cost: rateCard.trainee.cost 
      },
    };
    // Also convert any custom earners
    Object.keys(rateCard).forEach(key => {
      if (!['partner', 'seniorAssociate', 'associate', 'trainee'].includes(key)) {
        (convertedRateCard as any)[key] = {
          rate: Math.round((rateCard as any)[key].rate * teamToFeeExchangeRate),
          cost: (rateCard as any)[key].cost || 0,
        };
      }
    });
    setFeeRateCard(convertedRateCard);
  }, [rateCard, teamToFeeExchangeRate]);

  const formatCurrency = (value: number) => {
    return `${currencySymbol}${new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)}`;
  };

  const formatHours = (value: number) => {
    return value.toFixed(1);
  };

  // Save proposal settings (rate card, assumptions, phases)
  const saveProposalSettings = async () => {
    await updateProposal.mutateAsync({
      rate_card: rateCard,
      assumptions: assumptions,
      work_phases: phases as any, // ProposalPhase[] stored in work_phases JSON column
    });
    toast({ title: 'Settings saved' });
  };

  // Add new work item
  const addItem = () => {
    setDraftItems(prev => [...prev, {
      work_item: "",
      provider: "Baker McKenzie",
      fee_amount: 0,
      fee_lower: 0,
      fee_upper: 0,
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
    
    // Apply ±10% spread for iterative pricing (same as AI-generated)
    const feeLower = Math.round(result.calculatedFee * 0.9);
    const feeUpper = Math.round(result.calculatedFee * 1.1);
    
    updateItem(iterativeDialogIndex, {
      partner_hours: result.feeOwnerHours.partner || 0,
      associate_hours: result.feeOwnerHours.associate || 0,
      num_turns: result.numTurns,
      item_type: result.itemType as 'documentation' | 'negotiation' | 'due_diligence' | 'meeting',
      fee_amount: result.calculatedFee,
      fee_lower: feeLower,
      fee_upper: feeUpper,
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
        const newItems: DraftProposalItem[] = extractedData.items.map((item: any) => {
          const feeAmount = item.fee_amount || 0;
          // Apply ±10% spread for AI-extracted items
          const feeLower = Math.round(feeAmount * 0.9);
          const feeUpper = Math.round(feeAmount * 1.1);
          
          return {
            work_item: item.work_item,
            provider: item.provider === 'Local Counsel' ? 'Local Counsel' : 'Baker McKenzie',
            fee_amount: feeAmount,
            fee_lower: feeLower,
            fee_upper: feeUpper,
            pricing_method: 'ai_suggested' as PricingMethod,
            category: item.category || null,
            lc_firm_name: item.lc_firm_name,
            is_optional: false,
            is_included: true,
            ai_rationale: 'Extracted from RFP document',
          };
        });

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

  // Handle paste text submission
  const handlePasteTextSubmit = async () => {
    if (!pastedText.trim()) {
      toast({ title: 'Please enter some text to analyze', variant: 'destructive' });
      return;
    }

    setIsExtractingRfp(true);
    setIsPasteDialogOpen(false);

    try {
      const { data: extractedData, error: extractError } = await supabase.functions.invoke('parse-engagement-letter', {
        body: { 
          text: pastedText,
          currency: proposal?.currency || 'GBP'
        },
      });

      if (extractError) throw extractError;

      if (extractedData.items && extractedData.items.length > 0) {
        const newItems: DraftProposalItem[] = extractedData.items.map((item: any) => {
          const feeAmount = item.fee_amount || 0;
          const feeLower = Math.round(feeAmount * 0.9);
          const feeUpper = Math.round(feeAmount * 1.1);
          
          return {
            work_item: item.work_item,
            provider: item.provider === 'Local Counsel' ? 'Local Counsel' : 'Baker McKenzie',
            fee_amount: feeAmount,
            fee_lower: feeLower,
            fee_upper: feeUpper,
            pricing_method: 'ai_suggested' as PricingMethod,
            category: item.category || null,
            lc_firm_name: item.lc_firm_name,
            is_optional: false,
            is_included: true,
            ai_rationale: 'Extracted from pasted text',
          };
        });

        setDraftItems(prev => [...prev, ...newItems]);
        setHasUnsavedChanges(true);
        toast({ title: `Extracted ${newItems.length} work items from text` });
      } else {
        toast({ title: 'No work items found in text', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('Text extraction error:', error);
      toast({ title: 'Failed to extract work items', description: error.message, variant: 'destructive' });
    } finally {
      setIsExtractingRfp(false);
      setPastedText("");
    }
  };

  // Add custom category
  const addCustomCategory = (categoryName: string) => {
    if (categoryName && !customCategories.includes(categoryName) && !(BUDGET_CATEGORIES as readonly string[]).includes(categoryName)) {
      setCustomCategories(prev => [...prev, categoryName]);
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
        const newItems: DraftProposalItem[] = data.suggestions.map((item: any) => {
          const feeAmount = item.fee_amount || 0;
          // Apply ±10% spread for AI-suggested items
          const feeLower = Math.round(feeAmount * 0.9);
          const feeUpper = Math.round(feeAmount * 1.1);
          
          return {
            work_item: item.work_item,
            provider: item.provider === 'Local Counsel' ? 'Local Counsel' : 'Baker McKenzie',
            fee_amount: feeAmount,
            fee_lower: feeLower,
            fee_upper: feeUpper,
            pricing_method: 'ai_suggested' as PricingMethod,
            category: item.category || null,
            is_optional: true,
            is_included: false,
            ai_rationale: item.rationale || 'AI suggested additional work item',
          };
        });

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
              const feeAmount = priceInfo.fee_amount || 0;
              // Apply ±10% spread for AI-priced items
              const feeLower = Math.round(feeAmount * 0.9);
              const feeUpper = Math.round(feeAmount * 1.1);
              
              return {
                ...item,
                fee_amount: feeAmount,
                fee_lower: feeLower,
                fee_upper: feeUpper,
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

  // Export to Excel with AFA filters applied
  // Check if figure settings are complete
  const figureSettingsComplete = areFigureSettingsComplete(assumptions);

  const exportToExcel = async () => {
    // Validate figure settings are complete
    if (!figureSettingsComplete) {
      toast({ 
        title: 'Figure settings required', 
        description: 'Please complete the Figure Settings in the Assumptions tab before exporting.',
        variant: 'destructive'
      });
      setActiveTab('assumptions');
      return;
    }

    await exportAFAProposalToExcel({
      items: draftItems,
      enabledAFAs,
      proposalName: proposal?.name || 'Pricing Proposal',
      clientName: proposal?.client?.name || 'Client',
      currency: proposal?.currency || 'GBP',
      baselineTotal: workItemTotals.total,
      notes: versionNotes || undefined,
      excelExportFigures: assumptions.excelExportFigures,
      afaBaseFigure: assumptions.afaBaseFigure,
      scopeAssumptionNarratives: getAssumptionNarratives(scopeAssumptions),
    });
    
    toast({ 
      title: 'Exported to Excel', 
      description: enabledAFAs.length > 0 
        ? `AFA-adjusted figures exported with ${enabledAFAs.length} fee arrangement(s) applied`
        : 'Baseline figures exported'
    });
  };

  // Send to matter (uses raw items - AFA info stored in notes)
  const handleSendToMatter = async () => {
    // Validate figure settings are complete
    if (!figureSettingsComplete) {
      toast({ 
        title: 'Figure settings required', 
        description: 'Please complete the Figure Settings in the Assumptions tab before sending to a matter.',
        variant: 'destructive'
      });
      setIsSendToMatterOpen(false);
      setActiveTab('assumptions');
      return;
    }

    if (!selectedMatterId) {
      toast({ title: 'Please select a matter', variant: 'destructive' });
      return;
    }

    await markAsAgreed.mutateAsync({ matterId: selectedMatterId });
    setIsSendToMatterOpen(false);
    toast({ 
      title: 'Proposal sent to matter successfully',
      description: enabledAFAs.length > 0 
        ? `${enabledAFAs.length} AFA(s) applied: ${enabledAFAs.map(a => AFA_TYPE_LABELS[a.afa_type]).join(', ')}`
        : undefined
    });
  };

  // Reactivate an agreed proposal
  const handleReactivate = async () => {
    await reactivateProposal.mutateAsync();
    setIsReactivateDialogOpen(false);
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
      fee_lower: item.fee_lower,  // Preserve fee range
      fee_upper: item.fee_upper,  // Preserve fee range
      pricing_method: item.pricing_method,
      category: item.category,
      lc_firm_name: item.lc_firm_name || undefined,
      lc_country: item.lc_country || undefined,
      lc_library_id: item.lc_library_id || undefined,
      lc_currency: item.lc_currency || undefined,
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
      fee_lower: item.fee_lower,  // Preserve fee range
      fee_upper: item.fee_upper,  // Preserve fee range
      pricing_method: item.pricing_method,
      category: item.category,
      lc_firm_name: item.lc_firm_name || undefined,
      lc_country: item.lc_country || undefined,
      lc_library_id: item.lc_library_id || undefined,
      lc_currency: item.lc_currency || undefined,
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
                {afaDiscountPercent > 0 && (
                  <Badge variant="destructive" className="bg-red-600 text-white">
                    Discounted Rates: {afaDiscountPercent}%
                  </Badge>
                )}
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
                {proposal.status === 'Agreed' && (
                  <Dialog open={isReactivateDialogOpen} onOpenChange={setIsReactivateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reactivate Proposal
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reactivate Proposal</DialogTitle>
                        <DialogDescription>
                          This will set the proposal back to Draft status so you can edit and resend it.
                          {proposal.linked_matter_id && (
                            <span className="block mt-2 text-destructive">
                              The budget imported to the linked matter will be deleted.
                            </span>
                          )}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            <strong>What will happen:</strong>
                          </p>
                          <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside mt-2 space-y-1">
                            <li>Proposal status will change from Agreed to Draft</li>
                            {proposal.linked_matter_id && (
                              <li>The budget version created from this proposal will be removed from the matter</li>
                            )}
                            <li>You'll be able to edit work items and pricing</li>
                            <li>You can send the proposal to a matter again when ready</li>
                          </ul>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReactivateDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive"
                          onClick={handleReactivate}
                          disabled={reactivateProposal.isPending}
                        >
                          {reactivateProposal.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4 mr-2" />
                          )}
                          Reactivate
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}
          </div>
        </div>

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-8 max-w-6xl">
            <TabsTrigger value="parameters">
              <Calculator className="h-4 w-4 mr-2" />
              Parameters
            </TabsTrigger>
            <TabsTrigger value="rates">
              <Users className="h-4 w-4 mr-2" />
              Team & Rates
            </TabsTrigger>
            <TabsTrigger value="scope-assumptions">
              <Scale className="h-4 w-4 mr-2" />
              Assumptions
            </TabsTrigger>
            <TabsTrigger value="items">
              <FileText className="h-4 w-4 mr-2" />
              Work Items
            </TabsTrigger>
            <TabsTrigger value="local-counsel">
              <DollarSign className="h-4 w-4 mr-2" />
              Local Counsel
            </TabsTrigger>
            <TabsTrigger value="afa">
              <Layers className="h-4 w-4 mr-2" />
              AFA
            </TabsTrigger>
            <TabsTrigger value="summary">
              <TrendingUp className="h-4 w-4 mr-2" />
              Summary
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
                  <p className="text-sm font-medium text-muted-foreground">Estimated Range</p>
                  <p className="text-2xl font-bold">{formatCurrency(workItemTotals.lowerTotal)} - {formatCurrency(workItemTotals.upperTotal)}</p>
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
                  <Dialog open={isPasteDialogOpen} onOpenChange={setIsPasteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" disabled={isExtractingRfp}>
                        <FileText className="h-4 w-4 mr-2" />
                        Paste Information
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Paste RFP or Scope Information</DialogTitle>
                        <DialogDescription>
                          Paste text from an RFP, engagement letter, or scope document. The AI will analyze it and extract work items.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Textarea
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                          placeholder="Paste your RFP text, engagement letter, or scope description here..."
                          className="min-h-[300px]"
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPasteDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handlePasteTextSubmit} disabled={!pastedText.trim()}>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Analyze Text
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                    onClick={() => {
                      setDraftItems(prev => prev.map(item => ({
                        ...item,
                        fee_amount: 0,
                        fee_lower: 0,
                        fee_upper: 0,
                        pricing_method: 'manual' as const,
                        ai_rationale: null,
                        partner_hours: 0,
                        associate_hours: 0,
                        num_turns: 1,
                      })));
                      setHasUnsavedChanges(true);
                      toast({ title: 'All pricing cleared' });
                    }}
                    disabled={draftItems.length === 0}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear Pricing
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
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base">Category Breakdown (Midpoint Pricing)</CardTitle>
                    {enabledAFAs.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {enabledAFAs.map(afa => (
                          <Badge 
                            key={afa.id} 
                            variant="secondary" 
                            className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-normal"
                          >
                            {AFA_TYPE_LABELS[afa.afa_type as keyof typeof AFA_TYPE_LABELS] || afa.afa_type}
                            {afa.afa_type === 'discounted_rates' && afa.config && (
                              <span className="ml-1">({(afa.config as any).discountPercent || 0}%)</span>
                            )}
                            {afa.afa_type === 'blended_rate' && afa.config && (
                              <span className="ml-1">({currencySymbol}{(afa.config as any).blendedRatePerHour || 0}/hr)</span>
                            )}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground self-center">applied</span>
                      </div>
                    )}
                  </div>
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
                    customCategories={customCategories}
                  />
                </CardContent>
              </Card>
            )}

            {/* Work Items - Phased View */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Work Items</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-normal text-muted-foreground">
                      {formatCurrency(workItemTotals.lowerTotal)} – {formatCurrency(workItemTotals.upperTotal)}
                    </span>
                    {viewingHistoricalVersion && (
                      <Badge variant="secondary" className="ml-2">
                        Read-only (historical)
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PhasedWorkItemsView
                  items={draftItems}
                  phases={phases}
                  onItemsChange={(newItems) => {
                    setDraftItems(newItems);
                    setHasUnsavedChanges(true);
                  }}
                  onPhasesChange={(newPhases) => {
                    setPhases(newPhases);
                    setHasUnsavedChanges(true);
                  }}
                  onUpdateItem={updateItem}
                  onRemoveItem={removeItem}
                  onOpenIterativePricing={openIterativePricing}
                  formatCurrency={formatCurrency}
                  viewingHistoricalVersion={viewingHistoricalVersion}
                  customCategories={customCategories}
                  onAddCustomCategory={addCustomCategory}
                />
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

          {/* LOCAL COUNSEL TAB */}
          <TabsContent value="local-counsel" className="space-y-4">
            <LocalCounselPanel
              draftItems={draftItems}
              onUpdateItem={updateItem}
              proposalCurrency={proposal?.currency || 'GBP'}
              proposalId={proposalId!}
            />
          </TabsContent>

          {/* AFA TAB - forceMount keeps AFATab mounted so it can react to baseline changes from other tabs */}
          <TabsContent value="afa" className="space-y-4" forceMount>
            <div className="hidden data-[state=active]:block" data-state={activeTab === 'afa' ? 'active' : 'inactive'}>
              <AFATab
                proposalId={proposalId!}
                draftItems={draftItems}
                rateCard={feeRateCard}
                assumptions={assumptions}
                currencySymbol={currencySymbol}
                formatCurrency={formatCurrency}
                baselineTotals={{
                  bmTotal: workItemTotals.bmTotal,
                  localCounselTotal: workItemTotals.localCounselTotal,
                  total: workItemTotals.total,
                  totalHours: summary.totalHours,
                  blendedRate: summary.blendedRate,
                  totalCost: summary.totalCost,
                }}
                customCategories={customCategories}
                onDiscountChange={setAfaDiscountPercent}
              />
            </div>
          </TabsContent>

          {/* SUMMARY TAB */}
          <TabsContent value="summary" className="space-y-6">
            {/* Warning when hours are estimated */}
            {summary.hasEstimatedHours && (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Estimated hours:</strong> Some work items use manual fee estimates without specific hour inputs. 
                  The hours shown below are <em>estimated</em> based on your selected "{assumptions.estimationMethod || 'pyramid'}" distribution and your fee rates. 
                  You can edit the estimated hours directly in the table below.
                  {summary.hasUserOverrides && (
                    <span className="ml-2 font-medium">(You have edited the estimated hours)</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Estimated Range</p>
                      <p className="text-2xl font-bold">{formatCurrency(workItemTotals.lowerTotal)} - {formatCurrency(workItemTotals.upperTotal)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className={summary.hasEstimatedHours ? "border-amber-300 dark:border-amber-700" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Hours
                        {summary.hasEstimatedHours && <span className="text-amber-600 ml-1">(incl. estimated)</span>}
                      </p>
                      <p className="text-2xl font-bold">{formatHours(summary.totalHours)}</p>
                    </div>
                    <Clock className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className={summary.hasEstimatedHours ? "border-amber-300 dark:border-amber-700" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Blended Rate
                        {summary.hasEstimatedHours && <span className="text-amber-600 ml-1">(indicative)</span>}
                      </p>
                      <p className="text-2xl font-bold">{formatCurrency(summary.blendedRate)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Fee Breakdown by Grade</CardTitle>
                  {summary.hasUserOverrides && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setHourOverrides({})}
                      className="text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset to estimates
                    </Button>
                  )}
                </div>
                {summary.hasEstimatedHours && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Hours marked with * are estimated. Click on any hour value to edit.
                  </p>
                )}
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
                      <TableCell className="text-right">
                        {summary.hasEstimatedHours ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={summary.totalPartnerHours.toFixed(1)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                // Subtract confirmed hours to get the estimated portion that user is overriding
                                setHourOverrides(prev => ({ ...prev, partner: Math.max(0, val - summary.confirmedPartnerHours) }));
                              }}
                              className="w-20 h-7 text-right text-sm bg-amber-50 dark:bg-amber-950/20 border-amber-300"
                            />
                            <span className="text-amber-600 text-xs">*</span>
                          </div>
                        ) : (
                          formatHours(summary.totalPartnerHours)
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.afaPartnerRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.partnerRevenue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Senior Associate</TableCell>
                      <TableCell className="text-right">
                        {summary.hasEstimatedHours ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={summary.totalSeniorAssociateHours.toFixed(1)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setHourOverrides(prev => ({ ...prev, seniorAssociate: val }));
                              }}
                              className="w-20 h-7 text-right text-sm bg-amber-50 dark:bg-amber-950/20 border-amber-300"
                            />
                            <span className="text-amber-600 text-xs">*</span>
                          </div>
                        ) : (
                          formatHours(summary.totalSeniorAssociateHours)
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.afaSeniorAssociateRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.seniorAssociateRevenue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Associate</TableCell>
                      <TableCell className="text-right">
                        {summary.hasEstimatedHours ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={summary.totalAssociateHours.toFixed(1)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setHourOverrides(prev => ({ ...prev, associate: Math.max(0, val - summary.confirmedAssociateHours) }));
                              }}
                              className="w-20 h-7 text-right text-sm bg-amber-50 dark:bg-amber-950/20 border-amber-300"
                            />
                            <span className="text-amber-600 text-xs">*</span>
                          </div>
                        ) : (
                          formatHours(summary.totalAssociateHours)
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.afaAssociateRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.associateRevenue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Trainee</TableCell>
                      <TableCell className="text-right">
                        {summary.hasEstimatedHours ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={summary.totalTraineeHours.toFixed(1)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setHourOverrides(prev => ({ ...prev, trainee: val }));
                              }}
                              className="w-20 h-7 text-right text-sm bg-amber-50 dark:bg-amber-950/20 border-amber-300"
                            />
                            <span className="text-amber-600 text-xs">*</span>
                          </div>
                        ) : (
                          formatHours(summary.totalTraineeHours)
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.afaTraineeRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.traineeRevenue)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatHours(summary.totalHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.blendedRate)} (blended)</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span>{formatCurrency(summary.totalRevenue)}</span>
                          <span className="text-xs font-normal text-muted-foreground">(Midpoint Pricing)</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRICING PARAMETERS TAB */}
          <TabsContent value="parameters" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Pricing Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-2 max-w-md">
                  <Label>Team Rate Currency</Label>
                  <Select
                    value={proposal?.team_rate_currency || proposal?.currency || 'GBP'}
                    onValueChange={(value) => updateProposal.mutate({ team_rate_currency: value })}
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
                  <p className="text-xs text-muted-foreground">
                    The currency in which your team's rates are expressed
                  </p>
                </div>

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
                  <p className="text-xs text-muted-foreground">
                    The currency used for pricing and client quotes
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

            {/* Figure Settings Card - REQUIRED */}
            <Card className={cn(
              "border-2",
              areFigureSettingsComplete(assumptions) 
                ? "border-green-500/50 bg-green-50/30" 
                : "border-amber-500 bg-amber-50/50"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Figure Settings
                  {areFigureSettingsComplete(assumptions) ? (
                    <Badge variant="outline" className="ml-2 text-green-600 border-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-2 text-amber-600 border-amber-500">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Required
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  These settings must be completed before exporting to Excel or sending to a matter.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Excel Export Figures */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Which figures should be included in Excel exports?</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">
                            Select which fee columns to include in exported Excel files. 
                            You can select multiple options.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="export-lower"
                        checked={assumptions.excelExportFigures?.lower || false}
                        onCheckedChange={(checked) => setAssumptions(prev => ({
                          ...prev,
                          excelExportFigures: {
                            lower: !!checked,
                            midpoint: prev.excelExportFigures?.midpoint || false,
                            upper: prev.excelExportFigures?.upper || false,
                          }
                        }))}
                      />
                      <Label htmlFor="export-lower" className="cursor-pointer">Lower Estimates</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="export-midpoint"
                        checked={assumptions.excelExportFigures?.midpoint || false}
                        onCheckedChange={(checked) => setAssumptions(prev => ({
                          ...prev,
                          excelExportFigures: {
                            lower: prev.excelExportFigures?.lower || false,
                            midpoint: !!checked,
                            upper: prev.excelExportFigures?.upper || false,
                          }
                        }))}
                      />
                      <Label htmlFor="export-midpoint" className="cursor-pointer">Midpoint</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="export-upper"
                        checked={assumptions.excelExportFigures?.upper || false}
                        onCheckedChange={(checked) => setAssumptions(prev => ({
                          ...prev,
                          excelExportFigures: {
                            lower: prev.excelExportFigures?.lower || false,
                            midpoint: prev.excelExportFigures?.midpoint || false,
                            upper: !!checked,
                          }
                        }))}
                      />
                      <Label htmlFor="export-upper" className="cursor-pointer">Upper Estimates</Label>
                    </div>
                  </div>
                  {!assumptions.excelExportFigures?.lower && 
                   !assumptions.excelExportFigures?.midpoint && 
                   !assumptions.excelExportFigures?.upper && (
                    <p className="text-sm text-amber-600">Please select at least one figure type</p>
                  )}
                </div>

                {/* AFA Base Figure */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Which figure should be used for AFA calculations?</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">
                            This determines the baseline figure used when calculating discounts, 
                            fixed fees, blended rates, and other Alternative Fee Arrangements.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <RadioGroup 
                    value={assumptions.afaBaseFigure || ''} 
                    onValueChange={(value: FigureType) => setAssumptions(prev => ({ ...prev, afaBaseFigure: value }))}
                    className="flex flex-wrap gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="lower" id="afa-lower" />
                      <Label htmlFor="afa-lower" className="cursor-pointer">Lower Estimates</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="midpoint" id="afa-midpoint" />
                      <Label htmlFor="afa-midpoint" className="cursor-pointer">Midpoint</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="upper" id="afa-upper" />
                      <Label htmlFor="afa-upper" className="cursor-pointer">Upper Estimates</Label>
                    </div>
                  </RadioGroup>
                  {!assumptions.afaBaseFigure && (
                    <p className="text-sm text-amber-600">Please select a figure type</p>
                  )}
                </div>

                {/* Send to Matter Figure */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Which figure should be used when sending to a matter?</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">
                            This determines what figures become the matter's budget when you 
                            send this proposal to a matter. "AFA Figure" uses the calculated 
                            AFA client price with appropriate line item scaling.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <RadioGroup 
                    value={assumptions.sendToMatterFigure || ''} 
                    onValueChange={(value: SendToMatterFigure) => setAssumptions(prev => ({ ...prev, sendToMatterFigure: value }))}
                    className="flex flex-wrap gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="midpoint" id="matter-midpoint" />
                      <Label htmlFor="matter-midpoint" className="cursor-pointer">Midpoint</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="upper" id="matter-upper" />
                      <Label htmlFor="matter-upper" className="cursor-pointer">Upper Estimate</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="afa" id="matter-afa" />
                      <Label htmlFor="matter-afa" className="cursor-pointer">AFA Figure</Label>
                    </div>
                  </RadioGroup>
                  {!assumptions.sendToMatterFigure && (
                    <p className="text-sm text-amber-600">Please select a figure type</p>
                  )}
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

          {/* TEAM & RATES TAB */}
          <TabsContent value="rates" className="space-y-4">
            <EditableRateCard
              rateCard={rateCard}
              feeCurrency={feeCurrency}
              teamRateCurrency={teamRateCurrency}
              exchangeRate={teamToFeeExchangeRate}
              onSave={async (newTeamRateCard, newFeeRateCard) => {
                setRateCard(newTeamRateCard);
                setFeeRateCard(newFeeRateCard);
                await updateProposal.mutateAsync({ rate_card: newTeamRateCard });
                toast({ title: 'Rate card saved' });
              }}
              onSaveAsDefault={async (newRateCard) => {
                await saveDefaultRateCard.mutateAsync(newRateCard);
              }}
              isSaving={updateProposal.isPending}
              isSavingDefault={saveDefaultRateCard.isPending}
              afaDiscount={afaDiscountPercent}
            />
          </TabsContent>

          {/* SCOPE ASSUMPTIONS TAB */}
          <TabsContent value="scope-assumptions" className="space-y-4">
            <ScopeAssumptionsTab
              value={scopeAssumptions}
              onChange={async (newState) => {
                setScopeAssumptions(newState);
                // Auto-save scope assumptions
                await supabase
                  .from('pricing_proposals')
                  .update({ scope_assumptions: newState as any })
                  .eq('id', proposalId);
              }}
              currency={proposal?.currency || 'GBP'}
              workItems={draftItems}
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
          rateCard={feeRateCard}
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
