import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import SummarySliderRow from "@/components/pricing/SummarySliderRow";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  Scale,
  Target,
  Lock,
  Unlock
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
import { calculateFeeRange } from "@/lib/feeSpreadUtils";
import { IterativePricingDialog, FeeOwnerHours } from "@/components/pricing/IterativePricingDialog";
import { EditableRateCard } from "@/components/pricing/EditableRateCard";
import { CategorizedProposalView, categoryBgColors, categoryTextColors, categoryBorderColors } from "@/components/pricing/CategorizedProposalView";
import { PhasedWorkItemsView, PhasedWorkItemsViewRef } from "@/components/pricing/PhasedWorkItemsView";
import { AddWorkItemDialog } from "@/components/pricing/AddWorkItemDialog";
import { LocalCounselPanel } from "@/components/pricing/LocalCounselPanel";
import { AFATab } from "@/components/pricing/AFATab";
import { ScalePricingWizard } from "@/components/pricing/ScalePricingWizard";
import { ScopeAssumptionsTab, ScopeAssumptionsState, getAssumptionNarratives, getGroupedAssumptionNarratives } from "@/components/pricing/ScopeAssumptionsTab";
import SummaryPyramid from "@/components/pricing/SummaryPyramid";
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
  const phasedWorkItemsRef = useRef<PhasedWorkItemsViewRef>(null);
  
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
  const [phasesInitialized, setPhasesInitialized] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isExtractingRfp, setIsExtractingRfp] = useState(false);
  const [isGeneratingAiPricing, setIsGeneratingAiPricing] = useState(false);
  const [isAiPricingConfirmOpen, setIsAiPricingConfirmOpen] = useState(false);
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
  // Category lock state - locked categories are protected from automated pricing changes
  const [lockedCategories, setLockedCategories] = useState<Set<string>>(new Set());
  const lockedCategoriesRef = useRef<Set<string>>(new Set());
  
  // Target pricing dialog state
  const [isTargetPricingDialogOpen, setIsTargetPricingDialogOpen] = useState(false);
  const [targetPricingPhaseId, setTargetPricingPhaseId] = useState<string>("all");
  const [targetPricingAmount, setTargetPricingAmount] = useState<string>("");
  const [isAllocatingTargetPricing, setIsAllocatingTargetPricing] = useState(false);
  const [isAddWorkItemDialogOpen, setIsAddWorkItemDialogOpen] = useState(false);
  const [isScalePricingOpen, setIsScalePricingOpen] = useState(false);
  
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
  // NOTE: setFeeRateCard is kept for direct overrides from EditableRateCard;
  // the default derivation is done via useMemo to avoid one-render-behind issues.
  const [feeRateCardOverride, setFeeRateCardOverride] = useState<RateCard | null>(null);
  const [assumptions, setAssumptions] = useState<ProposalAssumptions>(DEFAULT_ASSUMPTIONS);
  const [scopeAssumptions, setScopeAssumptions] = useState<ScopeAssumptionsState | null>(null);
  const [scopeAssumptionsInitialized, setScopeAssumptionsInitialized] = useState(false);
  const [summaryInitialized, setSummaryInitialized] = useState(false);
  const [showAssumptionsNotTrue, setShowAssumptionsNotTrue] = useState(false);

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
      // Sync assumptions from DB, but preserve locally-managed summaryHours/summaryLocks
      // once they've been initialized (to prevent refetch from overwriting scaled hours)
      setAssumptions(prev => {
        const incoming = proposal.assumptions || DEFAULT_ASSUMPTIONS;
        if (summaryInitialized) {
          return { ...incoming, summaryHours: prev.summaryHours, summaryLocks: prev.summaryLocks };
        }
        return incoming;
      });
      // Load scope assumptions from proposal (only once to prevent overwriting local edits)
      if (proposal.scope_assumptions && !scopeAssumptionsInitialized) {
        setScopeAssumptions(proposal.scope_assumptions);
        setScopeAssumptionsInitialized(true);
      }
      // Load phases from proposal work_phases (only once to prevent overwriting local edits)
      if (proposal.work_phases && Array.isArray(proposal.work_phases) && !phasesInitialized) {
        // Convert legacy WorkPhase format to ProposalPhase if needed
        const loadedPhases: ProposalPhase[] = proposal.work_phases.map((p: any) => ({
          id: p.id || `phase-${Date.now()}-${Math.random()}`,
          name: p.name || 'Unnamed Phase',
          is_included: p.is_included !== false,
        }));
        setPhases(loadedPhases);
        setPhasesInitialized(true);
      }
      // Load locked categories from proposal (only once)
      if ((proposal as any).locked_categories && lockedCategories.size === 0) {
        const loaded = new Set<string>((proposal as any).locked_categories as string[]);
        setLockedCategories(loaded);
        lockedCategoriesRef.current = loaded;
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
        detail: (item as any).detail || null,  // Load detail from database
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
        is_pc_sum: (item as any).is_pc_sum ?? false,  // Load PC Sum flag
        internal_input_dept: (item as any).internal_input_dept || null,  // Load BM Input dept
        ai_rationale: item.ai_rationale,
        partner_hours: item.partner_hours || 0,
        associate_hours: item.associate_hours || 0,
        num_turns: item.num_turns || 1,
        item_type: item.item_type || 'documentation',
        assumption_linked: (item as any).assumption_linked ?? false,
        assumption_text: (item as any).assumption_text || null,
        alt_fee_lower: (item as any).alt_fee_lower ?? 0,
        alt_fee_upper: (item as any).alt_fee_upper ?? 0,
        is_multiplied: (item as any).is_multiplied ?? false,
        multiplier_qty: (item as any).multiplier_qty ?? 1,
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

  // Auto-save: Uses a debounced approach - saves 3 seconds after user stops making changes
  // This ensures data is persisted without being disruptive on every keystroke
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  
  // Track if we have pending changes that need saving
  const pendingChangesRef = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  
  // Store latest values in refs for the save function
  const draftItemsRef = useRef(draftItems);
  const phasesRef = useRef(phases);
  const isInitializedRef = useRef(isInitialized);
  const latestVersionRef = useRef(latestVersion);
  
  // Keep refs in sync with state
  useEffect(() => {
    draftItemsRef.current = draftItems;
  }, [draftItems]);
  
  useEffect(() => {
    phasesRef.current = phases;
  }, [phases]);
  
  useEffect(() => {
    lockedCategoriesRef.current = lockedCategories;
  }, [lockedCategories]);
  
  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);
  
  useEffect(() => {
    latestVersionRef.current = latestVersion;
  }, [latestVersion]);
  
  // Internal save function that persists to DB silently (no toast for auto-save)
  const performSave = async (showToast = false) => {
    if (!isInitializedRef.current || !latestVersionRef.current || !pendingChangesRef.current) return;
    if (isSavingRef.current) return; // Prevent overlapping saves
    
    isSavingRef.current = true;
    setIsSaving(true);
    setAutoSaveStatus('saving');
    
    try {
      const itemsToSave = draftItemsRef.current;
      const phasesToSave = phasesRef.current;
      
      // Save work items to version (use mutateAsync for awaiting)
      if (itemsToSave.length > 0) {
        const { error: versionError } = await supabase
          .from('pricing_proposal_versions')
          .update({
            total_amount: itemsToSave.filter(i => i.is_included !== false).reduce((sum, i) => sum + (i.fee_upper || i.fee_amount), 0),
            bm_total: itemsToSave.filter(i => i.provider === 'Baker McKenzie' && i.is_included !== false).reduce((sum, i) => sum + (i.fee_upper || i.fee_amount), 0),
            local_counsel_total: itemsToSave.filter(i => i.provider === 'Local Counsel' && i.is_included !== false).reduce((sum, i) => sum + (i.fee_upper || i.fee_amount), 0),
          })
          .eq('id', latestVersionRef.current!.id);
        
        if (versionError) throw versionError;
        
        // Delete and re-insert items
        await supabase
          .from('pricing_proposal_items')
          .delete()
          .eq('version_id', latestVersionRef.current!.id);
        
        const itemsToInsert = itemsToSave.map((item, index) => ({
          version_id: latestVersionRef.current!.id,
          proposal_id: proposalId!,
          user_id: proposal?.user_id,
          work_item: item.work_item,
          detail: item.detail || null,
          provider: item.provider,
          fee_amount: item.fee_amount,
          fee_lower: item.fee_lower ?? item.fee_amount,
          fee_upper: item.fee_upper ?? item.fee_amount,
          pricing_method: item.pricing_method,
          category: item.category || null,
          phase_id: item.phase_id || null,
          lc_firm_name: item.provider === 'Local Counsel' ? (item.lc_firm_name || null) : null,
          lc_country: item.provider === 'Local Counsel' ? (item.lc_country || null) : null,
          lc_library_id: item.provider === 'Local Counsel' ? (item.lc_library_id || null) : null,
          lc_currency: item.provider === 'Local Counsel' ? (item.lc_currency || null) : null,
          is_optional: item.is_optional ?? false,
          is_included: item.is_included ?? true,
          is_pc_sum: item.is_pc_sum ?? false,
          internal_input_dept: item.internal_input_dept || null,
          sort_order: index,
          ai_rationale: item.ai_rationale || null,
          partner_hours: item.partner_hours ?? 0,
          associate_hours: item.associate_hours ?? 0,
          num_turns: item.num_turns ?? 1,
          item_type: item.item_type ?? 'documentation',
          assumption_linked: item.assumption_linked ?? false,
          assumption_text: item.assumption_text || null,
          alt_fee_lower: item.alt_fee_lower ?? 0,
          alt_fee_upper: item.alt_fee_upper ?? 0,
          is_multiplied: item.is_multiplied ?? false,
          multiplier_qty: item.multiplier_qty ?? 1,
        }));
        
        const { error: insertError } = await supabase
          .from('pricing_proposal_items')
          .insert(itemsToInsert);
        
        if (insertError) throw insertError;
      }
      
      // Save phases and locked categories to proposal
      const { error: proposalError } = await supabase
        .from('pricing_proposals')
        .update({ 
          work_phases: phasesToSave as any,
          locked_categories: Array.from(lockedCategoriesRef.current) as any,
        })
        .eq('id', proposalId!);
      
      if (proposalError) throw proposalError;
      
      setHasUnsavedChanges(false);
      pendingChangesRef.current = false;
      setAutoSaveStatus('saved');
      
      if (showToast) {
        toast({ title: 'Changes saved' });
      }
      
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setAutoSaveStatus('idle');
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };
  
  // Debounced auto-save: triggers 15 seconds after changes stop
  // Long delay to avoid disrupting text entry - manual save always available
  const hasInitializedOnce = useRef(false);
  const lastChangeTimeRef = useRef<number>(0);
  const hasUnsavedChangesRef = useRef(false);
  
  // Use a simple counter to track if items/phases arrays changed reference
  const itemsLengthRef = useRef(0);
  const phasesLengthRef = useRef(0);
  
  // Effect only marks pending changes - doesn't cause re-renders
  useEffect(() => {
    if (!isInitialized) return;
    
    // Skip the first render after initialization (this is the initial load)
    if (!hasInitializedOnce.current) {
      hasInitializedOnce.current = true;
      itemsLengthRef.current = draftItems.length;
      phasesLengthRef.current = phases.length;
      return;
    }
    
    // Mark as having pending changes using refs (no re-render)
    pendingChangesRef.current = true;
    lastChangeTimeRef.current = Date.now();
    
    // Only update hasUnsavedChanges state once (when transitioning from saved to unsaved)
    if (!hasUnsavedChangesRef.current) {
      hasUnsavedChangesRef.current = true;
      // Use setTimeout to batch this state update
      setTimeout(() => setHasUnsavedChanges(true), 0);
    }
    
    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for 15 seconds after last change
    autoSaveTimeoutRef.current = setTimeout(() => {
      performSave(false); // Silent save (no toast)
      hasUnsavedChangesRef.current = false;
    }, 15000);
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [draftItems, phases, isInitialized]);

  // Save function that can be called on navigation/tab change (with toast)
  const saveChanges = async () => {
    // Clear debounce timeout since we're saving now
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    await performSave(true);
  };

  // Warn before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingChangesRef.current && isInitializedRef.current) {
        // Try to save immediately
        performSave(false);
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Save when switching tabs within the page
  const handleTabChange = async (newTab: string) => {
    // Save current work before switching tabs
    if (pendingChangesRef.current) {
      await saveChanges();
    }
    setActiveTab(newTab);
  };

  // Calculate work items totals using the afaBaseFigure setting
  // This ensures AFA calculations use the user-selected baseline (lower/midpoint/upper)
  // Items with is_included === false are excluded from all calculations
  const workItemTotals = useMemo(() => {
    const includedItems = draftItems.filter(item => item.is_included !== false);
    
    // Use the afaBaseFigure setting to determine which fee to use for BM items
    const baseFigure: FigureType = assumptions.afaBaseFigure || 'midpoint';
    
    const getMult = (item: DraftProposalItem) => (item.is_multiplied && item.multiplier_qty) ? item.multiplier_qty : 1;
    
    const bmTotal = includedItems
      .filter(item => item.provider === 'Baker McKenzie')
      .reduce((sum, item) => sum + getItemFeeByFigureType(item, baseFigure) * getMult(item), 0);
    
    // Local counsel always uses fee_amount (handled by getItemFeeByFigureType)
    const localCounselTotal = includedItems
      .filter(item => item.provider === 'Local Counsel')
      .reduce((sum, item) => sum + getItemFeeByFigureType(item, baseFigure) * getMult(item), 0);
    
    // Also calculate the explicit lower/upper totals for reference
    const lowerTotal = includedItems.reduce((sum, item) => {
      return sum + getItemFeeByFigureType(item, 'lower') * getMult(item);
    }, 0);
    const upperTotal = includedItems.reduce((sum, item) => {
      return sum + getItemFeeByFigureType(item, 'upper') * getMult(item);
    }, 0);
    
    return {
      bmTotal,
      localCounselTotal,
      total: bmTotal + localCounselTotal,
      lowerTotal,
      upperTotal,
    };
  }, [draftItems, assumptions.afaBaseFigure]);

  // Calculate "Assumptions Not All True" alternative totals
  const altTotals = useMemo(() => {
    const includedItems = draftItems.filter(item => item.is_included !== false);
    const hasAnyAlt = includedItems.some(item => item.assumption_linked && (item.alt_fee_lower || item.alt_fee_upper));
    if (!hasAnyAlt) return null;

    const getMult = (item: DraftProposalItem) => (item.is_multiplied && item.multiplier_qty) ? item.multiplier_qty : 1;
    
    const altLowerTotal = includedItems.reduce((sum, item) => {
      const mult = getMult(item);
      if (item.assumption_linked && item.alt_fee_lower != null) {
        return sum + item.alt_fee_lower * mult;
      }
      return sum + getItemFeeByFigureType(item, 'lower') * mult;
    }, 0);
    const altUpperTotal = includedItems.reduce((sum, item) => {
      const mult = getMult(item);
      if (item.assumption_linked && item.alt_fee_upper != null) {
        return sum + item.alt_fee_upper * mult;
      }
      return sum + getItemFeeByFigureType(item, 'upper') * mult;
    }, 0);
    const altBmTotal = includedItems
      .filter(item => item.provider === 'Baker McKenzie')
      .reduce((sum, item) => {
        const mult = getMult(item);
        if (item.assumption_linked && item.alt_fee_upper != null) {
          return sum + item.alt_fee_upper * mult;
        }
        return sum + getItemFeeByFigureType(item, assumptions.afaBaseFigure || 'midpoint') * mult;
      }, 0);
    const altLcTotal = includedItems
      .filter(item => item.provider === 'Local Counsel')
      .reduce((sum, item) => {
        const mult = getMult(item);
        if (item.assumption_linked && item.alt_fee_upper != null) {
          return sum + item.alt_fee_upper * mult;
        }
        return sum + getItemFeeByFigureType(item, assumptions.afaBaseFigure || 'midpoint') * mult;
      }, 0);

    return {
      lowerTotal: altLowerTotal,
      upperTotal: altUpperTotal,
      bmTotal: altBmTotal,
      lcTotal: altLcTotal,
      total: altBmTotal + altLcTotal,
    };
  }, [draftItems, assumptions.afaBaseFigure]);

  const enabledAFAs = useMemo(() => {
    return proposalAFAs.filter(a => a.is_enabled);
  }, [proposalAFAs]);

  // Get unique department names from all items for the "BM Input" column
  const existingInputDepts = useMemo(() => {
    const depts = new Set<string>();
    draftItems.forEach(item => {
      if (item.internal_input_dept) {
        depts.add(item.internal_input_dept);
      }
    });
    return Array.from(depts).sort();
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
    
    // Use standard rates (no discount applied to baseline - AFA handles discounts separately)
    const partnerRate = rateCard.partner.rate;
    const associateRate = rateCard.associate.rate;
    
    return Math.round((totalPartnerHours * partnerRate) + (totalAssociateHours * associateRate));
  };

  // Format team member label from rate card key
  const formatTeamMemberLabel = useCallback((key: string, entry?: { label?: string }) => {
    if (entry?.label) return entry.label;
    const STANDARD_LABELS: Record<string, string> = {
      partner: 'Partner',
      seniorAssociate: 'Senior Associate',
      associate: 'Associate',
      trainee: 'Trainee',
      counsel: 'Counsel',
    };
    return STANDARD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, s => s.toUpperCase()).trim();
  }, []);

  // Currency and exchange rate (needed before feeRateCard derivation)
  const currencySymbol = getCurrencySymbol(proposal?.currency || 'GBP');
  const teamRateCurrency = proposal?.team_rate_currency || proposal?.currency || 'GBP';
  const feeCurrency = proposal?.currency || 'GBP';
  
  const teamToFeeExchangeRate = useMemo(() => {
    if (teamRateCurrency === feeCurrency) return 1;
    const rates = exchangeRatesData?.rates;
    if (!rates) return 1;
    const teamRate = rates[teamRateCurrency];
    const feeRate = rates[feeCurrency];
    if (!teamRate || teamRate === 0 || !feeRate || feeRate === 0) return 1;
    return feeRate / teamRate;
  }, [teamRateCurrency, feeCurrency, exchangeRatesData?.rates]);

  // Derive feeRateCard synchronously (useMemo prevents one-render-behind issues
  // that were causing custom team members' hours to be wiped on page load)
  const derivedFeeRateCard = useMemo(() => {
    const convertedRateCard: RateCard = {} as RateCard;
    Object.keys(rateCard).forEach(key => {
      const entry = (rateCard as any)[key];
      if (entry && typeof entry === 'object' && 'rate' in entry) {
        (convertedRateCard as any)[key] = {
          rate: Math.round(entry.rate * teamToFeeExchangeRate),
          cost: entry.cost || 0,
          label: entry.label,
          level: entry.level,
        };
      }
    });
    return convertedRateCard;
  }, [rateCard, teamToFeeExchangeRate]);

  const feeRateCard = feeRateCardOverride || derivedFeeRateCard;

  useEffect(() => {
    setFeeRateCardOverride(null);
  }, [rateCard, teamToFeeExchangeRate]);

  // Derive team members from feeRateCard (source of truth for team composition)
  const teamMembers = useMemo(() => {
    return Object.entries(feeRateCard)
      .filter(([_, entry]) => entry && entry.rate > 0)
      .map(([key, entry]) => ({
        key,
        label: formatTeamMemberLabel(key, entry),
        rate: entry.rate,
        cost: entry.cost || 0,
        level: entry.level,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [feeRateCard, formatTeamMemberLabel]);

  // Summary state derived from assumptions
  const summaryHours = assumptions.summaryHours || {};
  const summaryLocks = assumptions.summaryLocks || {};

  // BM upper estimate target
  const bmUpperTarget = useMemo(() => {
    return draftItems
      .filter(item => item.provider === 'Baker McKenzie' && item.is_included !== false)
      .reduce((sum, item) => sum + (item.fee_upper || item.fee_amount || 0), 0);
  }, [draftItems]);

  // Initialize summary hours (once)
  useEffect(() => {
    if (summaryInitialized || teamMembers.length === 0 || !proposal) return;

    const stored = assumptions.summaryHours;
    if (stored && Object.keys(stored).length > 0) {
      setSummaryInitialized(true);
      return;
    }

    if (bmUpperTarget <= 0 || teamMembers.length === 0) {
      setSummaryInitialized(true);
      return;
    }

    // Distribute target revenue equally per member, convert to hours
    const revenuePerMember = bmUpperTarget / teamMembers.length;
    const newHours: Record<string, number> = {};
    teamMembers.forEach(m => {
      newHours[m.key] = m.rate > 0 ? Math.round((revenuePerMember / m.rate) * 2) / 2 : 0;
    });

    setAssumptions(prev => ({ ...prev, summaryHours: newHours, summaryLocks: {} }));
    setSummaryInitialized(true);
  }, [teamMembers, proposal, bmUpperTarget, summaryInitialized, assumptions.summaryHours]);

  // Reconcile when team members change (added/removed)
  useEffect(() => {
    if (!summaryInitialized || teamMembers.length === 0) return;

    const currentKeys = new Set(teamMembers.map(m => m.key));
    const storedKeys = new Set(Object.keys(summaryHours));

    const newMembers = teamMembers.filter(m => !storedKeys.has(m.key));
    const removedKeys = [...storedKeys].filter(k => !currentKeys.has(k));

    if (newMembers.length === 0 && removedKeys.length === 0) return;

    setAssumptions(prev => {
      const updated = { ...(prev.summaryHours || {}) };
      const updatedLocks = { ...(prev.summaryLocks || {}) };

      removedKeys.forEach(k => { delete updated[k]; delete updatedLocks[k]; });

      if (newMembers.length > 0) {
        const existingRevenue = Object.entries(updated).reduce((sum, [key, hours]) => {
          const member = teamMembers.find(m => m.key === key);
          return sum + (hours * (member?.rate || 0));
        }, 0);
        const remaining = Math.max(0, bmUpperTarget - existingRevenue);
        const revenuePerNew = newMembers.length > 0 && remaining > 0 ? remaining / newMembers.length : 0;
        newMembers.forEach(m => {
          updated[m.key] = m.rate > 0 && revenuePerNew > 0
            ? Math.round((revenuePerNew / m.rate) * 2) / 2
            : 0;
        });
      }

      return { ...prev, summaryHours: updated, summaryLocks: updatedLocks };
    });
  }, [teamMembers, summaryInitialized, summaryHours, bmUpperTarget]);

  // When budget target changes, scale ALL members' hours ratably (ignoring locks)
  const prevBmUpperTargetRef = useRef<number | null>(null);
  useEffect(() => {
    if (!summaryInitialized || teamMembers.length === 0) return;

    const prev = prevBmUpperTargetRef.current;
    prevBmUpperTargetRef.current = bmUpperTarget;

    // Skip initial set or if target hasn't actually changed
    if (prev === null || prev === bmUpperTarget || prev === 0) return;

    const ratio = bmUpperTarget / prev;

    setAssumptions(prevAssumptions => {
      const hours = { ...(prevAssumptions.summaryHours || {}) };
      Object.keys(hours).forEach(key => {
        if (hours[key] > 0) {
          // Scale ratably but never zero-out a member who had hours
          const scaled = Math.round((hours[key] * ratio) * 2) / 2;
          hours[key] = Math.max(0.5, scaled);
        }
      });
      return { ...prevAssumptions, summaryHours: hours };
    });
  }, [bmUpperTarget, summaryInitialized, teamMembers.length]);

  // Handle user editing hours — auto-rebalance unlocked members
  const handleSummaryHoursChange = useCallback((memberKey: string, newHours: number) => {
    setAssumptions(prev => {
      const hours = { ...(prev.summaryHours || {}) };
      const locks = prev.summaryLocks || {};

      hours[memberKey] = newHours;

      // Revenue from locked + just-edited members
      const fixedRevenue = teamMembers.reduce((sum, m) => {
        if (m.key === memberKey || locks[m.key]) {
          return sum + ((hours[m.key] || 0) * m.rate);
        }
        return sum;
      }, 0);

      const remainingTarget = bmUpperTarget - fixedRevenue;
      const unlocked = teamMembers.filter(m => m.key !== memberKey && !locks[m.key]);

      if (unlocked.length > 0 && remainingTarget > 0) {
        // Equal revenue share → cheaper members get more hours
        const revenuePerMember = remainingTarget / unlocked.length;
        unlocked.forEach(m => {
          hours[m.key] = m.rate > 0 ? Math.round((revenuePerMember / m.rate) * 2) / 2 : 0;
        });
      } else if (unlocked.length > 0) {
        unlocked.forEach(m => { hours[m.key] = 0; });
      }

      return { ...prev, summaryHours: hours };
    });
  }, [teamMembers, bmUpperTarget]);

  // Toggle lock on a team member
  const toggleSummaryLock = useCallback((memberKey: string) => {
    setAssumptions(prev => {
      const locks = { ...(prev.summaryLocks || {}) };
      locks[memberKey] = !locks[memberKey];
      return { ...prev, summaryLocks: locks };
    });
  }, []);

  // Auto-save summary changes (debounced)
  const summaryAutoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const assumptionsRef = useRef(assumptions);
  useEffect(() => { assumptionsRef.current = assumptions; }, [assumptions]);
  const summaryChangeCountRef = useRef(0);

  useEffect(() => {
    if (!proposalId || !summaryInitialized) return;

    summaryChangeCountRef.current++;
    if (summaryChangeCountRef.current <= 1) return;

    if (summaryAutoSaveRef.current) clearTimeout(summaryAutoSaveRef.current);
    summaryAutoSaveRef.current = setTimeout(async () => {
      try {
        await supabase
          .from('pricing_proposals')
          .update({ assumptions: assumptionsRef.current as any })
          .eq('id', proposalId);
      } catch (err) {
        console.error('Failed to save summary state:', err);
      }
    }, 2000);

    return () => {
      if (summaryAutoSaveRef.current) clearTimeout(summaryAutoSaveRef.current);
    };
  }, [assumptions.summaryHours, assumptions.summaryLocks, summaryInitialized, proposalId]);

  // Summary aggregates
  const summary = useMemo(() => {
    const enrichedMembers = teamMembers.map(m => {
      const hours = summaryHours[m.key] || 0;
      return {
        ...m,
        hours,
        revenue: hours * m.rate,
        memberCost: hours * m.cost,
        isLocked: !!summaryLocks[m.key],
      };
    });

    const totalHours = enrichedMembers.reduce((s, m) => s + m.hours, 0);
    const totalRevenue = enrichedMembers.reduce((s, m) => s + m.revenue, 0);
    const totalCost = enrichedMembers.reduce((s, m) => s + m.memberCost, 0);
    const blendedRate = totalHours > 0 ? totalRevenue / totalHours : 0;
    const delta = totalRevenue - bmUpperTarget;

    return {
      teamMembers: enrichedMembers,
      totalHours,
      totalRevenue,
      totalCost,
      blendedRate,
      delta,
      bmUpperTarget,
      hasEstimatedHours: enrichedMembers.length > 0,
    };
  }, [teamMembers, summaryHours, summaryLocks, bmUpperTarget]);


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

  // Add new work item via dialog - places item in correct position based on phase and category
  const handleAddWorkItem = useCallback((newItem: DraftProposalItem) => {
    setDraftItems(prev => {
      // Find the correct position based on phase and category
      // Items should be grouped by phase first, then by category within each phase
      const targetPhaseId = newItem.phase_id || null;
      const targetCategory = newItem.category || 'Other';
      
      // Find items in the same phase
      let insertIndex = prev.length; // Default to end
      
      // First, find items in the same phase
      const phaseItems = prev.map((item, idx) => ({ item, idx }))
        .filter(({ item }) => (item.phase_id || null) === targetPhaseId);
      
      if (phaseItems.length > 0) {
        // Find items in the same category within this phase
        const categoryItems = phaseItems.filter(({ item }) => (item.category || 'Other') === targetCategory);
        
        if (categoryItems.length > 0) {
          // Insert after the last item of the same category
          insertIndex = categoryItems[categoryItems.length - 1].idx + 1;
        } else {
          // No items with same category - find where this category should go
          // Use BUDGET_CATEGORIES order to determine position
          const categoryOrder = Object.fromEntries(
            BUDGET_CATEGORIES.map((cat, idx) => [cat, idx])
          );
          const targetOrder = categoryOrder[targetCategory] ?? 999;
          
          // Find the first item in this phase with a higher category order
          const higherCategoryItem = phaseItems.find(({ item }) => {
            const itemCategory = item.category || 'Other';
            const itemOrder = categoryOrder[itemCategory] ?? 999;
            return itemOrder > targetOrder;
          });
          
          if (higherCategoryItem) {
            insertIndex = higherCategoryItem.idx;
          } else {
            // Insert after the last item in this phase
            insertIndex = phaseItems[phaseItems.length - 1].idx + 1;
          }
        }
      } else {
        // No items in this phase - find where this phase should be inserted
        // Phases should maintain their order, unassigned goes last
        if (targetPhaseId === null) {
          // Unassigned - insert at the end
          insertIndex = prev.length;
        } else {
          // Find the first item from a later phase or unassigned
          const phaseIndex = phases.findIndex(p => p.id === targetPhaseId);
          if (phaseIndex >= 0) {
            const laterPhases = phases.slice(phaseIndex + 1).map(p => p.id);
            
            const laterPhaseItem = prev.findIndex(item => 
              laterPhases.includes(item.phase_id || '') || item.phase_id === null
            );
            
            if (laterPhaseItem >= 0) {
              insertIndex = laterPhaseItem;
            }
          }
        }
      }
      
      // Insert the new item at the calculated position
      const newItems = [...prev];
      newItems.splice(insertIndex, 0, newItem);
      return newItems;
    });
    setHasUnsavedChanges(true);
  }, [phases]);

  // Update work item - memoized to prevent child re-renders
  const updateItem = useCallback((index: number, updates: Partial<DraftProposalItem>) => {
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
  }, []);

  // Remove work item - memoized to prevent child re-renders
  const removeItem = useCallback((index: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  }, []);

  // Duplicate work item - inserts copy immediately below the original
  const duplicateItem = useCallback((index: number) => {
    setDraftItems(prev => {
      const itemToDuplicate = prev[index];
      const duplicatedItem: DraftProposalItem = {
        ...itemToDuplicate,
        id: `temp-${Date.now()}-${Math.random()}`, // New temporary ID
      };
      const newItems = [...prev];
      newItems.splice(index + 1, 0, duplicatedItem);
      return newItems;
    });
    setHasUnsavedChanges(true);
  }, []);

  // Handle drag end for reordering items
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = parseInt(active.id as string);
    const newIndex = parseInt(over.id as string);

    setDraftItems(prev => arrayMove(prev, oldIndex, newIndex));
    setHasUnsavedChanges(true);
  }, []);

  // Open iterative pricing dialog for a work item
  const openIterativePricing = useCallback((index: number) => {
    setIterativeDialogIndex(index);
    setIterativeDialogOpen(true);
  }, []);

  // Apply iterative pricing result to work item
  const applyIterativePricing = (result: {
    feeOwnerHours: FeeOwnerHours;
    numTurns: number;
    itemType: string;
    calculatedFee: number;
  }) => {
    if (iterativeDialogIndex === null) return;
    
    // Get the current item's category for risk-based spread calculation
    const currentItem = draftItems[iterativeDialogIndex];
    const { fee_lower, fee_amount } = calculateFeeRange(result.calculatedFee, currentItem?.category);
    
    updateItem(iterativeDialogIndex, {
      partner_hours: result.feeOwnerHours.partner || 0,
      associate_hours: result.feeOwnerHours.associate || 0,
      num_turns: result.numTurns,
      item_type: result.itemType as 'documentation' | 'negotiation' | 'due_diligence' | 'meeting',
      fee_amount,
      fee_lower,
      fee_upper: result.calculatedFee, // The calculated fee becomes the upper estimate
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
        // Handle phases if the AI detected any
        if (extractedData.phases && extractedData.phases.length > 0) {
          const newPhases: ProposalPhase[] = extractedData.phases.map((phase: any) => ({
            id: phase.id,
            name: phase.name,
            is_included: true,
          }));
          setPhases(prev => [...prev, ...newPhases]);
        }

        const newItems: DraftProposalItem[] = extractedData.items.map((item: any) => {
          const feeAmount = item.fee_amount || 0;
          // Apply ±10% spread for AI-extracted items
          const feeLower = Math.round(feeAmount * 0.9);
          const feeUpper = Math.round(feeAmount * 1.1);
          
          return {
            work_item: item.work_item,
            detail: item.detail || null, // Preserve the full detail from AI
            provider: item.provider === 'Local Counsel' ? 'Local Counsel' : 'Baker McKenzie',
            fee_amount: feeAmount,
            fee_lower: feeLower,
            fee_upper: feeUpper,
            pricing_method: 'ai_suggested' as PricingMethod,
            category: item.category || null,
            phase_id: item.phase_id || null, // Preserve phase assignment from AI
            lc_firm_name: item.lc_firm_name,
            is_optional: false,
            is_included: true,
            ai_rationale: 'Extracted from RFP document',
          };
        });

        setDraftItems(prev => [...prev, ...newItems]);
        setHasUnsavedChanges(true);
        const phaseMsg = extractedData.phases?.length > 0 ? ` across ${extractedData.phases.length} phases` : '';
        toast({ title: `Extracted ${newItems.length} work items${phaseMsg} from RFP` });
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
        // Handle phases if the AI detected any
        if (extractedData.phases && extractedData.phases.length > 0) {
          const newPhases: ProposalPhase[] = extractedData.phases.map((phase: any) => ({
            id: phase.id,
            name: phase.name,
            is_included: true,
          }));
          setPhases(prev => [...prev, ...newPhases]);
        }

        const newItems: DraftProposalItem[] = extractedData.items.map((item: any) => {
          const feeAmount = item.fee_amount || 0;
          const feeLower = Math.round(feeAmount * 0.9);
          const feeUpper = Math.round(feeAmount * 1.1);
          
          return {
            work_item: item.work_item,
            detail: item.detail || null, // Preserve the full detail from AI
            provider: item.provider === 'Local Counsel' ? 'Local Counsel' : 'Baker McKenzie',
            fee_amount: feeAmount,
            fee_lower: feeLower,
            fee_upper: feeUpper,
            pricing_method: 'ai_suggested' as PricingMethod,
            category: item.category || null,
            phase_id: item.phase_id || null, // Preserve phase assignment from AI
            lc_firm_name: item.lc_firm_name,
            is_optional: false,
            is_included: true,
            ai_rationale: 'Extracted from pasted text',
          };
        });

        setDraftItems(prev => [...prev, ...newItems]);
        setHasUnsavedChanges(true);
        const phaseMsg = extractedData.phases?.length > 0 ? ` across ${extractedData.phases.length} phases` : '';
        toast({ title: `Extracted ${newItems.length} work items${phaseMsg} from text` });
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

  // Helper: check if an item belongs to a locked category
  const isItemLocked = useCallback((item: DraftProposalItem): boolean => {
    const category = item.category || 'Other';
    const phaseId = item.phase_id || 'global';
    return lockedCategories.has(`${phaseId}:${category}`);
  }, [lockedCategories]);

  // Toggle lock on a category (supports aggregate: prefix to toggle across all phases)
  const handleToggleCategoryLock = useCallback((key: string) => {
    setLockedCategories(prev => {
      const next = new Set(prev);
      
      // Aggregate lock: toggle this category across ALL phases
      if (key.startsWith('aggregate:')) {
        const category = key.slice('aggregate:'.length);
        // Check if ALL phases are currently locked for this category
        const allLocked = phases.length > 0 && phases.every(p => next.has(`${p.id}:${category}`));
        phases.forEach(p => {
          const phaseKey = `${p.id}:${category}`;
          if (allLocked) {
            next.delete(phaseKey);
          } else {
            next.add(phaseKey);
          }
        });
      } else {
        // Standard single-key toggle
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
      }
      
      // Mark as needing save
      pendingChangesRef.current = true;
      return next;
    });
    setHasUnsavedChanges(true);
  }, [phases]);

  // Generate AI pricing for selected items only (respects user's manual pricing on unselected items)
  const generateAiPricing = async () => {
    setIsGeneratingAiPricing(true);
    try {
      // Only apply AI pricing to items that are:
      // 1. Selected (is_included = true) - user explicitly wants to price these
      // 2. Have no existing price (fee_amount = 0) - don't overwrite manual pricing
      // 3. NOT in a locked category - locked items are protected from automated changes
      const itemsNeedingPricing = draftItems.filter(i => 
        i.is_included && (!i.fee_amount || i.fee_amount === 0) && !isItemLocked(i)
      );
      
      const selectedCount = draftItems.filter(i => i.is_included).length;
      
      if (selectedCount === 0) {
        toast({ 
          title: 'No items selected', 
          description: 'Select items using checkboxes to apply AI pricing',
          variant: 'destructive'
        });
        setIsGeneratingAiPricing(false);
        return;
      }
      
      if (itemsNeedingPricing.length === 0) {
        toast({ title: 'All selected items already have prices' });
        setIsGeneratingAiPricing(false);
        return;
      }

      // Gather already-priced items from this proposal for context
      const pricedItemsInProposal = draftItems
        .filter(i => i.fee_amount && i.fee_amount > 0)
        .map(i => ({
          work_item: i.work_item,
          provider: i.provider,
          category: i.category,
          fee_amount: i.fee_amount,
        }));

      const { data, error } = await supabase.functions.invoke('suggest-pricing', {
        body: {
          items: itemsNeedingPricing.map(i => ({
            work_item: i.work_item,
            detail: i.detail || null,
            provider: i.provider,
            category: i.category,
          })),
          currency: proposal?.currency,
          proposalId,
          pricedItemsInProposal: pricedItemsInProposal.map(p => ({
            ...p,
            detail: draftItems.find(d => d.work_item === p.work_item)?.detail || null,
          })),
        },
      });

      if (error) throw error;

      if (data.prices) {
        // Build updated items with AI pricing applied
        const updatedItems = draftItems.map(item => {
          // Only update items that are selected AND have no price AND not locked
          if (item.is_included && (!item.fee_amount || item.fee_amount === 0) && !isItemLocked(item)) {
            // Match by checking if the AI response work_item contains or starts with the original work_item
            const priceInfo = data.prices.find((p: any) => 
              p.work_item === item.work_item || 
              p.work_item?.startsWith(item.work_item) ||
              item.work_item?.startsWith(p.work_item)
            );
            if (priceInfo) {
              const feeUpper = priceInfo.fee_amount || 0;
              // Calculate fee_lower based on category risk (10-20% spread)
              const { fee_lower, fee_amount } = calculateFeeRange(feeUpper, item.category);
              
              return {
                ...item,
                fee_amount,
                fee_lower,
                fee_upper: feeUpper,
                pricing_method: 'ai_suggested' as PricingMethod,
                ai_rationale: priceInfo.rationale || 'AI suggested pricing',
              };
            }
          }
          return item;
        });
        
        // Update local state
        setDraftItems(updatedItems);
        
        // IMPORTANT: Immediately persist AI pricing to prevent loss
        // Clear any pending auto-save timeout and save immediately
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        
        // Update refs with the new data before saving
        draftItemsRef.current = updatedItems;
        pendingChangesRef.current = true;
        
        // Perform immediate save (silent)
        await performSave(false);
        
        toast({ 
          title: 'AI pricing applied and saved', 
          description: `Updated ${itemsNeedingPricing.length} selected item(s)`
        });
      }
    } catch (error: any) {
      console.error('AI pricing error:', error);
      toast({ title: 'Failed to generate pricing', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingAiPricing(false);
    }
  };

  // AI Target Pricing - allocate a target budget across selected items in a phase
  const generateTargetPricing = async () => {
    const targetAmount = parseFloat(targetPricingAmount);
    if (!targetAmount || targetAmount <= 0) {
      toast({ title: 'Please enter a valid target amount', variant: 'destructive' });
      return;
    }

    setIsAllocatingTargetPricing(true);
    try {
      // Get items to price based on phase selection, excluding locked items
      let itemsToPriceIndices: number[] = [];
      let lockedFeeTotal = 0;
      
      if (targetPricingPhaseId === 'all') {
        // All selected items across all phases
        draftItems.forEach((item, idx) => {
          if (item.is_included) {
            if (isItemLocked(item)) {
              lockedFeeTotal += item.fee_upper ?? item.fee_amount ?? 0;
            } else {
              itemsToPriceIndices.push(idx);
            }
          }
        });
      } else if (targetPricingPhaseId === 'unassigned') {
        draftItems.forEach((item, idx) => {
          if (item.is_included && !item.phase_id) {
            if (isItemLocked(item)) {
              lockedFeeTotal += item.fee_upper ?? item.fee_amount ?? 0;
            } else {
              itemsToPriceIndices.push(idx);
            }
          }
        });
      } else {
        draftItems.forEach((item, idx) => {
          if (item.is_included && item.phase_id === targetPricingPhaseId) {
            if (isItemLocked(item)) {
              lockedFeeTotal += item.fee_upper ?? item.fee_amount ?? 0;
            } else {
              itemsToPriceIndices.push(idx);
            }
          }
        });
      }

      // Subtract locked fees from target - unlocked items must absorb the remainder
      const adjustedTarget = Math.max(0, targetAmount - lockedFeeTotal);

      if (itemsToPriceIndices.length === 0) {
        toast({ 
          title: 'No selected items found', 
          description: 'Select items using checkboxes before applying target pricing',
          variant: 'destructive'
        });
        setIsAllocatingTargetPricing(false);
        return;
      }

      const itemsToPrice = itemsToPriceIndices.map(idx => draftItems[idx]);
      const phaseName = targetPricingPhaseId === 'all' 
        ? 'Entire Project' 
        : targetPricingPhaseId === 'unassigned'
          ? 'Unassigned Items'
          : phases.find(p => p.id === targetPricingPhaseId)?.name || 'Selected Phase';

      const { data, error } = await supabase.functions.invoke('allocate-target-pricing', {
        body: {
          items: itemsToPrice.map(i => ({
            work_item: i.work_item,
            detail: i.detail || null,
            provider: i.provider,
            category: i.category,
          })),
          targetAmount: adjustedTarget,
          currency: proposal?.currency,
          phaseName,
        },
      });

      if (error) throw error;

      if (data.allocations) {
        // Validate: reject if any allocation is negative
        const hasNegative = data.allocations.some((a: any) => (a.fee_amount || 0) < 0);
        if (hasNegative) {
          throw new Error('AI returned negative fee amounts. Please try again.');
        }

        // Build updated items with allocated pricing
        const updatedItems = [...draftItems];
        
        for (const allocation of data.allocations) {
          // Find matching item index
          const matchIdx = itemsToPriceIndices.find(idx => {
            const item = draftItems[idx];
            return item.work_item === allocation.work_item || 
              item.work_item?.startsWith(allocation.work_item) ||
              allocation.work_item?.startsWith(item.work_item);
          });
          
          if (matchIdx !== undefined) {
            const feeUpper = Math.max(allocation.fee_amount || 0, 0);
            // Calculate fee_lower based on category risk (10-20% spread)
            const category = draftItems[matchIdx]?.category;
            const { fee_lower, fee_amount } = calculateFeeRange(feeUpper, category);
            
            updatedItems[matchIdx] = {
              ...updatedItems[matchIdx],
              fee_amount,
              fee_lower,
              fee_upper: feeUpper,
              pricing_method: 'ai_suggested' as PricingMethod,
              ai_rationale: allocation.rationale || 'AI allocated from target budget',
            };
          }
        }
        
        // Update local state
        setDraftItems(updatedItems);
        
        // Immediately persist
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        draftItemsRef.current = updatedItems;
        pendingChangesRef.current = true;
        await performSave(false);
        
        setIsTargetPricingDialogOpen(false);
        setTargetPricingAmount("");
        
        const scaleInfo = data.scaleFactor ? ` (base estimate scaled ${data.scaleFactor}%)` : '';
        toast({ 
          title: 'Target pricing allocated and saved', 
          description: `Allocated ${currencySymbol}${targetAmount.toLocaleString()} across ${itemsToPriceIndices.length} item(s)${scaleInfo}`
        });
      }
    } catch (error: any) {
      console.error('Target pricing error:', error);
      toast({ title: 'Failed to allocate pricing', description: error.message, variant: 'destructive' });
    } finally {
      setIsAllocatingTargetPricing(false);
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

  // Export dialog state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [includeInputHighlighting, setIncludeInputHighlighting] = useState(true);
  const [includeTeamBreakdown, setIncludeTeamBreakdown] = useState(false);
  const [hideUpperAndPcSum, setHideUpperAndPcSum] = useState(false);

  // Check if any items have internal input dept assigned
  const hasInternalInputDepts = useMemo(() => {
    return draftItems.some(item => item.internal_input_dept);
  }, [draftItems]);

  const handleExportClick = () => {
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

    // Always show dialog for export options
    setIsExportDialogOpen(true);
  };

  const performExport = async () => {
    setIsExportDialogOpen(false);

    // Build team member summary data for export
    const teamMemberSummaryData = summary.teamMembers.map(m => ({
      key: m.key,
      label: m.label,
      rate: m.rate,
      hours: m.hours,
      revenue: m.revenue,
    }));
    
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
      groupedAssumptionNarratives: getGroupedAssumptionNarratives(scopeAssumptions),
      workPhases: phases.filter(p => p.is_included !== false),
      includeInputDeptHighlighting: hasInternalInputDepts && includeInputHighlighting,
      existingInputDepts: existingInputDepts,
      includeTeamBreakdown,
      teamMembers: teamMemberSummaryData,
      teamCurrency: proposal?.currency || 'GBP',
      hideUpperAndPcSum,
    });
    
    toast({ 
      title: 'Exported to Excel', 
      description: enabledAFAs.length > 0 
        ? `AFA-adjusted figures exported with ${enabledAFAs.length} fee arrangement(s) applied`
        : 'Baseline figures exported'
    });
  };

  // Handle navigation from category breakdown tiles
  const handleNavigateToCategory = useCallback((phaseId: string | null, category: string) => {
    if (phasedWorkItemsRef.current) {
      phasedWorkItemsRef.current.navigateToPhaseCategory(phaseId, category);
    }
  }, []);

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
      assumption_linked: (item as any).assumption_linked ?? false,
      assumption_text: (item as any).assumption_text || null,
      alt_fee_lower: (item as any).alt_fee_lower ?? 0,
      alt_fee_upper: (item as any).alt_fee_upper ?? 0,
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
      assumption_linked: (item as any).assumption_linked ?? false,
      assumption_text: (item as any).assumption_text || null,
      alt_fee_lower: (item as any).alt_fee_lower ?? 0,
      alt_fee_upper: (item as any).alt_fee_upper ?? 0,
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
                <Button variant="outline" onClick={handleExportClick}>
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
                        {showAssumptionsNotTrue && altTotals && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            If assumptions not all true: {formatCurrency(altTotals.total)}
                          </p>
                        )}
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
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
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
                  {showAssumptionsNotTrue && altTotals && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      If assumptions not all true: {formatCurrency(altTotals.lowerTotal)} - {formatCurrency(altTotals.upperTotal)}
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Baker McKenzie</p>
                  <p className="text-2xl font-bold">{formatCurrency(workItemTotals.bmTotal)}</p>
                  {showAssumptionsNotTrue && altTotals && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      If assumptions not all true: {formatCurrency(altTotals.bmTotal)}
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Local Counsel</p>
                  <p className="text-2xl font-bold">{formatCurrency(workItemTotals.localCounselTotal)}</p>
                  {showAssumptionsNotTrue && altTotals && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      If assumptions not all true: {formatCurrency(altTotals.lcTotal)}
                    </p>
                  )}
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
                    onClick={() => setIsAiPricingConfirmOpen(true)}
                    disabled={isGeneratingAiPricing}
                  >
                    {isGeneratingAiPricing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    AI Price Selected Items
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsTargetPricingDialogOpen(true)}
                    disabled={isAllocatingTargetPricing || draftItems.filter(i => i.is_included).length === 0}
                  >
                    {isAllocatingTargetPricing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Target className="h-4 w-4 mr-2" />
                    )}
                    AI Price to Target
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsScalePricingOpen(true)}
                    disabled={draftItems.filter(i => i.is_included && (i.fee_upper ?? i.fee_amount ?? 0) > 0).length === 0}
                  >
                    <Scale className="h-4 w-4 mr-2" />
                    Scale Pricing
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
                </CardContent>
              </Card>
            )}

            {/* Add Work Item Dialog */}
            <AddWorkItemDialog
              open={isAddWorkItemDialogOpen}
              onOpenChange={setIsAddWorkItemDialogOpen}
              onAdd={handleAddWorkItem}
              phases={phases}
              customCategories={customCategories}
              onAddCustomCategory={addCustomCategory}
              currencySymbol={currencySymbol}
            />

            {/* Scale Pricing Wizard */}
            <ScalePricingWizard
              open={isScalePricingOpen}
              onOpenChange={setIsScalePricingOpen}
              items={draftItems}
              phases={phases}
              currencySymbol={currencySymbol}
              lockedCategories={lockedCategories}
              isItemLocked={isItemLocked}
              onApply={(scaledItems) => {
                setDraftItems(prev => {
                  const next = [...prev];
                  scaledItems.forEach(({ index, fee_upper, fee_lower, fee_amount }) => {
                    next[index] = { ...next[index], fee_upper, fee_lower, fee_amount, pricing_method: 'manual' as const };
                  });
                  return next;
                });
                setHasUnsavedChanges(true);
                toast({
                  title: `Scaled ${scaledItems.length} item${scaledItems.length !== 1 ? 's' : ''}`,
                  description: `Factor ×${(scaledItems.length > 0 ? (scaledItems[0].fee_upper / (draftItems[scaledItems[0].index].fee_upper || draftItems[scaledItems[0].index].fee_amount || 1)) : 1).toFixed(2)}`,
                });
              }}
            />

            {draftItems.length > 0 && !viewingHistoricalVersion && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base">Category Breakdown (Upper Estimate)</CardTitle>
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
                    phases={phases}
                    onItemsChange={(updatedItems) => {
                      setDraftItems(updatedItems);
                      setHasUnsavedChanges(true);
                    }}
                    formatCurrency={formatCurrency}
                    currencySymbol={currencySymbol}
                    customCategories={customCategories}
                    onNavigateToCategory={handleNavigateToCategory}
                    showAssumptionsNotTrue={showAssumptionsNotTrue}
                    onToggleAssumptionsNotTrue={setShowAssumptionsNotTrue}
                    lockedCategories={lockedCategories}
                    onToggleLock={handleToggleCategoryLock}
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
                    <div className="text-right">
                      <span className="text-sm font-normal text-muted-foreground">
                        {formatCurrency(workItemTotals.lowerTotal)} – {formatCurrency(workItemTotals.upperTotal)}
                      </span>
                      {showAssumptionsNotTrue && altTotals && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          If assumptions not all true: {formatCurrency(altTotals.lowerTotal)} – {formatCurrency(altTotals.upperTotal)}
                        </p>
                      )}
                    </div>
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
                  ref={phasedWorkItemsRef}
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
                  onDuplicateItem={duplicateItem}
                  onOpenIterativePricing={openIterativePricing}
                  formatCurrency={formatCurrency}
                  viewingHistoricalVersion={viewingHistoricalVersion}
                  customCategories={customCategories}
                  onAddCustomCategory={addCustomCategory}
                  existingInputDepts={existingInputDepts}
                  assumptionNarratives={getAssumptionNarratives(scopeAssumptions)}
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
                showAssumptionsNotTrue={showAssumptionsNotTrue}
                altTotals={altTotals}
              />
            </div>
          </TabsContent>

          {/* SUMMARY TAB */}
          <TabsContent value="summary" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-[140px]">
                      <p className="text-sm font-medium text-muted-foreground">Upper Estimate (Target)</p>
                      <p className="text-2xl font-bold tabular-nums">{formatCurrency(summary.bmUpperTarget)}</p>
                      <p className={cn(
                        "text-xs mt-1 min-h-[1rem]",
                        showAssumptionsNotTrue && altTotals ? "text-amber-600 dark:text-amber-400" : "invisible"
                      )}>
                        {showAssumptionsNotTrue && altTotals
                          ? `If assumptions not all true: ${formatCurrency(altTotals.bmTotal)}`
                          : '\u00A0'}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-[140px]">
                      <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                      <p className="text-2xl font-bold tabular-nums">{formatHours(summary.totalHours)}</p>
                    </div>
                    <Clock className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-[140px]">
                      <p className="text-sm font-medium text-muted-foreground">Blended Rate</p>
                      <p className="text-2xl font-bold tabular-nums">{formatCurrency(summary.blendedRate)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <SummaryPyramid
              teamMembers={summary.teamMembers}
              formatCurrency={formatCurrency}
              formatHours={formatHours}
            />

            {/* Fixed-height container — never shifts layout */}
            <div className="min-h-[52px]">
              <Alert className={cn(
                "border transition-opacity duration-200",
                Math.abs(summary.delta) < 100 && "opacity-0 pointer-events-none",
                summary.delta > 0
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                  : "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
              )}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {summary.delta > 0
                    ? `Revenue exceeds upper estimate by ${formatCurrency(summary.delta)}. Reduce hours or unlock team members to rebalance.`
                    : `Revenue is ${formatCurrency(Math.abs(summary.delta))} below upper estimate. Add hours to unlocked team members.`
                  }
                </AlertDescription>
              </Alert>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Fee Breakdown by Team Member</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Edit hours to adjust allocation. Lock members to prevent auto-rebalancing.
                  Rates can only be changed in Team & Rates tab.
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Team Member</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Rate ({currencySymbol})</TableHead>
                      <TableHead className="text-right">Revenue ({currencySymbol})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.teamMembers.map((member) => (
                      <SummarySliderRow
                        key={member.key}
                        memberKey={member.key}
                        label={member.label}
                        hours={member.hours}
                        rate={member.rate}
                        revenue={member.revenue}
                        isLocked={member.isLocked}
                        formatCurrency={formatCurrency}
                        onHoursCommit={handleSummaryHoursChange}
                        onToggleLock={toggleSummaryLock}
                      />
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell></TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">{formatHours(summary.totalHours)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(summary.blendedRate)} (blended)</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="tabular-nums">{formatCurrency(summary.totalRevenue)}</span>
                          <span className="text-xs font-normal text-muted-foreground tabular-nums">
                            Target: {formatCurrency(summary.bmUpperTarget)}
                          </span>
                          {showAssumptionsNotTrue && altTotals && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                              If assumptions not all true: {formatCurrency(altTotals.bmTotal)}
                            </span>
                          )}
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
              onChange={useCallback((newTeamRateCard: RateCard, newFeeRateCard: RateCard) => {
                setRateCard(newTeamRateCard);
                setFeeRateCardOverride(newFeeRateCard);
              }, [])}
              onSave={async (newTeamRateCard, newFeeRateCard) => {
                setRateCard(newTeamRateCard);
                setFeeRateCardOverride(newFeeRateCard);
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
              {/* Auto-save status indicator */}
              <span className="text-sm text-muted-foreground mr-auto flex items-center gap-2">
                {autoSaveStatus === 'saving' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </>
                )}
                {autoSaveStatus === 'saved' && (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    All changes saved
                  </>
                )}
                {autoSaveStatus === 'idle' && hasUnsavedChanges && (
                  <span className="text-muted-foreground">
                    Auto-saving in a few seconds...
                  </span>
                )}
                {autoSaveStatus === 'idle' && !hasUnsavedChanges && (
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    All changes saved
                  </span>
                )}
              </span>
              <Button onClick={() => setIsAddWorkItemDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
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

        {/* Export Options Dialog */}
        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Options</DialogTitle>
              <DialogDescription>
                Choose what to include in the Excel export.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {hasInternalInputDepts && (
                <div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-highlighting"
                      checked={includeInputHighlighting}
                      onCheckedChange={(checked) => setIncludeInputHighlighting(!!checked)}
                    />
                    <label htmlFor="include-highlighting" className="text-sm font-medium leading-none">
                      Include department highlighting
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    Adds color-coded rows and a "BM Input From" column.
                  </p>
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-team-breakdown"
                    checked={includeTeamBreakdown}
                    onCheckedChange={(checked) => setIncludeTeamBreakdown(!!checked)}
                  />
                  <label htmlFor="include-team-breakdown" className="text-sm font-medium leading-none">
                    Include team member breakdown
                  </label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Adds a section showing each team member, their rate, allocated hours, and estimated fees.
                </p>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hide-upper-pc-sum"
                    checked={hideUpperAndPcSum}
                    onCheckedChange={(checked) => setHideUpperAndPcSum(!!checked)}
                  />
                  <label htmlFor="hide-upper-pc-sum" className="text-sm font-medium leading-none">
                    Hide Estimate &amp; PC Sum columns
                  </label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Removes the "Estimate" and "PC Sum?" columns from the exported file.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => performExport()}>
                <FileDown className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Pricing Confirmation Dialog */}
        <AlertDialog open={isAiPricingConfirmOpen} onOpenChange={setIsAiPricingConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Confirm AI Pricing
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  AI pricing will be applied to all <strong>selected items</strong> that don't already have a price.
                </p>
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Please ensure you have <strong>deselected</strong> any work items you wish to remain unchanged before proceeding.
                </p>
                <p className="text-sm text-muted-foreground">
                  Items with existing prices will not be overwritten.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  setIsAiPricingConfirmOpen(false);
                  generateAiPricing();
                }}
              >
                Proceed with AI Pricing
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Target Pricing Dialog */}
        <Dialog open={isTargetPricingDialogOpen} onOpenChange={setIsTargetPricingDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                AI Price to Target
              </DialogTitle>
              <DialogDescription>
                Set a target budget and AI will intelligently allocate it across the selected work items.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Phase selector */}
              <div className="space-y-2">
                <Label htmlFor="target-phase">Scope</Label>
                <Select value={targetPricingPhaseId} onValueChange={setTargetPricingPhaseId}>
                  <SelectTrigger id="target-phase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Selected Items ({draftItems.filter(i => i.is_included).length} items)
                    </SelectItem>
                    {phases.map(phase => {
                      const phaseItems = draftItems.filter(i => i.is_included && i.phase_id === phase.id);
                      return (
                        <SelectItem key={phase.id} value={phase.id} disabled={phaseItems.length === 0}>
                          {phase.name} ({phaseItems.length} items)
                        </SelectItem>
                      );
                    })}
                    {(() => {
                      const unassignedItems = draftItems.filter(i => i.is_included && !i.phase_id);
                      return (
                        <SelectItem value="unassigned" disabled={unassignedItems.length === 0}>
                          Unassigned Items ({unassignedItems.length} items)
                        </SelectItem>
                      );
                    })()}
                  </SelectContent>
                </Select>
              </div>

              {/* Current total preview */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Total (Selected):</span>
                  <span className="font-medium">
                    {currencySymbol}
                    {(() => {
                      let items = draftItems.filter(i => i.is_included);
                      if (targetPricingPhaseId !== 'all') {
                        if (targetPricingPhaseId === 'unassigned') {
                          items = items.filter(i => !i.phase_id);
                        } else {
                          items = items.filter(i => i.phase_id === targetPricingPhaseId);
                        }
                      }
                      return items.reduce((sum, i) => sum + (i.fee_amount || 0), 0).toLocaleString();
                    })()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items to allocate:</span>
                  <span className="font-medium">
                    {(() => {
                      let items = draftItems.filter(i => i.is_included);
                      if (targetPricingPhaseId !== 'all') {
                        if (targetPricingPhaseId === 'unassigned') {
                          items = items.filter(i => !i.phase_id);
                        } else {
                          items = items.filter(i => i.phase_id === targetPricingPhaseId);
                        }
                      }
                      return items.length;
                    })()}
                  </span>
                </div>
              </div>

              {/* Target amount input */}
              <div className="space-y-2">
                <Label htmlFor="target-amount">Target Budget ({proposal?.currency || 'GBP'})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    id="target-amount"
                    type="text"
                    inputMode="numeric"
                    value={targetPricingAmount}
                    onChange={(e) => {
                      // Allow only numbers and commas
                      const value = e.target.value.replace(/[^0-9,]/g, '');
                      setTargetPricingAmount(value);
                    }}
                    placeholder="e.g., 150,000"
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  AI will allocate this total across all selected items based on complexity and historical data.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTargetPricingDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={generateTargetPricing} 
                disabled={!targetPricingAmount || isAllocatingTargetPricing}
              >
                {isAllocatingTargetPricing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Target className="h-4 w-4 mr-2" />
                )}
                Allocate Budget
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
