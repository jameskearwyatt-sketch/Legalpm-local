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
  Layers
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
}

const AFA_TYPES: AFAType[] = [
  'fee_cap',
  'blended_rate',
  'fixed_fee_whole',
  'fixed_fee_phase',
  'fee_collar',
  'milestone',
  'monthly_retainer',
  'discounted_rates',
  'success_fee',
];

export function AFATab({
  proposalId,
  draftItems,
  rateCard,
  assumptions,
  currencySymbol,
  formatCurrency,
  baselineTotals,
  customCategories = [],
}: AFATabProps) {
  const { afas, isLoading, upsertAFA, toggleAFA, selectForExport } = useProposalAFAs(proposalId);
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);

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

  // Get AFA by type
  const getAFA = (type: AFAType): ProposalAFA | undefined => {
    return afas.find(a => a.afa_type === type);
  };

  // Calculate client price for each AFA type
  const calculateClientPrice = (type: AFAType, config: any): number => {
    const baseline = baselineTotals.total;
    
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
        return baseline * (1 + cfg.riskPremiumPercent / 100);
      }
      case 'fixed_fee_phase': {
        const cfg = config as FixedFeePhaseConfig;
        return cfg.phases
          .filter(p => p.isIncluded)
          .reduce((sum, p) => sum + p.adjustedAmount, 0);
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
        return baseline * (1 - cfg.discountPercent / 100);
      }
      case 'success_fee': {
        const cfg = config as SuccessFeeConfig;
        return cfg.upliftAmount;
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

  // Handle toggle
  const handleToggle = async (type: AFAType, enabled: boolean) => {
    await toggleAFA.mutateAsync({ afaType: type, enabled });
    if (enabled && !expandedTypes.includes(type)) {
      setExpandedTypes(prev => [...prev, type]);
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
    
    // Update calculated rate if it changed
    useEffect(() => {
      if (config.calculatedRate !== calculatedBlendedRate && !config.useManual) {
        handleConfigChange('blended_rate', { ...config, calculatedRate: calculatedBlendedRate });
      }
    }, [calculatedBlendedRate]);

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
            onCheckedChange={(v) => handleConfigChange('blended_rate', { ...config, useManual: v })}
          />
          <Label>Use manual rate override</Label>
        </div>
        
        {config.useManual && (
          <div className="space-y-2">
            <Label>Manual Blended Rate ({currencySymbol}/hr)</Label>
            <Input
              type="number"
              value={config.manualRate || ''}
              onChange={(e) => handleConfigChange('blended_rate', { ...config, manualRate: parseFloat(e.target.value) || null })}
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
    const baseWithPremium = baselineTotals.total * (1 + config.riskPremiumPercent / 100);
    
    return (
      <div className="space-y-4">
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
    
    // Initialize phases from category totals if empty
    useEffect(() => {
      if (config.phases.length === 0 && Object.keys(categoryTotals).length > 0) {
        const phases = Object.entries(categoryTotals).map(([category, amount]) => ({
          category,
          baseAmount: amount,
          adjustedAmount: Math.round(amount * 1.05), // 5% premium
          isIncluded: true,
        }));
        handleConfigChange('fixed_fee_phase', { phases });
      }
    }, [categoryTotals]);

    const updatePhase = (index: number, updates: Partial<typeof config.phases[0]>) => {
      const newPhases = [...config.phases];
      newPhases[index] = { ...newPhases[index], ...updates };
      handleConfigChange('fixed_fee_phase', { phases: newPhases });
    };

    const includedTotal = config.phases.filter(p => p.isIncluded).reduce((sum, p) => sum + p.adjustedAmount, 0);
    
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Set fixed fees for each work category. Toggle to include/exclude from the proposal.
        </p>
        
        <div className="space-y-3">
          {config.phases.map((phase, index) => (
            <div key={phase.category} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
              <Checkbox
                checked={phase.isIncluded}
                onCheckedChange={(v) => updatePhase(index, { isIncluded: !!v })}
              />
              <div className="flex-1">
                <p className="font-medium">{phase.category}</p>
                <p className="text-xs text-muted-foreground">Base: {formatCurrency(phase.baseAmount)}</p>
              </div>
              <div className="w-40">
                <Input
                  type="number"
                  value={phase.adjustedAmount}
                  onChange={(e) => updatePhase(index, { adjustedAmount: parseFloat(e.target.value) || 0 })}
                  className="text-right"
                />
              </div>
            </div>
          ))}
        </div>
        
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
    
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <Info className="h-4 w-4" />
            This is an add-on. Select a base pricing structure above.
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
                  handleConfigChange('success_fee', { 
                    ...config, 
                    upliftPercent: percent,
                    upliftAmount: Math.round(baselineTotals.total * (percent / 100))
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
        
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Success fee amount</p>
          <p className="text-xl font-bold">
            {formatCurrency(config.upliftAmount || Math.round(baselineTotals.total * (config.upliftPercent / 100)))}
          </p>
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
          <Separator className="my-4" />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Estimated Cost</p>
              <p className="font-medium">{formatCurrency(baselineTotals.totalCost)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Margin</p>
              <p className="font-medium">{formatCurrency(baselineTotals.margin)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Margin %</p>
              <p className="font-medium">{baselineTotals.marginPercent.toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AFA Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Alternative Fee Arrangements
          </CardTitle>
          <CardDescription>
            Enable and configure alternative pricing structures. Multiple options can be generated for comparison.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" value={expandedTypes} onValueChange={setExpandedTypes}>
            {AFA_TYPES.map(type => {
              const afa = getAFA(type);
              const isEnabled = afa?.is_enabled ?? false;
              const Icon = getAFAIcon(type);
              const clientPrice = afa ? afa.client_price : calculateClientPrice(type, getDefaultConfig(type));
              const marginPercent = afa ? afa.margin_impact_percent : calculateMarginImpact(clientPrice);
              
              return (
                <AccordionItem key={type} value={type} className="border rounded-lg mb-2 px-4">
                  <div className="flex items-center gap-3 py-2">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(v) => handleToggle(type, v)}
                    />
                    <AccordionTrigger className="flex-1 hover:no-underline py-3">
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-medium">{AFA_TYPE_LABELS[type]}</p>
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
