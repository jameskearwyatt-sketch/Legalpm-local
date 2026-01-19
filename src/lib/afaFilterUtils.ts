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
 * Round a number to the nearest 1000.
 * E.g., 1499 -> 1000, 1500 -> 2000, 12345 -> 12000
 */
function roundToNearest1000(value: number): number {
  return Math.round(value / 1000) * 1000;
}

/**
 * Apply AFA filters to work items and return adjusted items with comments.
 * All monetary values are rounded to nearest $1,000 for client-facing output.
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

  // STEP 1: Apply discounted rates FIRST if enabled (this forms the baseline for client-facing line items)
  // Discounted rates always apply to line items regardless of other AFAs
  let discountMultiplier = 1;
  let discountedBmTotal = originalBmTotal;
  
  if (discountAFA && primaryAFA?.afa_type !== 'discounted_rates') {
    const config = discountAFA.config as DiscountedRatesConfig;
    discountMultiplier = 1 - config.discountPercent / 100;
    discountedBmTotal = originalBmTotal * discountMultiplier;
    
    // Initialize filtered items with discounted amounts
    filteredItems = draftItems.map(item => {
      if (item.provider === 'Baker McKenzie') {
        const discountedFee = roundToNearest1000((item.fee_amount || 0) * discountMultiplier);
        return {
          ...item,
          original_fee_amount: item.fee_amount,
          fee_amount: discountedFee,
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
    
    appliedAFAs.push({
      type: 'discounted_rates',
      label: AFA_TYPE_LABELS['discounted_rates'],
      description: `${config.discountPercent}% discount on standard rates`,
      clientPrice: roundToNearest1000(discountedBmTotal + originalLcTotal),
    });
    
    globalComment = `${config.discountPercent}% discount applied to standard rates`;
  }

  // STEP 2: Apply primary AFA (but don't modify line items for fixed fees - they already show discounted baseline)
  if (primaryAFA) {
    const roundedClientPrice = roundToNearest1000(primaryAFA.client_price);
    
    appliedAFAs.push({
      type: primaryAFA.afa_type,
      label: AFA_TYPE_LABELS[primaryAFA.afa_type],
      description: generateAFADescription(primaryAFA, currencySymbol),
      clientPrice: roundedClientPrice,
    });

    switch (primaryAFA.afa_type) {
      case 'fixed_fee_whole': {
        // For fixed fee, line items show the discounted baseline (already applied above)
        // The fixed fee total is the agreed price, not used to scale line items
        const baselineForComment = discountAFA ? discountedBmTotal : originalBmTotal;
        globalComment = globalComment 
          ? `${globalComment}. Fixed Fee: ${currencySymbol}${roundedClientPrice.toLocaleString()} agreed for the entire scope.`
          : `Fixed Fee: ${currencySymbol}${roundedClientPrice.toLocaleString()} for the entire scope of work`;
        
        // If no discount was applied, initialize filtered items (unchanged)
        if (!discountAFA) {
          filteredItems = draftItems.map(item => ({
            ...item,
            original_fee_amount: item.fee_amount,
            fee_amount: roundToNearest1000(item.fee_amount || 0),
            afa_adjusted: false,
          }));
        }
        break;
      }

      case 'fixed_fee_phase': {
        // For fixed fee by phase, line items show the discounted baseline (already applied above)
        // The fixed fee phases are the agreed prices
        const config = primaryAFA.config as FixedFeePhaseConfig;
        const includedPhases = config.phases.filter(p => p.isIncluded);
        
        // Helper to calculate adjusted amount for a phase - always round to nearest 1000
        const getPhaseAdjustedAmount = (phase: typeof config.phases[0]) => {
          const adjusted = phase.baseAmount * (1 + phase.adjustmentPercent / 100);
          return roundToNearest1000(adjusted);
        };
        
        const phaseComment = `Fixed fees by phase: ${includedPhases.map(p => `${p.category} (${currencySymbol}${getPhaseAdjustedAmount(p).toLocaleString()})`).join(', ')}`;
        globalComment = globalComment 
          ? `${globalComment}. ${phaseComment}`
          : phaseComment;
        
        // If no discount was applied, initialize filtered items (unchanged, just rounded)
        if (!discountAFA) {
          filteredItems = draftItems.map(item => ({
            ...item,
            original_fee_amount: item.fee_amount,
            fee_amount: roundToNearest1000(item.fee_amount || 0),
            afa_adjusted: false,
          }));
        }
        break;
      }

      case 'blended_rate': {
        const config = primaryAFA.config as BlendedRateConfig;
        const rate = config.useManual && config.manualRate ? config.manualRate : config.calculatedRate;
        const blendedComment = `Blended hourly rate: ${currencySymbol}${Math.round(rate)}/hour applied across all timekeepers`;
        globalComment = globalComment ? `${globalComment}. ${blendedComment}` : blendedComment;
        
        // Proportionally adjust items based on the blended rate total
        // Use original baseline for ratio calculation
        const adjustmentRatio = roundedClientPrice / originalBmTotal;
        filteredItems = draftItems.map(item => {
          if (item.provider === 'Baker McKenzie') {
            const adjustedFee = roundToNearest1000((item.fee_amount || 0) * adjustmentRatio);
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
        const roundedCapAmount = roundToNearest1000(config.capAmount);
        const capComment = config.capType === 'amount' 
          ? `Fee cap: ${currencySymbol}${roundedCapAmount.toLocaleString()} - time-based billing up to this maximum`
          : `Fee cap: ${config.capPercentageAbove}% above estimate (cap at ${currencySymbol}${roundedClientPrice.toLocaleString()})`;
        globalComment = globalComment ? `${globalComment}. ${capComment}` : capComment;
        
        // If discount already applied, keep those items; otherwise initialize
        if (!discountAFA) {
          filteredItems = draftItems.map(item => ({
            ...item,
            original_fee_amount: item.fee_amount,
            fee_amount: roundToNearest1000(item.fee_amount || 0),
            afa_adjusted: false,
            afa_comment: item.provider === 'Baker McKenzie' ? 'Subject to fee cap' : undefined,
          }));
        } else {
          // Add fee cap comment to already discounted items
          filteredItems = filteredItems.map(item => ({
            ...item,
            afa_comment: item.provider === 'Baker McKenzie' 
              ? `${item.afa_comment || ''}; Subject to fee cap`.replace(/^; /, '')
              : item.afa_comment,
          }));
        }
        break;
      }

      case 'discounted_rates': {
        const config = primaryAFA.config as DiscountedRatesConfig;
        globalComment = `${config.discountPercent}% discount applied to standard rates`;
        const multiplier = 1 - config.discountPercent / 100;
        
        filteredItems = draftItems.map(item => {
          if (item.provider === 'Baker McKenzie') {
            const adjustedFee = roundToNearest1000((item.fee_amount || 0) * multiplier);
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
        const defaultComment = `${AFA_TYPE_LABELS[primaryAFA.afa_type]}: ${currencySymbol}${roundedClientPrice.toLocaleString()}`;
        globalComment = globalComment ? `${globalComment}. ${defaultComment}` : defaultComment;
        
        if (!discountAFA) {
          filteredItems = draftItems.map(item => ({
            ...item,
            original_fee_amount: item.fee_amount,
            fee_amount: roundToNearest1000(item.fee_amount || 0),
            afa_adjusted: false,
          }));
        }
        // If discountAFA was applied, filteredItems already has discounted values
    }
  } else if (!discountAFA) {
    // No primary AFA and no discount, just copy items with rounding
    filteredItems = draftItems.map(item => ({
      ...item,
      original_fee_amount: item.fee_amount,
      fee_amount: roundToNearest1000(item.fee_amount || 0),
      afa_adjusted: false,
    }));
  }
  // If no primary AFA but discountAFA exists, filteredItems was already set above

  // NOTE: Discounted rates are now applied at the START of this function (before primary AFA)
  // This ensures line items show the discounted baseline for fixed fee arrangements

  // Handle success fee (add-on)
  if (successFeeAFA) {
    const config = successFeeAFA.config as SuccessFeeConfig;
    const roundedUpliftAmount = roundToNearest1000(config.upliftAmount);
    appliedAFAs.push({
      type: 'success_fee',
      label: AFA_TYPE_LABELS['success_fee'],
      description: `Success fee: ${currencySymbol}${roundedUpliftAmount.toLocaleString()} (${config.upliftPercent}% uplift) on successful completion${config.successCondition ? ` - ${config.successCondition}` : ''}`,
      clientPrice: roundedUpliftAmount,
    });
    
    globalComment = globalComment 
      ? `${globalComment}. Success fee of ${currencySymbol}${roundedUpliftAmount.toLocaleString()} payable on completion.`
      : `Success fee: ${currencySymbol}${roundedUpliftAmount.toLocaleString()} on successful completion`;
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
 * Generate a human-readable description of the AFA for comments.
 * All monetary values are rounded to nearest $1,000 for client-facing output.
 */
function generateAFADescription(afa: ProposalAFA, currencySymbol: string): string {
  const roundedClientPrice = roundToNearest1000(afa.client_price);
  
  switch (afa.afa_type) {
    case 'fixed_fee_whole':
      return `Fixed fee of ${currencySymbol}${roundedClientPrice.toLocaleString()} for the entire matter`;
    case 'fixed_fee_phase': {
      const config = afa.config as FixedFeePhaseConfig;
      const phases = config.phases.filter(p => p.isIncluded);
      return `Fixed fees by phase: ${phases.length} phases totaling ${currencySymbol}${roundedClientPrice.toLocaleString()}`;
    }
    case 'blended_rate': {
      const config = afa.config as BlendedRateConfig;
      const rate = config.useManual && config.manualRate ? config.manualRate : config.calculatedRate;
      return `Blended rate of ${currencySymbol}${Math.round(rate)}/hour`;
    }
    case 'fee_cap': {
      const config = afa.config as FeeCapConfig;
      return config.capType === 'amount'
        ? `Fee cap of ${currencySymbol}${roundToNearest1000(config.capAmount).toLocaleString()}`
        : `Fee cap at ${config.capPercentageAbove}% above estimate`;
    }
    case 'discounted_rates': {
      const config = afa.config as DiscountedRatesConfig;
      return `${config.discountPercent}% discount on standard rates`;
    }
    case 'success_fee': {
      const config = afa.config as SuccessFeeConfig;
      return `${config.upliftPercent}% success fee (${currencySymbol}${roundToNearest1000(config.upliftAmount).toLocaleString()})`;
    }
    default:
      return `${AFA_TYPE_LABELS[afa.afa_type]}: ${currencySymbol}${roundedClientPrice.toLocaleString()}`;
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
