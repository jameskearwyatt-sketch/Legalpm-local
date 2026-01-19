import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  TrendingDown, 
  TrendingUp,
  Shield,
  DollarSign,
  Percent,
  Calculator,
  FileDown,
  Plus,
  Trash2,
  Loader2,
  Clock,
  Target,
  Layers,
  Ban,
  Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useProposalAFAs,
  AFAType,
  AFA_TYPE_LABELS,
  AFA_TYPE_DESCRIPTIONS,
  calculateRiskIndicator,
  getDefaultConfig,
  FeeCapConfig,
  BlendedRateConfig,
  FixedFeeWholeConfig,
  FixedFeePhaseConfig,
  FeeCollarConfig,
  MilestoneConfig,
  MonthlyRetainerConfig,
  DiscountedRatesConfig,
  SuccessFeeConfig,
  ProposalAFA,
} from '@/lib/hooks/useProposalAFAs';
import { DraftProposalItem, BUDGET_CATEGORIES, RateCard, ProposalAssumptions } from '@/lib/hooks/usePricingProposals';
import { 
  checkAFACompatibility, 
  getActiveRateModifier, 
  isRateModifierUsedAsBasis,
  getLayeringExplanation,
} from '@/lib/afaCompatibility';

interface AFATabProps {
  proposalId: string;
  draftItems: DraftProposalItem[];
  rateCard: RateCard;
  assumptions: ProposalAssumptions;
  currencySymbol: string;
  formatCurrency: (value: number) => string;
  baselineTotals: {
    bmTotal: number;
    localCounselTotal: number;
    total: number;
    totalHours: number;
    blendedRate: number;
    margin: number;
    marginPercent: number;
    totalCost: number;
  };
  customCategories?: string[];
  onDiscountChange?: (discountPercent: number) => void;
}

// Grouped AFA types matching the layering logic
const AFA_GROUPS = [
  {
    id: 'rate_modifiers',
    label: 'Rate Modifiers',
    description: 'Choose one to modify how rates are calculated. Can be used as basis for fixed fees.',
    icon: 'Percent',
    types: ['discounted_rates', 'blended_rate'] as AFAType[],
  },
  {
    id: 'pricing_models',
    label: 'Pricing Models',
    description: 'Choose how to structure the final fee. Fixed fees and caps are mutually exclusive.',
    icon: 'Calculator',
    types: ['fixed_fee_whole', 'fixed_fee_phase', 'fee_cap', 'fee_collar', 'milestone', 'monthly_retainer'] as AFAType[],
  },
  {
    id: 'add_ons',
    label: 'Add-ons',
    description: 'Can be combined with any pricing model above.',
    icon: 'Plus',
    types: ['success_fee'] as AFAType[],
  },
];

// Flat list for backward compatibility
const AFA_TYPES: AFAType[] = AFA_GROUPS.flatMap(g => g.types);

export function AFATab({
  proposalId,
  draftItems,
  rateCard,
  assumptions,
  currencySymbol,
  formatCurrency,
  baselineTotals,
  customCategories = [],
  onDiscountChange,
}: AFATabProps) {
  const { afas, isLoading, upsertAFA, toggleAFA, selectForExport } = useProposalAFAs(proposalId);
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [showAutoSaved, setShowAutoSaved] = useState(false);

  // Show auto-saved indicator briefly after mutations
  useEffect(() => {
    if (upsertAFA.isSuccess || toggleAFA.isSuccess) {
      setShowAutoSaved(true);
      const timer = setTimeout(() => setShowAutoSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [upsertAFA.isSuccess, toggleAFA.isSuccess]);

  // Get the discounted rates AFA (for external consumption)
  const discountedRatesAFA = afas.find(a => a.afa_type === 'discounted_rates' && a.is_enabled);
  const activeDiscountPercent = discountedRatesAFA 
    ? (discountedRatesAFA.config as DiscountedRatesConfig).discountPercent 
    : 0;

  // Notify parent when discount changes
  useEffect(() => {
    if (onDiscountChange) {
      onDiscountChange(activeDiscountPercent);
    }
  }, [activeDiscountPercent, onDiscountChange]);

  const allCategories = useMemo(() => {
    return [...BUDGET_CATEGORIES, ...customCategories];
  }, [customCategories]);

  // Calculate category totals for phase-based pricing
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    draftItems
      .filter(item => !item.is_optional || item.is_included !== false)
      .forEach(item => {
        const category = item.category || 'Other';
        totals[category] = (totals[category] || 0) + (item.fee_amount || 0);
      });
    return totals;
  }, [draftItems]);

  // Get enabled AFA types for compatibility checking
  const enabledAFATypes = useMemo(() => {
    return afas.filter(a => a.is_enabled).map(a => a.afa_type);
  }, [afas]);

  // Get active rate modifier for basis calculations
  const activeRateModifier = useMemo(() => {
    return getActiveRateModifier(enabledAFATypes);
  }, [enabledAFATypes]);

  // Calculate adjusted category totals when rate modifier is active
  const adjustedCategoryTotals = useMemo(() => {
    if (!activeRateModifier) return categoryTotals;
    
    const rateModifierAFA = afas.find(a => a.afa_type === activeRateModifier && a.is_enabled);
    if (!rateModifierAFA) return categoryTotals;
    
    let multiplier = 1;
    if (activeRateModifier === 'discounted_rates') {
      const config = rateModifierAFA.config as DiscountedRatesConfig;
      multiplier = 1 - config.discountPercent / 100;
    }
    
    const adjusted: Record<string, number> = {};
    Object.entries(categoryTotals).forEach(([cat, amount]) => {
      adjusted[cat] = amount * multiplier;
    });
    return adjusted;
  }, [categoryTotals, activeRateModifier, afas]);

  // Calculate the adjusted baseline based on active rate modifier
  const adjustedBaseline = useMemo(() => {
    if (!activeRateModifier) return baselineTotals;
    
    const rateModifierAFA = afas.find(a => a.afa_type === activeRateModifier && a.is_enabled);
    if (!rateModifierAFA) return baselineTotals;
    
    if (activeRateModifier === 'discounted_rates') {
      const config = rateModifierAFA.config as DiscountedRatesConfig;
      const multiplier = 1 - config.discountPercent / 100;
      return {
        ...baselineTotals,
        bmTotal: baselineTotals.bmTotal * multiplier,
        total: baselineTotals.bmTotal * multiplier + baselineTotals.localCounselTotal,
      };
    }
    
    if (activeRateModifier === 'blended_rate') {
      const config = rateModifierAFA.config as BlendedRateConfig;
      const rate = config.useManual && config.manualRate ? config.manualRate : config.calculatedRate;
      const adjustedBmTotal = rate * baselineTotals.totalHours;
      return {
        ...baselineTotals,
        bmTotal: adjustedBmTotal,
        total: adjustedBmTotal + baselineTotals.localCounselTotal,
        blendedRate: rate,
      };
    }
    
    return baselineTotals;
  }, [activeRateModifier, afas, baselineTotals]);

  // Get AFA by type
  const getAFA = (type: AFAType): ProposalAFA | undefined => {
    return afas.find(a => a.afa_type === type);
  };

  // Calculate client price for each AFA type
  // For fixed fee variants, use the adjusted baseline when a rate modifier is active
  const calculateClientPrice = (type: AFAType, config: any): number => {
    // Fixed fees should use adjusted baseline if rate modifier is active
    const useAdjustedBaseline = ['fixed_fee_whole', 'fixed_fee_phase'].includes(type);
    const baseline = useAdjustedBaseline ? adjustedBaseline.total : baselineTotals.total;
    
    switch (type) {
      case 'fee_cap': {
        const cfg = config as FeeCapConfig;
        if (cfg.capType === 'amount') {
          return Math.min(baseline, cfg.capAmount);
        }
        return baseline * (1 + cfg.capPercentageAbove / 100);
      }
      case 'blended_rate': {
        const cfg = config as BlendedRateConfig;
        const rate = cfg.useManual && cfg.manualRate ? cfg.manualRate : cfg.calculatedRate;
        return rate * baselineTotals.totalHours;
      }
      case 'fixed_fee_whole': {
        const cfg = config as FixedFeeWholeConfig;
        if (cfg.adjustedFee !== null) return cfg.adjustedFee;
        // Use adjusted baseline (includes rate modifier if active)
        return baseline * (1 + cfg.riskPremiumPercent / 100);
      }
      case 'fixed_fee_phase': {
        const cfg = config as FixedFeePhaseConfig;
        return cfg.phases
          .filter(p => p.isIncluded)
          .reduce((sum, p) => {
            const adjusted = p.baseAmount * (1 + p.adjustmentPercent / 100);
            return sum + (cfg.roundToNearest1000 ? Math.round(adjusted / 1000) * 1000 : Math.round(adjusted));
          }, 0);
      }
      case 'fee_collar': {
        const cfg = config as FeeCollarConfig;
        return cfg.targetFee || baseline;
      }
      case 'milestone': {
        const cfg = config as MilestoneConfig;
        return cfg.milestones.reduce((sum, m) => sum + m.amount, 0);
      }
      case 'monthly_retainer': {
        const cfg = config as MonthlyRetainerConfig;
        return cfg.monthlyFee * cfg.durationMonths;
      }
      case 'discounted_rates': {
        const cfg = config as DiscountedRatesConfig;
        return baselineTotals.total * (1 - cfg.discountPercent / 100);
      }
      case 'success_fee': {
        const cfg = config as SuccessFeeConfig;
        // Success fee uses the final client price from the primary pricing model
        const basePrice = adjustedBaseline.total;
        const uplift = cfg.upliftAmount || Math.round(basePrice * (cfg.upliftPercent / 100));
        return basePrice + uplift;
      }
      default:
        return baseline;
    }
  };

  // Calculate effective rate
  const calculateEffectiveRate = (clientPrice: number): number => {
    if (baselineTotals.totalHours === 0) return 0;
    return clientPrice / baselineTotals.totalHours;
  };

  // Calculate margin impact
  const calculateMarginImpact = (clientPrice: number): number => {
    if (clientPrice === 0) return 0;
    const newMargin = clientPrice - baselineTotals.totalCost;
    return (newMargin / clientPrice) * 100;
  };

  // Track previous baseline to detect changes
  const [prevBaselineTotal, setPrevBaselineTotal] = useState<number | null>(null);

  // Auto-recalculate all enabled AFAs when baseline totals change
  useEffect(() => {
    // Skip initial render or if loading
    if (isLoading || prevBaselineTotal === null) {
      setPrevBaselineTotal(baselineTotals.total);
      return;
    }

    // Only recalculate if total has meaningfully changed (more than $1 difference)
    if (Math.abs(baselineTotals.total - prevBaselineTotal) < 1) {
      return;
    }

    setPrevBaselineTotal(baselineTotals.total);

    // Find all enabled AFAs and recalculate their client prices
    const enabledAfas = afas.filter(a => a.is_enabled);
    if (enabledAfas.length === 0) return;

    // Recalculate each enabled AFA with updated baseline
    const recalculateEnabledAFAs = async () => {
      for (const afa of enabledAfas) {
        const newClientPrice = calculateClientPrice(afa.afa_type, afa.config);
        const newEffectiveRate = calculateEffectiveRate(newClientPrice);
        const newMarginImpact = calculateMarginImpact(newClientPrice);

        // Only update if the price has changed
        if (Math.abs(newClientPrice - afa.client_price) > 1) {
          await upsertAFA.mutateAsync({
            afa_type: afa.afa_type,
            is_enabled: true,
            config: afa.config,
            client_price: newClientPrice,
            effective_rate: newEffectiveRate,
            margin_impact_percent: newMarginImpact,
          });
        }
      }
    };

    recalculateEnabledAFAs();
  }, [baselineTotals.total, baselineTotals.bmTotal, baselineTotals.totalHours]);

  // Handle config change
  const handleConfigChange = async (type: AFAType, config: any) => {
    const clientPrice = calculateClientPrice(type, config);
    const effectiveRate = calculateEffectiveRate(clientPrice);
    const marginImpact = calculateMarginImpact(clientPrice);

    await upsertAFA.mutateAsync({
      afa_type: type,
      is_enabled: getAFA(type)?.is_enabled ?? true,
      config,
      client_price: clientPrice,
      effective_rate: effectiveRate,
      margin_impact_percent: marginImpact,
    });
  };

  // Handle toggle - calculate and save initial price when enabling
  // Also handles mutual exclusivity by disabling conflicting AFAs
  const handleToggle = async (type: AFAType, enabled: boolean) => {
    if (enabled) {
      // Check compatibility
      const compatibility = checkAFACompatibility(type, enabledAFATypes);
      
      // Disable any conflicting AFAs first
      if (compatibility.blockedBy.length > 0) {
        for (const conflictType of compatibility.blockedBy) {
          await toggleAFA.mutateAsync({ afaType: conflictType, enabled: false });
        }
      }
      
      // When enabling, calculate the initial price with default config
      const existingAfa = getAFA(type);
      const config = existingAfa?.config || getDefaultConfig(type);
      const clientPrice = calculateClientPrice(type, config);
      const effectiveRate = calculateEffectiveRate(clientPrice);
      const marginImpact = calculateMarginImpact(clientPrice);
      
      await upsertAFA.mutateAsync({
        afa_type: type,
        is_enabled: true,
        config,
        client_price: clientPrice,
        effective_rate: effectiveRate,
        margin_impact_percent: marginImpact,
      });
    } else {
      await toggleAFA.mutateAsync({ afaType: type, enabled: false });
    }
    
    // Auto-expand on enable, auto-collapse on disable
    if (enabled) {
      if (!expandedTypes.includes(type)) {
        setExpandedTypes(prev => [...prev, type]);
      }
    } else {
      setExpandedTypes(prev => prev.filter(t => t !== type));
    }
  };


  // Render risk indicator badge
  const RiskBadge = ({ clientPrice, marginPercent }: { clientPrice: number; marginPercent: number }) => {
    const risk = calculateRiskIndicator(baselineTotals.total, clientPrice, marginPercent);
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge 
              variant="outline" 
              className={cn(
                'gap-1',
                risk.level === 'green' && 'border-green-500 text-green-700 dark:text-green-400',
                risk.level === 'amber' && 'border-amber-500 text-amber-700 dark:text-amber-400',
                risk.level === 'red' && 'border-red-500 text-red-700 dark:text-red-400'
              )}
            >
              {risk.level === 'green' && <CheckCircle2 className="h-3 w-3" />}
              {risk.level === 'amber' && <AlertTriangle className="h-3 w-3" />}
              {risk.level === 'red' && <AlertTriangle className="h-3 w-3" />}
              {risk.level === 'green' ? 'OK' : risk.level === 'amber' ? 'Review' : 'Alert'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{risk.message}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Render Fee Cap configuration
  const renderFeeCapConfig = (afa: ProposalAFA | undefined) => {
    const config = (afa?.config || getDefaultConfig('fee_cap')) as FeeCapConfig;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Cap Type</Label>
            <Select 
              value={config.capType} 
              onValueChange={(v) => handleConfigChange('fee_cap', { ...config, capType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage above estimate</SelectItem>
                <SelectItem value="amount">Fixed cap amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {config.capType === 'percentage' ? (
            <div className="space-y-2">
              <Label>Cap at % above estimate</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.capPercentageAbove}
                  onChange={(e) => handleConfigChange('fee_cap', { ...config, capPercentageAbove: parseFloat(e.target.value) || 0 })}
                  className="w-24"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Cap Amount ({currencySymbol})</Label>
              <Input
                type="number"
                value={config.capAmount}
                onChange={(e) => handleConfigChange('fee_cap', { ...config, capAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Client-facing price</p>
          <p className="text-xl font-bold">
            {formatCurrency(calculateClientPrice('fee_cap', config))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Time-based billing up to this cap
          </p>
        </div>
      </div>
    );
  };

  // Render Blended Rate configuration
  const renderBlendedRateConfig = (afa: ProposalAFA | undefined) => {
    const calculatedBlendedRate = baselineTotals.blendedRate;
    const config = (afa?.config || { 
      ...getDefaultConfig('blended_rate'), 
      calculatedRate: calculatedBlendedRate 
    }) as BlendedRateConfig;
    
    const activeRate = config.useManual && config.manualRate ? config.manualRate : calculatedBlendedRate;
    
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Calculated Weighted Average Rate</p>
          <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
            {currencySymbol}{Math.round(calculatedBlendedRate)}/hr
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Based on estimated hours by grade
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Switch
            checked={config.useManual}
            onCheckedChange={(v) => handleConfigChange('blended_rate', { ...config, useManual: v, calculatedRate: calculatedBlendedRate })}
          />
          <Label>Use manual rate override</Label>
        </div>
        
        {config.useManual && (
          <div className="space-y-2">
            <Label>Manual Blended Rate ({currencySymbol}/hr)</Label>
            <Input
              type="number"
              value={config.manualRate || ''}
              onChange={(e) => handleConfigChange('blended_rate', { ...config, manualRate: parseFloat(e.target.value) || null, calculatedRate: calculatedBlendedRate })}
              placeholder={Math.round(calculatedBlendedRate).toString()}
            />
          </div>
        )}
        
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Projected total at blended rate</p>
          <p className="text-xl font-bold">
            {formatCurrency(activeRate * baselineTotals.totalHours)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {currencySymbol}{Math.round(activeRate)}/hr × {baselineTotals.totalHours.toFixed(1)} hours
          </p>
        </div>
      </div>
    );
  };

  // Render Fixed Fee (Whole) configuration
  const renderFixedFeeWholeConfig = (afa: ProposalAFA | undefined) => {
    const config = (afa?.config || getDefaultConfig('fixed_fee_whole')) as FixedFeeWholeConfig;
    // Use adjusted baseline (includes rate modifier if active)
    const effectiveBaseline = adjustedBaseline.total;
    const baseWithPremium = effectiveBaseline * (1 + config.riskPremiumPercent / 100);
    
    return (
      <div className="space-y-4">
        {/* Show rate modifier basis if active */}
        {activeRateModifier && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Using adjusted baseline:</strong> {formatCurrency(effectiveBaseline)} 
              {activeRateModifier === 'discounted_rates' && ' (with discounted rates applied)'}
              {activeRateModifier === 'blended_rate' && ' (with blended rate applied)'}
            </p>
          </div>
        )}
        
        <div className="space-y-2">
          <Label>Risk Premium (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.riskPremiumPercent}
              onChange={(e) => handleConfigChange('fixed_fee_whole', { ...config, riskPremiumPercent: parseFloat(e.target.value) || 0, adjustedFee: null })}
              className="w-24"
            />
            <span className="text-muted-foreground">%</span>
            <span className="text-sm text-muted-foreground ml-2">
              Adds buffer for scope uncertainty
            </span>
          </div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Suggested fixed fee</p>
          <p className="text-xl font-bold">{formatCurrency(baseWithPremium)}</p>
        </div>
        
        <div className="space-y-2">
          <Label>Or set custom fixed fee ({currencySymbol})</Label>
          <Input
            type="number"
            value={config.adjustedFee || ''}
            onChange={(e) => handleConfigChange('fixed_fee_whole', { ...config, adjustedFee: parseFloat(e.target.value) || null })}
            placeholder="Leave blank to use calculated amount"
          />
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Client-facing price</p>
          <p className="text-xl font-bold">
            {formatCurrency(config.adjustedFee || baseWithPremium)}
          </p>
        </div>
      </div>
    );
  };

  // Render Fixed Fee by Phase configuration
  const renderFixedFeePhaseConfig = (afa: ProposalAFA | undefined) => {
    const config = (afa?.config || getDefaultConfig('fixed_fee_phase')) as FixedFeePhaseConfig;
    
    // Use adjusted category totals if rate modifier is active
    const effectiveCategoryTotals = activeRateModifier ? adjustedCategoryTotals : categoryTotals;
    
    // Check if phases need initialization
    const needsInit = config.phases.length === 0 && Object.keys(effectiveCategoryTotals).length > 0;

    const updatePhase = (index: number, updates: Partial<typeof config.phases[0]>) => {
      const newPhases = [...config.phases];
      newPhases[index] = { ...newPhases[index], ...updates };
      handleConfigChange('fixed_fee_phase', { ...config, phases: newPhases });
    };
    
    const initializePhases = () => {
      const phases = Object.entries(effectiveCategoryTotals).map(([category, amount]) => ({
        category,
        baseAmount: amount,
        adjustmentPercent: 0,
        isIncluded: true,
      }));
      handleConfigChange('fixed_fee_phase', { ...config, phases });
    };

    // Calculate adjusted amount for a phase
    const getAdjustedAmount = (phase: typeof config.phases[0]) => {
      const adjusted = phase.baseAmount * (1 + phase.adjustmentPercent / 100);
      if (config.roundToNearest1000) {
        return Math.round(adjusted / 1000) * 1000;
      }
      return Math.round(adjusted);
    };

    const includedTotal = config.phases
      .filter(p => p.isIncluded)
      .reduce((sum, p) => sum + getAdjustedAmount(p), 0);
    
    return (
      <div className="space-y-4">
        {/* Show rate modifier basis if active */}
        {activeRateModifier && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Using adjusted baseline:</strong> Phase amounts reflect 
              {activeRateModifier === 'discounted_rates' && ' discounted rates'}
              {activeRateModifier === 'blended_rate' && ' blended rate'}
            </p>
          </div>
        )}
        
        <p className="text-sm text-muted-foreground">
          Apply percentage adjustments to each phase. Use negative values for discounts.
        </p>
        
        <div className="flex items-center gap-2">
          <Checkbox
            id="round-checkbox"
            checked={config.roundToNearest1000}
            onCheckedChange={(v) => handleConfigChange('fixed_fee_phase', { ...config, roundToNearest1000: !!v })}
          />
          <Label htmlFor="round-checkbox" className="text-sm cursor-pointer">
            Round to nearest 1,000
          </Label>
        </div>
        
        {needsInit ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-3">No phases configured yet.</p>
            <Button onClick={initializePhases} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Initialize from Categories
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {config.phases.map((phase, index) => {
              const adjustedAmount = getAdjustedAmount(phase);
              const isUplift = phase.adjustmentPercent > 0;
              const isDownlift = phase.adjustmentPercent < 0;
              
              return (
                <div key={phase.category} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                  <Checkbox
                    checked={phase.isIncluded}
                    onCheckedChange={(v) => updatePhase(index, { isIncluded: !!v })}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{phase.category}</p>
                    <p className="text-xs text-muted-foreground">Base: {formatCurrency(phase.baseAmount)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24">
                      <div className="relative">
                        <Input
                          type="number"
                          value={phase.adjustmentPercent}
                          onChange={(e) => updatePhase(index, { adjustmentPercent: parseFloat(e.target.value) || 0 })}
                          className="text-right pr-6"
                          step="0.5"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                    </div>
                    <div className="w-28 text-right">
                      <p className={cn(
                        "font-medium",
                        isUplift && "text-green-600 dark:text-green-400",
                        isDownlift && "text-amber-600 dark:text-amber-400"
                      )}>
                        {formatCurrency(adjustedAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Total (included phases)</p>
          <p className="text-xl font-bold">{formatCurrency(includedTotal)}</p>
        </div>
      </div>
    );
  };

  // Render Fee Collar configuration
  const renderFeeCollarConfig = (afa: ProposalAFA | undefined) => {
    const config = (afa?.config || { 
      ...getDefaultConfig('fee_collar'), 
      targetFee: baselineTotals.total 
    }) as FeeCollarConfig;
    
    const floor = config.targetFee * (1 - config.collarWidth / 100);
    const ceiling = config.targetFee * (1 + config.collarWidth / 100);
    
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Target Fee ({currencySymbol})</Label>
          <Input
            type="number"
            value={config.targetFee}
            onChange={(e) => handleConfigChange('fee_collar', { ...config, targetFee: parseFloat(e.target.value) || 0 })}
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Collar Width (%)</Label>
            <Input
              type="number"
              value={config.collarWidth}
              onChange={(e) => handleConfigChange('fee_collar', { ...config, collarWidth: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Upside Share (%)</Label>
            <Input
              type="number"
              value={config.upsideSharePercent}
              onChange={(e) => handleConfigChange('fee_collar', { ...config, upsideSharePercent: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">Firm keeps if under target</p>
          </div>
          <div className="space-y-2">
            <Label>Downside Share (%)</Label>
            <Input
              type="number"
              value={config.downsideSharePercent}
              onChange={(e) => handleConfigChange('fee_collar', { ...config, downsideSharePercent: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">Firm absorbs if over target</p>
          </div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-green-600 dark:text-green-400">Floor (client min)</span>
            <span className="font-medium">{formatCurrency(floor)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-medium">Target</span>
            <span className="font-bold text-lg">{formatCurrency(config.targetFee)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-amber-600 dark:text-amber-400">Ceiling (client max)</span>
            <span className="font-medium">{formatCurrency(ceiling)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Render Milestone configuration
  const renderMilestoneConfig = (afa: ProposalAFA | undefined) => {
    const config = (afa?.config || getDefaultConfig('milestone')) as MilestoneConfig;
    
    const addMilestone = () => {
      const newMilestones = [...config.milestones, {
        id: crypto.randomUUID(),
        name: '',
        description: '',
        percentOfTotal: 0,
        amount: 0,
      }];
      handleConfigChange('milestone', { milestones: newMilestones });
    };

    const updateMilestone = (index: number, updates: Partial<typeof config.milestones[0]>) => {
      const newMilestones = [...config.milestones];
      newMilestones[index] = { ...newMilestones[index], ...updates };
      
      // If percent changed, recalculate amount
      if ('percentOfTotal' in updates) {
        newMilestones[index].amount = Math.round(baselineTotals.total * (updates.percentOfTotal! / 100));
      }
      
      handleConfigChange('milestone', { milestones: newMilestones });
    };

    const removeMilestone = (index: number) => {
      const newMilestones = config.milestones.filter((_, i) => i !== index);
      handleConfigChange('milestone', { milestones: newMilestones });
    };

    const totalPercent = config.milestones.reduce((sum, m) => sum + m.percentOfTotal, 0);
    const totalAmount = config.milestones.reduce((sum, m) => sum + m.amount, 0);
    
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Define milestones and allocate a percentage of the total fee to each.
        </p>
        
        <div className="space-y-3">
          {config.milestones.map((milestone, index) => (
            <div key={milestone.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={milestone.name}
                  onChange={(e) => updateMilestone(index, { name: e.target.value })}
                  placeholder="Milestone name"
                  className="flex-1"
                />
                <div className="w-24">
                  <Input
                    type="number"
                    value={milestone.percentOfTotal}
                    onChange={(e) => updateMilestone(index, { percentOfTotal: parseFloat(e.target.value) || 0 })}
                    className="text-right"
                  />
                </div>
                <span className="text-muted-foreground">%</span>
                <Button variant="ghost" size="icon" onClick={() => removeMilestone(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <Input
                  value={milestone.description}
                  onChange={(e) => updateMilestone(index, { description: e.target.value })}
                  placeholder="Description (optional)"
                  className="text-sm"
                />
                <span className="ml-2 whitespace-nowrap">{formatCurrency(milestone.amount)}</span>
              </div>
            </div>
          ))}
        </div>
        
        <Button variant="outline" size="sm" onClick={addMilestone}>
          <Plus className="h-4 w-4 mr-2" />
          Add Milestone
        </Button>
        
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total allocation</span>
            <span className={cn("font-medium", totalPercent !== 100 && "text-amber-600")}>
              {totalPercent}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total amount</span>
            <span className="text-xl font-bold">{formatCurrency(totalAmount)}</span>
          </div>
          {totalPercent !== 100 && (
            <p className="text-xs text-amber-600 mt-2">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              Milestone percentages should add up to 100%
            </p>
          )}
        </div>
      </div>
    );
  };

  // Render Monthly Retainer configuration
  const renderMonthlyRetainerConfig = (afa: ProposalAFA | undefined) => {
    const config = (afa?.config || getDefaultConfig('monthly_retainer')) as MonthlyRetainerConfig;
    
    const suggestedMonthly = Math.round(baselineTotals.total / 12);
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Monthly Fee ({currencySymbol})</Label>
            <Input
              type="number"
              value={config.monthlyFee}
              onChange={(e) => handleConfigChange('monthly_retainer', { ...config, monthlyFee: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">
              Suggested: {formatCurrency(suggestedMonthly)}/month
            </p>
          </div>
          <div className="space-y-2">
            <Label>Duration (months)</Label>
            <Input
              type="number"
              value={config.durationMonths}
              onChange={(e) => handleConfigChange('monthly_retainer', { ...config, durationMonths: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Included Work Categories</Label>
          <div className="flex flex-wrap gap-2">
            {allCategories.map(cat => (
              <Badge
                key={cat}
                variant={config.includedCategories.includes(cat) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const included = config.includedCategories.includes(cat)
                    ? config.includedCategories.filter(c => c !== cat)
                    : [...config.includedCategories, cat];
                  handleConfigChange('monthly_retainer', { ...config, includedCategories: included });
                }}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Total contract value</p>
          <p className="text-xl font-bold">
            {formatCurrency(config.monthlyFee * config.durationMonths)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(config.monthlyFee)}/month × {config.durationMonths} months
          </p>
        </div>
      </div>
    );
  };

  // Render Discounted Rates configuration
  const renderDiscountedRatesConfig = (afa: ProposalAFA | undefined) => {
    const config = (afa?.config || getDefaultConfig('discounted_rates')) as DiscountedRatesConfig;
    const discountedTotal = baselineTotals.total * (1 - config.discountPercent / 100);
    
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Discount Percentage</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.discountPercent}
              onChange={(e) => handleConfigChange('discounted_rates', { ...config, discountPercent: parseFloat(e.target.value) || 0 })}
              className="w-24"
            />
            <span className="text-muted-foreground">%</span>
          </div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span>Standard rates total</span>
            <span className="line-through text-muted-foreground">{formatCurrency(baselineTotals.total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Discount</span>
            <span className="text-green-600">-{formatCurrency(baselineTotals.total - discountedTotal)}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="font-medium">Discounted total</span>
            <span className="text-xl font-bold">{formatCurrency(discountedTotal)}</span>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Discounted rates by grade:</p>
          <ul className="list-disc list-inside ml-2">
            <li>Partner: {currencySymbol}{Math.round(rateCard.partner.rate * (1 - config.discountPercent / 100))}/hr</li>
            <li>Senior Associate: {currencySymbol}{Math.round(rateCard.seniorAssociate.rate * (1 - config.discountPercent / 100))}/hr</li>
            <li>Associate: {currencySymbol}{Math.round(rateCard.associate.rate * (1 - config.discountPercent / 100))}/hr</li>
            <li>Trainee: {currencySymbol}{Math.round(rateCard.trainee.rate * (1 - config.discountPercent / 100))}/hr</li>
          </ul>
        </div>
      </div>
    );
  };

  // Render Success Fee configuration
  const renderSuccessFeeConfig = (afa: ProposalAFA | undefined) => {
    const config = (afa?.config || getDefaultConfig('success_fee')) as SuccessFeeConfig;
    const upliftAmount = config.upliftAmount || Math.round(baselineTotals.total * (config.upliftPercent / 100));
    
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Success fee added to baseline estimate of {formatCurrency(baselineTotals.total)}
          </p>
        </div>
        
        <div className="space-y-2">
          <Label>Success Condition</Label>
          <Textarea
            value={config.successCondition}
            onChange={(e) => handleConfigChange('success_fee', { ...config, successCondition: e.target.value })}
            placeholder="e.g., Transaction completes within 6 months; Deal value exceeds £100m"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Uplift Percentage</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={config.upliftPercent}
                onChange={(e) => {
                  const percent = parseFloat(e.target.value) || 0;
                  const newUplift = Math.round(baselineTotals.total * (percent / 100));
                  handleConfigChange('success_fee', { 
                    ...config, 
                    upliftPercent: percent,
                    upliftAmount: newUplift
                  });
                }}
                className="w-24"
              />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Or fixed uplift amount ({currencySymbol})</Label>
            <Input
              type="number"
              value={config.upliftAmount}
              onChange={(e) => handleConfigChange('success_fee', { ...config, upliftAmount: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Baseline fees</span>
            <span>{formatCurrency(baselineTotals.total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Success fee uplift</span>
            <span className="text-green-600">+{formatCurrency(upliftAmount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total on success</span>
            <span>{formatCurrency(baselineTotals.total + upliftAmount)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Render config for an AFA type
  const renderConfig = (type: AFAType) => {
    const afa = getAFA(type);
    
    switch (type) {
      case 'fee_cap': return renderFeeCapConfig(afa);
      case 'blended_rate': return renderBlendedRateConfig(afa);
      case 'fixed_fee_whole': return renderFixedFeeWholeConfig(afa);
      case 'fixed_fee_phase': return renderFixedFeePhaseConfig(afa);
      case 'fee_collar': return renderFeeCollarConfig(afa);
      case 'milestone': return renderMilestoneConfig(afa);
      case 'monthly_retainer': return renderMonthlyRetainerConfig(afa);
      case 'discounted_rates': return renderDiscountedRatesConfig(afa);
      case 'success_fee': return renderSuccessFeeConfig(afa);
      default: return null;
    }
  };

  // Get icon for AFA type
  const getAFAIcon = (type: AFAType) => {
    switch (type) {
      case 'fee_cap': return Shield;
      case 'blended_rate': return Calculator;
      case 'fixed_fee_whole': return DollarSign;
      case 'fixed_fee_phase': return Layers;
      case 'fee_collar': return Target;
      case 'milestone': return Clock;
      case 'monthly_retainer': return Clock;
      case 'discounted_rates': return Percent;
      case 'success_fee': return TrendingUp;
      default: return DollarSign;
    }
  };

  // Enabled AFAs for comparison
  const enabledAFAs = afas.filter(a => a.is_enabled);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Baseline Reference Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Baseline Time-Cost Estimate
              </CardTitle>
              <CardDescription>
                Your underlying estimate - AFAs layer pricing options on top of this
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-1">
              {formatCurrency(baselineTotals.total)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">BM Fees</p>
              <p className="font-medium">{formatCurrency(baselineTotals.bmTotal)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Local Counsel</p>
              <p className="font-medium">{formatCurrency(baselineTotals.localCounselTotal)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Hours</p>
              <p className="font-medium">{baselineTotals.totalHours.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Blended Rate</p>
              <p className="font-medium">{currencySymbol}{Math.round(baselineTotals.blendedRate)}/hr</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AFA Options */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Alternative Fee Arrangements
              </CardTitle>
              <CardDescription>
                Enable and configure alternative pricing structures. Multiple options can be generated for comparison.
              </CardDescription>
            </div>
            {(showAutoSaved || upsertAFA.isPending || toggleAFA.isPending) && (
              <Badge variant="outline" className={cn(
                "gap-1.5 transition-opacity",
                (upsertAFA.isPending || toggleAFA.isPending) ? "text-muted-foreground" : "text-green-600 border-green-500"
              )}>
                {(upsertAFA.isPending || toggleAFA.isPending) ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Auto-saved
                  </>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {AFA_GROUPS.map((group, groupIndex) => {
            const groupHasEnabled = group.types.some(t => afas.find(a => a.afa_type === t)?.is_enabled);
            const GroupIcon = group.id === 'rate_modifiers' ? Percent : group.id === 'pricing_models' ? Calculator : Plus;
            
            return (
              <div key={group.id}>
                {/* Group Header */}
                <div className={cn(
                  "flex items-center gap-3 mb-3 pb-2",
                  groupIndex > 0 && "pt-2 border-t"
                )}>
                  <div className={cn(
                    "p-2 rounded-lg",
                    group.id === 'rate_modifiers' && "bg-blue-100 dark:bg-blue-950",
                    group.id === 'pricing_models' && "bg-purple-100 dark:bg-purple-950",
                    group.id === 'add_ons' && "bg-green-100 dark:bg-green-950"
                  )}>
                    <GroupIcon className={cn(
                      "h-4 w-4",
                      group.id === 'rate_modifiers' && "text-blue-600 dark:text-blue-400",
                      group.id === 'pricing_models' && "text-purple-600 dark:text-purple-400",
                      group.id === 'add_ons' && "text-green-600 dark:text-green-400"
                    )} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{group.label}</p>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  {groupHasEnabled && (
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                
                {/* Group AFAs */}
                <Accordion type="multiple" value={expandedTypes} onValueChange={setExpandedTypes}>
                  {group.types.map(type => {
                    const afa = getAFA(type);
                    const isEnabled = afa?.is_enabled ?? false;
                    const Icon = getAFAIcon(type);
                    const clientPrice = afa ? afa.client_price : calculateClientPrice(type, getDefaultConfig(type));
                    const marginPercent = afa ? afa.margin_impact_percent : calculateMarginImpact(clientPrice);
                    
                    // Check compatibility with currently enabled AFAs
                    const compatibility = checkAFACompatibility(type, enabledAFATypes.filter(t => t !== type));
                    const isUsedAsBasis = isRateModifierUsedAsBasis(type, enabledAFATypes);
                    const layeringExplanation = getLayeringExplanation(type, enabledAFATypes.filter(t => t !== type));
                    
                    return (
                      <AccordionItem key={type} value={type} className={cn(
                        "border rounded-lg mb-2 px-4",
                        !isEnabled && compatibility.isBlocked && "opacity-60",
                        group.id === 'rate_modifiers' && isEnabled && "border-blue-300 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20",
                        group.id === 'pricing_models' && isEnabled && "border-purple-300 bg-purple-50/30 dark:border-purple-800 dark:bg-purple-950/20",
                        group.id === 'add_ons' && isEnabled && "border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20"
                      )}>
                        <div className="flex items-center gap-3 py-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Switch
                                    checked={isEnabled}
                                    onCheckedChange={(v) => handleToggle(type, v)}
                                  />
                                </div>
                              </TooltipTrigger>
                              {!isEnabled && compatibility.isBlocked && (
                                <TooltipContent>
                                  <p className="max-w-xs">
                                    {compatibility.reason}
                                    <br />
                                    <span className="text-xs text-muted-foreground">
                                      Enabling will disable: {compatibility.blockedBy.map(t => AFA_TYPE_LABELS[t]).join(', ')}
                                    </span>
                                  </p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                          <AccordionTrigger className="flex-1 hover:no-underline py-3">
                            <div className="flex items-center gap-3">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{AFA_TYPE_LABELS[type]}</p>
                                  {/* Show basis indicator */}
                                  {isEnabled && isUsedAsBasis && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Badge variant="outline" className="text-xs gap-1 border-blue-500 text-blue-600">
                                            <Link2 className="h-3 w-3" />
                                            Basis
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Used as calculation basis for other active AFAs</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {/* Show blocked indicator */}
                                  {!isEnabled && compatibility.isBlocked && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Badge variant="outline" className="text-xs gap-1 border-amber-500 text-amber-600">
                                            <Ban className="h-3 w-3" />
                                            Conflicts
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{compatibility.reason}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{AFA_TYPE_DESCRIPTIONS[type]}</p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          {isEnabled && (
                            <div className="flex items-center gap-3 mr-4">
                              <span className="font-medium">{formatCurrency(clientPrice)}</span>
                              <RiskBadge clientPrice={clientPrice} marginPercent={marginPercent} />
                            </div>
                          )}
                        </div>
                        <AccordionContent className="pt-0 pb-4">
                          <div className="pl-10 pr-2">
                            {/* Show layering explanation if applicable */}
                            {layeringExplanation && (
                              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
                                <Link2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                <p className="text-sm text-blue-700 dark:text-blue-300">{layeringExplanation}</p>
                              </div>
                            )}
                            
                            {renderConfig(type)}
                            
                            {isEnabled && (
                              <>
                                <Separator className="my-4" />
                                
                                {/* Internal Economics */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                                  <p className="text-sm font-medium mb-3">Internal Economics</p>
                                  <div className="grid grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Client Price</p>
                                      <p className="font-bold text-lg">{formatCurrency(clientPrice)}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Effective Rate</p>
                                      <p className="font-medium">
                                        {currencySymbol}{Math.round(afa?.effective_rate || calculateEffectiveRate(clientPrice))}/hr
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">vs Baseline</p>
                                      <p className={cn(
                                        "font-medium",
                                        clientPrice < baselineTotals.total ? "text-red-600" : "text-green-600"
                                      )}>
                                        {clientPrice >= baselineTotals.total ? '+' : ''}{formatCurrency(clientPrice - baselineTotals.total)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Margin</p>
                                      <p className="font-medium">{marginPercent.toFixed(1)}%</p>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Client Narrative */}
                                <div className="mt-4 space-y-2">
                                  <Label>Client-Facing Narrative (optional)</Label>
                                  <Textarea
                                    value={afa?.client_narrative || ''}
                                    onChange={(e) => upsertAFA.mutateAsync({
                                      ...afa!,
                                      afa_type: type,
                                      client_narrative: e.target.value,
                                    })}
                                    placeholder="Add client-ready description of this pricing option..."
                                    className="min-h-[80px]"
                                  />
                                </div>
                                
                                {/* Select for Export */}
                                <div className="mt-4 flex items-center gap-2">
                                  <Checkbox
                                    checked={afa?.is_selected_for_export ?? false}
                                    onCheckedChange={(v) => afa && selectForExport.mutateAsync({ afaId: afa.id, selected: !!v })}
                                  />
                                  <Label>Include in Excel export</Label>
                                </div>
                              </>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Comparison View (if multiple enabled) */}
      {enabledAFAs.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AFA Comparison</CardTitle>
            <CardDescription>Side-by-side comparison of enabled pricing options</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Option</th>
                    <th className="text-right py-2 px-4">Client Price</th>
                    <th className="text-right py-2 px-4">vs Baseline</th>
                    <th className="text-right py-2 px-4">Eff. Rate</th>
                    <th className="text-right py-2 px-4">Margin</th>
                    <th className="text-center py-2 pl-4">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-muted/30">
                    <td className="py-2 pr-4 font-medium">Baseline Estimate</td>
                    <td className="text-right py-2 px-4">{formatCurrency(baselineTotals.total)}</td>
                    <td className="text-right py-2 px-4 text-muted-foreground">—</td>
                    <td className="text-right py-2 px-4">{currencySymbol}{Math.round(baselineTotals.blendedRate)}/hr</td>
                    <td className="text-right py-2 px-4">{baselineTotals.marginPercent.toFixed(1)}%</td>
                    <td className="text-center py-2 pl-4">
                      <RiskBadge clientPrice={baselineTotals.total} marginPercent={baselineTotals.marginPercent} />
                    </td>
                  </tr>
                  {enabledAFAs.map(afa => {
                    const diff = afa.client_price - baselineTotals.total;
                    return (
                      <tr key={afa.id} className="border-b">
                        <td className="py-2 pr-4 font-medium">{AFA_TYPE_LABELS[afa.afa_type]}</td>
                        <td className="text-right py-2 px-4 font-bold">{formatCurrency(afa.client_price)}</td>
                        <td className={cn(
                          "text-right py-2 px-4",
                          diff < 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                        </td>
                        <td className="text-right py-2 px-4">{currencySymbol}{Math.round(afa.effective_rate)}/hr</td>
                        <td className="text-right py-2 px-4">{afa.margin_impact_percent.toFixed(1)}%</td>
                        <td className="text-center py-2 pl-4">
                          <RiskBadge clientPrice={afa.client_price} marginPercent={afa.margin_impact_percent} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Governance Note */}
      <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Pricing Governance</p>
          <p>
            AFA configurations are saved automatically. Red indicators flag options that may require 
            pricing committee review. The baseline estimate is preserved and never overwritten.
          </p>
        </div>
      </div>
    </div>
  );
}
