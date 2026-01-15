/**
 * Utilities for applying AFA (Alternative Fee Arrangement) filters to work items
 * and generating filtered exports with explanatory comments.
 */

import { DraftProposalItem } from '@/lib/hooks/usePricingProposals';
import { 
  ProposalAFA, 
  AFAType, 
  AFA_TYPE_LABELS,
  DiscountedRatesConfig,
  FeeCapConfig,
  BlendedRateConfig,
  FixedFeeWholeConfig,
  FixedFeePhaseConfig,
  SuccessFeeConfig,
} from '@/lib/hooks/useProposalAFAs';

export interface AFAFilteredItem extends DraftProposalItem {
  original_fee_amount: number;
  afa_adjusted: boolean;
  afa_comment?: string;
}

export interface AFAFilterResult {
  items: AFAFilteredItem[];
  globalComment?: string;
  totalAdjustment: number;
  appliedAFAs: Array<{
    type: AFAType;
    label: string;
    description: string;
    clientPrice: number;
  }>;
}

/**
 * Get the primary AFA that should be applied to work items.
 * Some AFAs are mutually exclusive (e.g., fixed_fee_whole overrides discounted_rates).
 * Priority order: fixed_fee_whole > fixed_fee_phase > blended_rate > fee_cap > discounted_rates
 */
function getPrimaryAFA(enabledAFAs: ProposalAFA[]): ProposalAFA | null {
  const priorityOrder: AFAType[] = [
    'fixed_fee_whole',
    'fixed_fee_phase', 
    'blended_rate',
    'fee_cap',
    'monthly_retainer',
    'milestone',
    'fee_collar',
    'discounted_rates',
  ];
  
  for (const type of priorityOrder) {
    const afa = enabledAFAs.find(a => a.afa_type === type);
    if (afa) return afa;
  }
  
  return null;
}

/**
 * Apply AFA filters to work items and return adjusted items with comments.
 */
export function applyAFAFilters(
  draftItems: DraftProposalItem[],
  enabledAFAs: ProposalAFA[],
  baselineTotal: number,
  currencySymbol: string = '£'
): AFAFilterResult {
  if (enabledAFAs.length === 0) {
    // No AFAs enabled - return items unchanged
    return {
      items: draftItems.map(item => ({
        ...item,
        original_fee_amount: item.fee_amount,
        afa_adjusted: false,
      })),
      totalAdjustment: 0,
      appliedAFAs: [],
    };
  }

  const primaryAFA = getPrimaryAFA(enabledAFAs);
  const successFeeAFA = enabledAFAs.find(a => a.afa_type === 'success_fee');
  const discountAFA = enabledAFAs.find(a => a.afa_type === 'discounted_rates');
  
  let filteredItems: AFAFilteredItem[] = [];
  let globalComment: string | undefined;
  const appliedAFAs: AFAFilterResult['appliedAFAs'] = [];

  // Calculate original totals
  const originalBmTotal = draftItems
    .filter(item => item.provider === 'Baker McKenzie' && (item.is_included !== false || !item.is_optional))
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  const originalLcTotal = draftItems
    .filter(item => item.provider === 'Local Counsel' && (item.is_included !== false || !item.is_optional))
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);

  // Apply primary AFA
  if (primaryAFA) {
    appliedAFAs.push({
      type: primaryAFA.afa_type,
      label: AFA_TYPE_LABELS[primaryAFA.afa_type],
      description: generateAFADescription(primaryAFA, currencySymbol),
      clientPrice: primaryAFA.client_price,
    });

    switch (primaryAFA.afa_type) {
      case 'fixed_fee_whole': {
        // All BM items become a single fixed fee - keep structure but mark as fixed
        globalComment = `Fixed Fee: ${currencySymbol}${primaryAFA.client_price.toLocaleString()} for the entire scope of work`;
        const adjustmentRatio = primaryAFA.client_price / originalBmTotal;
        
        filteredItems = draftItems.map(item => {
          if (item.provider === 'Baker McKenzie') {
            const adjustedFee = Math.round((item.fee_amount || 0) * adjustmentRatio);
            return {
              ...item,
              original_fee_amount: item.fee_amount,
              fee_amount: adjustedFee,
              afa_adjusted: true,
              afa_comment: 'Included in fixed fee',
            };
          }
          return {
            ...item,
            original_fee_amount: item.fee_amount,
            afa_adjusted: false,
          };
        });
        break;
      }

      case 'fixed_fee_phase': {
        const config = primaryAFA.config as FixedFeePhaseConfig;
        const phaseMap = new Map(config.phases.map(p => [p.category, p]));
        
        // Helper to calculate adjusted amount for a phase
        const getPhaseAdjustedAmount = (phase: typeof config.phases[0]) => {
          const adjusted = phase.baseAmount * (1 + phase.adjustmentPercent / 100);
          if (config.roundToNearest1000) {
            return Math.round(adjusted / 1000) * 1000;
          }
          return Math.round(adjusted);
        };
        
        filteredItems = draftItems.map(item => {
          const phase = phaseMap.get(item.category || '');
          if (phase && phase.isIncluded && item.provider === 'Baker McKenzie') {
            // Calculate proportional share of the fixed phase fee
            const categoryItems = draftItems.filter(
              i => i.category === item.category && i.provider === 'Baker McKenzie'
            );
            const categoryTotal = categoryItems.reduce((sum, i) => sum + (i.fee_amount || 0), 0);
            const ratio = categoryTotal > 0 ? (item.fee_amount || 0) / categoryTotal : 0;
            const phaseAdjustedAmount = getPhaseAdjustedAmount(phase);
            const adjustedFee = Math.round(phaseAdjustedAmount * ratio);
            
            return {
              ...item,
              original_fee_amount: item.fee_amount,
              fee_amount: adjustedFee,
              afa_adjusted: true,
              afa_comment: `Fixed fee for ${item.category}: ${currencySymbol}${phaseAdjustedAmount.toLocaleString()}`,
            };
          }
          return {
            ...item,
            original_fee_amount: item.fee_amount,
            afa_adjusted: false,
          };
        });
        
        const includedPhases = config.phases.filter(p => p.isIncluded);
        globalComment = `Fixed fees by phase: ${includedPhases.map(p => `${p.category} (${currencySymbol}${getPhaseAdjustedAmount(p).toLocaleString()})`).join(', ')}`;
        break;
      }

      case 'blended_rate': {
        const config = primaryAFA.config as BlendedRateConfig;
        const rate = config.useManual && config.manualRate ? config.manualRate : config.calculatedRate;
        globalComment = `Blended hourly rate: ${currencySymbol}${Math.round(rate)}/hour applied across all timekeepers`;
        
        // Proportionally adjust items based on the blended rate total
        const adjustmentRatio = primaryAFA.client_price / originalBmTotal;
        filteredItems = draftItems.map(item => {
          if (item.provider === 'Baker McKenzie') {
            const adjustedFee = Math.round((item.fee_amount || 0) * adjustmentRatio);
            return {
              ...item,
              original_fee_amount: item.fee_amount,
              fee_amount: adjustedFee,
              afa_adjusted: true,
              afa_comment: `At blended rate ${currencySymbol}${Math.round(rate)}/hr`,
            };
          }
          return {
            ...item,
            original_fee_amount: item.fee_amount,
            afa_adjusted: false,
          };
        });
        break;
      }

      case 'fee_cap': {
        const config = primaryAFA.config as FeeCapConfig;
        if (config.capType === 'amount') {
          globalComment = `Fee cap: ${currencySymbol}${config.capAmount.toLocaleString()} - time-based billing up to this maximum`;
        } else {
          globalComment = `Fee cap: ${config.capPercentageAbove}% above estimate (cap at ${currencySymbol}${primaryAFA.client_price.toLocaleString()})`;
        }
        
        // Items remain at estimate but note the cap
        filteredItems = draftItems.map(item => ({
          ...item,
          original_fee_amount: item.fee_amount,
          afa_adjusted: false, // Fee cap doesn't change line items, just sets a ceiling
          afa_comment: item.provider === 'Baker McKenzie' ? 'Subject to fee cap' : undefined,
        }));
        break;
      }

      case 'discounted_rates': {
        const config = primaryAFA.config as DiscountedRatesConfig;
        globalComment = `${config.discountPercent}% discount applied to standard rates`;
        const multiplier = 1 - config.discountPercent / 100;
        
        filteredItems = draftItems.map(item => {
          if (item.provider === 'Baker McKenzie') {
            const adjustedFee = Math.round((item.fee_amount || 0) * multiplier);
            return {
              ...item,
              original_fee_amount: item.fee_amount,
              fee_amount: adjustedFee,
              afa_adjusted: true,
              afa_comment: `${config.discountPercent}% discount applied`,
            };
          }
          return {
            ...item,
            original_fee_amount: item.fee_amount,
            afa_adjusted: false,
          };
        });
        break;
      }

      default:
        // For other AFA types, just note the arrangement
        globalComment = `${AFA_TYPE_LABELS[primaryAFA.afa_type]}: ${currencySymbol}${primaryAFA.client_price.toLocaleString()}`;
        filteredItems = draftItems.map(item => ({
          ...item,
          original_fee_amount: item.fee_amount,
          afa_adjusted: false,
        }));
    }
  } else {
    // No primary AFA, just copy items
    filteredItems = draftItems.map(item => ({
      ...item,
      original_fee_amount: item.fee_amount,
      afa_adjusted: false,
    }));
  }

  // Apply discount AFA if not the primary (it can compound with some AFAs)
  if (discountAFA && (!primaryAFA || primaryAFA.afa_type !== 'discounted_rates')) {
    const config = discountAFA.config as DiscountedRatesConfig;
    const canCompound = primaryAFA?.afa_type === 'fee_cap' || !primaryAFA;
    
    if (canCompound) {
      const multiplier = 1 - config.discountPercent / 100;
      filteredItems = filteredItems.map(item => {
        if (item.provider === 'Baker McKenzie') {
          const adjustedFee = Math.round(item.fee_amount * multiplier);
          return {
            ...item,
            fee_amount: adjustedFee,
            afa_adjusted: true,
            afa_comment: item.afa_comment 
              ? `${item.afa_comment}; ${config.discountPercent}% discount` 
              : `${config.discountPercent}% discount applied`,
          };
        }
        return item;
      });
      
      appliedAFAs.push({
        type: 'discounted_rates',
        label: AFA_TYPE_LABELS['discounted_rates'],
        description: `${config.discountPercent}% discount on standard rates`,
        clientPrice: discountAFA.client_price,
      });
      
      globalComment = globalComment 
        ? `${globalComment}. Additional ${config.discountPercent}% discount applied.`
        : `${config.discountPercent}% discount applied to standard rates`;
    }
  }

  // Handle success fee (add-on)
  if (successFeeAFA) {
    const config = successFeeAFA.config as SuccessFeeConfig;
    appliedAFAs.push({
      type: 'success_fee',
      label: AFA_TYPE_LABELS['success_fee'],
      description: `Success fee: ${currencySymbol}${config.upliftAmount.toLocaleString()} (${config.upliftPercent}% uplift) on successful completion${config.successCondition ? ` - ${config.successCondition}` : ''}`,
      clientPrice: config.upliftAmount,
    });
    
    globalComment = globalComment 
      ? `${globalComment}. Success fee of ${currencySymbol}${config.upliftAmount.toLocaleString()} payable on completion.`
      : `Success fee: ${currencySymbol}${config.upliftAmount.toLocaleString()} on successful completion`;
  }

  // Calculate total adjustment
  const newTotal = filteredItems
    .filter(item => item.is_included !== false || !item.is_optional)
    .reduce((sum, item) => sum + item.fee_amount, 0);
  const totalAdjustment = newTotal - baselineTotal;

  return {
    items: filteredItems,
    globalComment,
    totalAdjustment,
    appliedAFAs,
  };
}

/**
 * Generate a human-readable description of the AFA for comments
 */
function generateAFADescription(afa: ProposalAFA, currencySymbol: string): string {
  switch (afa.afa_type) {
    case 'fixed_fee_whole':
      return `Fixed fee of ${currencySymbol}${afa.client_price.toLocaleString()} for the entire matter`;
    case 'fixed_fee_phase': {
      const config = afa.config as FixedFeePhaseConfig;
      const phases = config.phases.filter(p => p.isIncluded);
      return `Fixed fees by phase: ${phases.length} phases totaling ${currencySymbol}${afa.client_price.toLocaleString()}`;
    }
    case 'blended_rate': {
      const config = afa.config as BlendedRateConfig;
      const rate = config.useManual && config.manualRate ? config.manualRate : config.calculatedRate;
      return `Blended rate of ${currencySymbol}${Math.round(rate)}/hour`;
    }
    case 'fee_cap': {
      const config = afa.config as FeeCapConfig;
      return config.capType === 'amount'
        ? `Fee cap of ${currencySymbol}${config.capAmount.toLocaleString()}`
        : `Fee cap at ${config.capPercentageAbove}% above estimate`;
    }
    case 'discounted_rates': {
      const config = afa.config as DiscountedRatesConfig;
      return `${config.discountPercent}% discount on standard rates`;
    }
    case 'success_fee': {
      const config = afa.config as SuccessFeeConfig;
      return `${config.upliftPercent}% success fee (${currencySymbol}${config.upliftAmount.toLocaleString()})`;
    }
    default:
      return `${AFA_TYPE_LABELS[afa.afa_type]}: ${currencySymbol}${afa.client_price.toLocaleString()}`;
  }
}

/**
 * Get summary of applied AFAs for display
 */
export function getAFASummary(enabledAFAs: ProposalAFA[], currencySymbol: string = '£'): string {
  if (enabledAFAs.length === 0) return '';
  
  const summaries = enabledAFAs.map(afa => generateAFADescription(afa, currencySymbol));
  return summaries.join('; ');
}
