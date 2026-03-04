/**
 * Utilities for applying AFA (Alternative Fee Arrangement) filters to work items
 * and generating filtered exports with explanatory comments.
 */

import { DraftProposalItem, FigureType } from '@/lib/hooks/usePricingProposals';
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
  AbortDiscountConfig,
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
 * Get the appropriate fee value based on the figure type selection.
 * For local counsel items, always use fee_amount (single figure).
 */
export function getItemFeeByFigureType(item: DraftProposalItem, figureType: FigureType): number {
  // Local counsel items always use single fee_amount
  if (item.provider === 'Local Counsel') {
    return item.fee_amount || 0;
  }
  
  switch (figureType) {
    case 'lower':
      return item.fee_lower ?? item.fee_amount ?? 0;
    case 'upper':
      return item.fee_upper ?? item.fee_amount ?? 0;
    case 'midpoint':
    default:
      return item.fee_amount ?? 0;
  }
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
 * Dynamic rounding based on value size:
 * - Values < 10,000: round to nearest 100
 * - Values >= 10,000: round to nearest 1,000
 */
function smartRound(value: number): number {
  if (Math.abs(value) < 10000) {
    return Math.round(value / 100) * 100;
  }
  return Math.round(value / 1000) * 1000;
}

/**
 * Get the rounding increment for a value (100 or 1000).
 */
function getRoundingIncrement(value: number): number {
  return Math.abs(value) < 10000 ? 100 : 1000;
}

/**
 * Apply intelligent rounding using the largest remainder method.
 * This ensures the sum of rounded values exactly equals the rounded target.
 * 
 * Uses dynamic rounding increments:
 * - Items < 10,000: floor/round to nearest 100
 * - Items >= 10,000: floor/round to nearest 1,000
 * 
 * Algorithm:
 * 1. Floor each value to appropriate increment (100 or 1000)
 * 2. Calculate remainder (fractional part) for each
 * 3. Calculate shortfall between floored sum and target
 * 4. Distribute shortfall in appropriate increments to items with largest remainders
 * 
 * @param items Array of objects with fee values to round
 * @param getExactValue Function to get the exact (unrounded) value from each item
 * @param targetAggregate The rounded aggregate that line items must sum to
 * @returns Map of item index to rounded value
 */
function applyLargestRemainderRounding<T>(
  items: T[],
  getExactValue: (item: T) => number,
  targetAggregate: number
): Map<number, number> {
  const result = new Map<number, number>();
  
  if (items.length === 0) return result;
  
  // Calculate floored values and remainders using dynamic increments
  const itemData = items.map((item, index) => {
    const exactValue = getExactValue(item);
    const increment = getRoundingIncrement(exactValue);
    const floored = Math.floor(exactValue / increment) * increment;
    const remainder = exactValue - floored; // Fractional part
    return { index, exactValue, floored, remainder, increment };
  });
  
  // Sum of floored values
  const flooredSum = itemData.reduce((sum, d) => sum + d.floored, 0);
  
  // How much shortfall do we have?
  const shortfall = targetAggregate - flooredSum;
  
  if (shortfall > 0) {
    // Sort by remainder descending - items with largest remainders get rounded up
    const sortedByRemainder = [...itemData].sort((a, b) => b.remainder - a.remainder);
    
    // Distribute shortfall, respecting each item's increment size
    let remaining = shortfall;
    for (const item of sortedByRemainder) {
      if (remaining <= 0) break;
      const add = Math.min(item.increment, remaining);
      item.floored += add;
      remaining -= add;
    }
  } else if (shortfall < 0) {
    // Rare case: need to subtract
    const sortedByRemainder = [...itemData].sort((a, b) => a.remainder - b.remainder);
    let remaining = Math.abs(shortfall);
    
    for (const item of sortedByRemainder) {
      if (remaining <= 0) break;
      const subtract = Math.min(item.increment, remaining, item.floored);
      if (subtract > 0) {
        item.floored -= subtract;
        remaining -= subtract;
      }
    }
  }
  
  // Build result map
  for (const d of itemData) {
    result.set(d.index, d.floored);
  }
  
  return result;
}

/**
 * Apply AFA filters to work items and return adjusted items with comments.
 * All monetary values are rounded to nearest $1,000 for client-facing output.
 * 
 * @param draftItems - The draft proposal items
 * @param enabledAFAs - List of enabled AFAs
 * @param baselineTotal - The baseline total (sum of selected figure type)
 * @param currencySymbol - Currency symbol for formatting
 * @param baseFigure - Which figure to use as baseline (lower/midpoint/upper)
 */
export function applyAFAFilters(
  draftItems: DraftProposalItem[],
  enabledAFAs: ProposalAFA[],
  baselineTotal: number,
  currencySymbol: string = '£',
  baseFigure: FigureType = 'midpoint'
): AFAFilterResult {
  // Get fee amounts based on selected figure type, applying multiplier
  const itemsWithBaseFee = draftItems.map(item => {
    const mult = (item.is_multiplied && item.multiplier_qty) ? item.multiplier_qty : 1;
    return {
      ...item,
      fee_amount: getItemFeeByFigureType(item, baseFigure) * mult,
    };
  });

  // Helper function to apply largest remainder rounding to a group of items
  // This ensures line items sum exactly to the rounded aggregate
  const applyReconciliationRounding = (
    items: typeof itemsWithBaseFee,
    getExactValue: (item: typeof itemsWithBaseFee[0]) => number,
    targetAggregate: number,
    filterFn: (item: typeof itemsWithBaseFee[0]) => boolean
  ): Map<number, number> => {
    // Build list of items with their ORIGINAL indices preserved
    const filteredWithIndices = items
      .map((item, index) => ({ item, originalIndex: index }))
      .filter(({ item }) => filterFn(item) && (item.is_included !== false || !item.is_optional));
    
    // applyLargestRemainderRounding returns a Map keyed by index in the filtered array
    const roundedValues = applyLargestRemainderRounding(
      filteredWithIndices,
      ({ item }) => getExactValue(item),
      targetAggregate
    );
    
    // Map back from filtered array index to ORIGINAL array index
    const indexToRoundedFee = new Map<number, number>();
    filteredWithIndices.forEach((entry, filteredIdx) => {
      const rounded = roundedValues.get(filteredIdx);
      if (rounded !== undefined) {
        indexToRoundedFee.set(entry.originalIndex, rounded);
      }
    });
    
    return indexToRoundedFee;
  };

  if (enabledAFAs.length === 0) {
    // No AFAs enabled - return items with selected figure type fee, properly rounded
    // Apply largest remainder rounding to ensure totals reconcile
    const targetBmTotal = smartRound(itemsWithBaseFee
      .filter(item => item.provider === 'Baker McKenzie' && (item.is_included !== false || !item.is_optional))
      .reduce((sum, item) => sum + (item.fee_amount || 0), 0));
    const targetLcTotal = smartRound(itemsWithBaseFee
      .filter(item => item.provider === 'Local Counsel' && (item.is_included !== false || !item.is_optional))
      .reduce((sum, item) => sum + (item.fee_amount || 0), 0));
    
    const bmRounded = applyReconciliationRounding(
      itemsWithBaseFee,
      item => item.fee_amount || 0,
      targetBmTotal,
      item => item.provider === 'Baker McKenzie'
    );
    const lcRounded = applyReconciliationRounding(
      itemsWithBaseFee,
      item => item.fee_amount || 0,
      targetLcTotal,
      item => item.provider === 'Local Counsel'
    );
    
    return {
      items: itemsWithBaseFee.map((item, index) => ({
        ...item,
        original_fee_amount: item.fee_amount,
        fee_amount: bmRounded.get(index) ?? lcRounded.get(index) ?? smartRound(item.fee_amount || 0),
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

  // Calculate original totals using the selected figure type
  const originalBmTotal = itemsWithBaseFee
    .filter(item => item.provider === 'Baker McKenzie' && (item.is_included !== false || !item.is_optional))
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  const originalLcTotal = itemsWithBaseFee
    .filter(item => item.provider === 'Local Counsel' && (item.is_included !== false || !item.is_optional))
    .reduce((sum, item) => sum + (item.fee_amount || 0), 0);
  
  // Pre-calculate rounded LC values using largest remainder method
  // This ensures LC items always sum to the rounded aggregate
  const targetLcAggregate = smartRound(originalLcTotal);
  const lcRoundedMap = applyReconciliationRounding(
    itemsWithBaseFee,
    item => item.fee_amount || 0,
    targetLcAggregate,
    item => item.provider === 'Local Counsel'
  );

  // STEP 1: Note discounted rates if enabled as secondary AFA
  // Rate discounts do NOT reduce the budget — they lower the hourly rate so the team can work more hours.
  // Budget line items remain at their original (undiscounted) values.
  let discountMultiplier = 1;
  let discountedBmTotal = originalBmTotal;
  
  if (discountAFA && primaryAFA?.afa_type !== 'discounted_rates') {
    const config = discountAFA.config as DiscountedRatesConfig;
    discountMultiplier = 1 - config.discountPercent / 100;
    discountedBmTotal = originalBmTotal * discountMultiplier;
    
    // Calculate the discounted total for informational display only
    const targetBmAggregate = smartRound(discountedBmTotal);
    
    // Apply reconciled rounding to BM items at their ORIGINAL fees (no discount applied to budget)
    const targetBmOriginal = smartRound(originalBmTotal);
    const bmRoundedMap = applyReconciliationRounding(
      itemsWithBaseFee,
      item => item.fee_amount || 0,
      targetBmOriginal,
      item => item.provider === 'Baker McKenzie'
    );
    
    // Initialize filtered items with original (undiscounted) amounts
    filteredItems = itemsWithBaseFee.map((item, index) => {
      if (item.provider === 'Baker McKenzie') {
        const roundedFee = bmRoundedMap.get(index) ?? smartRound(item.fee_amount || 0);
        return {
          ...item,
          original_fee_amount: item.fee_amount,
          fee_amount: roundedFee,
          afa_adjusted: false,
          afa_comment: undefined,
        };
      }
      // LC items use reconciled rounding
      const lcRoundedFee = lcRoundedMap.get(index) ?? smartRound(item.fee_amount || 0);
      return {
        ...item,
        original_fee_amount: item.fee_amount,
        fee_amount: lcRoundedFee,
        afa_adjusted: false,
      };
    });
    
    appliedAFAs.push({
      type: 'discounted_rates',
      label: AFA_TYPE_LABELS['discounted_rates'],
      description: `${config.discountPercent}% discount on standard rates — team can record more hours within the same budget`,
      clientPrice: targetBmAggregate + targetLcAggregate,
    });
    
    globalComment = `${config.discountPercent}% rate discount applied to standard rates`;
  }

  // STEP 2: Apply primary AFA (but don't modify line items for fixed fees - they already show discounted baseline)
  if (primaryAFA) {
    const roundedClientPrice = smartRound(primaryAFA.client_price);
    
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
          filteredItems = itemsWithBaseFee.map(item => ({
            ...item,
            original_fee_amount: item.fee_amount,
            fee_amount: smartRound(item.fee_amount || 0),
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
          return smartRound(adjusted);
        };
        
        const phaseComment = `Fixed fees by phase: ${includedPhases.map(p => `${p.category} (${currencySymbol}${getPhaseAdjustedAmount(p).toLocaleString()})`).join(', ')}`;
        globalComment = globalComment 
          ? `${globalComment}. ${phaseComment}`
          : phaseComment;
        
        // If no discount was applied, initialize filtered items (unchanged, just rounded)
        // If no discount was applied, initialize filtered items (unchanged, just rounded)
        if (!discountAFA) {
          filteredItems = itemsWithBaseFee.map(item => ({
            ...item,
            original_fee_amount: item.fee_amount,
            fee_amount: smartRound(item.fee_amount || 0),
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
        filteredItems = itemsWithBaseFee.map(item => {
          if (item.provider === 'Baker McKenzie') {
            const adjustedFee = smartRound((item.fee_amount || 0) * adjustmentRatio);
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
        const roundedCapAmount = smartRound(config.capAmount);
        const capComment = config.capType === 'amount' 
          ? `Fee cap: ${currencySymbol}${roundedCapAmount.toLocaleString()} - time-based billing up to this maximum`
          : `Fee cap: ${config.capPercentageAbove}% above estimate (cap at ${currencySymbol}${roundedClientPrice.toLocaleString()})`;
        globalComment = globalComment ? `${globalComment}. ${capComment}` : capComment;
        
        // If discount already applied, keep those items; otherwise initialize
        if (!discountAFA) {
          filteredItems = itemsWithBaseFee.map(item => ({
            ...item,
            original_fee_amount: item.fee_amount,
            fee_amount: smartRound(item.fee_amount || 0),
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
        globalComment = `${config.discountPercent}% rate discount applied to standard rates — team hours adjusted accordingly`;
        
        // Rate discounts do NOT reduce the budget — budget stays at original values.
        // The discount lowers hourly rates so the team can work more hours within the same budget.
        const targetBmOriginal = smartRound(originalBmTotal);
        
        // Apply reconciled rounding to BM items at their ORIGINAL fees
        const bmRoundedMap = applyReconciliationRounding(
          itemsWithBaseFee,
          item => item.fee_amount || 0,
          targetBmOriginal,
          item => item.provider === 'Baker McKenzie'
        );
        
        filteredItems = itemsWithBaseFee.map((item, index) => {
          if (item.provider === 'Baker McKenzie') {
            const roundedFee = bmRoundedMap.get(index) ?? smartRound(item.fee_amount || 0);
            return {
              ...item,
              original_fee_amount: item.fee_amount,
              fee_amount: roundedFee,
              afa_adjusted: false,
              afa_comment: `${config.discountPercent}% rate discount applied (team hours adjusted)`,
            };
          }
          // LC items use reconciled rounding
          const lcRoundedFee = lcRoundedMap.get(index) ?? smartRound(item.fee_amount || 0);
          return {
            ...item,
            original_fee_amount: item.fee_amount,
            fee_amount: lcRoundedFee,
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
          // Apply reconciled rounding for both BM and LC items
          const targetBmTotal = smartRound(originalBmTotal);
          const bmRoundedMap = applyReconciliationRounding(
            itemsWithBaseFee,
            item => item.fee_amount || 0,
            targetBmTotal,
            item => item.provider === 'Baker McKenzie'
          );
          
          filteredItems = itemsWithBaseFee.map((item, index) => ({
            ...item,
            original_fee_amount: item.fee_amount,
            fee_amount: bmRoundedMap.get(index) ?? lcRoundedMap.get(index) ?? smartRound(item.fee_amount || 0),
            afa_adjusted: false,
          }));
        }
        // If discountAFA was applied, filteredItems already has discounted values
    }
  } else if (!discountAFA) {
    // No primary AFA and no discount, apply reconciled rounding
    const targetBmTotal = smartRound(originalBmTotal);
    const bmRoundedMap = applyReconciliationRounding(
      itemsWithBaseFee,
      item => item.fee_amount || 0,
      targetBmTotal,
      item => item.provider === 'Baker McKenzie'
    );
    
    filteredItems = itemsWithBaseFee.map((item, index) => ({
      ...item,
      original_fee_amount: item.fee_amount,
      fee_amount: bmRoundedMap.get(index) ?? lcRoundedMap.get(index) ?? smartRound(item.fee_amount || 0),
      afa_adjusted: false,
    }));
  }
  // If no primary AFA but discountAFA exists, filteredItems was already set above

  // NOTE: Discounted rates are now applied at the START of this function (before primary AFA)
  // This ensures line items show the discounted baseline for fixed fee arrangements

  // Handle success fee (add-on)
  if (successFeeAFA) {
    const config = successFeeAFA.config as SuccessFeeConfig;
    const roundedUpliftAmount = smartRound(config.upliftAmount);
    const isClientOption = config.commitmentType === 'client_option';
    const commitLabel = isClientOption ? 'Optional success fee (client option)' : 'Success fee (firm agreed)';
    appliedAFAs.push({
      type: 'success_fee',
      label: commitLabel,
      description: isClientOption
        ? `Optional success fee for client consideration: ${currencySymbol}${roundedUpliftAmount.toLocaleString()} (${config.upliftPercent}% uplift) if the transaction completes successfully${config.successCondition ? ` — ${config.successCondition}` : ''}`
        : `Success fee: ${currencySymbol}${roundedUpliftAmount.toLocaleString()} (${config.upliftPercent}% uplift) on successful completion${config.successCondition ? ` — ${config.successCondition}` : ''}`,
      clientPrice: roundedUpliftAmount,
    });
    
    globalComment = globalComment 
      ? `${globalComment}. ${isClientOption ? `Optional success fee of ${currencySymbol}${roundedUpliftAmount.toLocaleString()} for client consideration on successful completion.` : `Success fee of ${currencySymbol}${roundedUpliftAmount.toLocaleString()} payable on completion.`}`
      : isClientOption
        ? `Optional success fee: ${currencySymbol}${roundedUpliftAmount.toLocaleString()} for client consideration on successful completion`
        : `Success fee: ${currencySymbol}${roundedUpliftAmount.toLocaleString()} on successful completion`;
  }

  // Handle abort discount (add-on)
  const abortDiscountAFA = enabledAFAs.find(a => a.afa_type === 'abort_discount');
  if (abortDiscountAFA) {
    const config = abortDiscountAFA.config as AbortDiscountConfig;
    appliedAFAs.push({
      type: 'abort_discount',
      label: AFA_TYPE_LABELS['abort_discount'],
      description: `Abort discount: ${config.discountPercent}% of total WIP to be written off in the event the transaction aborts`,
      clientPrice: 0,
    });
    
    const abortComment = `Abort discount of ${config.discountPercent}% of total WIP agreed in the event the transaction does not complete.`;
    globalComment = globalComment 
      ? `${globalComment}. ${abortComment}`
      : abortComment;
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
 * Uses smart rounding: nearest 100 for <10k, nearest 1000 for >=10k.
 */
function generateAFADescription(afa: ProposalAFA, currencySymbol: string): string {
  const roundedClientPrice = smartRound(afa.client_price);
  
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
        ? `Fee cap of ${currencySymbol}${smartRound(config.capAmount).toLocaleString()}`
        : `Fee cap at ${config.capPercentageAbove}% above estimate`;
    }
    case 'discounted_rates': {
      const config = afa.config as DiscountedRatesConfig;
      return `${config.discountPercent}% discount on standard rates`;
    }
    case 'success_fee': {
      const config = afa.config as SuccessFeeConfig;
      const isClientOption = config.commitmentType === 'client_option';
      return isClientOption
        ? `${config.upliftPercent}% optional success fee for client consideration (${currencySymbol}${smartRound(config.upliftAmount).toLocaleString()})`
        : `${config.upliftPercent}% success fee — firm agreed (${currencySymbol}${smartRound(config.upliftAmount).toLocaleString()})`;
    }
    case 'abort_discount': {
      const config = afa.config as AbortDiscountConfig;
      return `${config.discountPercent}% abort discount on total WIP`;
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
