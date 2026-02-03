/**
 * Utility functions for calculating risk-based fee spreads.
 * 
 * The spread between lower and upper estimates is determined by the perceived
 * risk/variability of the work category:
 * - Lower risk (more predictable): 10-12% spread
 * - Medium risk: 13-17% spread  
 * - Higher risk (more variable): 18-20% spread
 */

// Category risk levels - higher risk = larger spread
const CATEGORY_RISK_LEVELS: Record<string, 'low' | 'medium' | 'high'> = {
  // Low risk - predictable, standardized work
  'Closing': 'low',
  'Meetings': 'low',
  'Legal Opinions': 'low',
  
  // Medium risk - some variability expected
  'Due Diligence': 'medium',
  'Documentation': 'medium',
  'Tax': 'medium',
  
  // High risk - significant variability possible
  'Negotiations': 'high',
  'Regulatory': 'high',
  'Other': 'medium', // Default to medium for unknown categories
};

// Spread percentages by risk level
const SPREAD_PERCENTAGES: Record<'low' | 'medium' | 'high', number> = {
  low: 0.10,    // 10% spread
  medium: 0.15, // 15% spread
  high: 0.20,   // 20% spread
};

/**
 * Get the risk level for a category
 */
export function getCategoryRiskLevel(category: string | null | undefined): 'low' | 'medium' | 'high' {
  if (!category) return 'medium';
  return CATEGORY_RISK_LEVELS[category] ?? 'medium';
}

/**
 * Get the spread percentage for a category (0.10 to 0.20)
 */
export function getCategorySpreadPercentage(category: string | null | undefined): number {
  const riskLevel = getCategoryRiskLevel(category);
  return SPREAD_PERCENTAGES[riskLevel];
}

/**
 * Calculate fee_lower based on fee_upper and category risk.
 * The lower estimate is (100% - spread%) of the upper estimate.
 * 
 * @param feeUpper The upper estimate (primary fee)
 * @param category The work category (determines spread)
 * @returns The lower estimate, rounded to nearest 100 or 1000 based on amount
 */
export function calculateFeeLower(
  feeUpper: number,
  category: string | null | undefined
): number {
  if (feeUpper <= 0) return 0;
  
  const spreadPercentage = getCategorySpreadPercentage(category);
  const feeLower = feeUpper * (1 - spreadPercentage);
  
  // Apply smart rounding (same as other fee calculations)
  return smartRoundFee(feeLower);
}

/**
 * Calculate both fee_lower and fee_amount (midpoint) from fee_upper
 * 
 * @param feeUpper The upper estimate
 * @param category The work category
 * @returns Object with fee_lower and fee_amount (midpoint)
 */
export function calculateFeeRange(
  feeUpper: number,
  category: string | null | undefined
): { fee_lower: number; fee_amount: number } {
  const fee_lower = calculateFeeLower(feeUpper, category);
  const fee_amount = smartRoundFee((fee_lower + feeUpper) / 2);
  
  return { fee_lower, fee_amount };
}

/**
 * Smart rounding for fees: nearest 100 for <10k, nearest 1000 for >=10k
 */
export function smartRoundFee(value: number): number {
  const absValue = Math.abs(value);
  if (absValue < 10000) {
    return Math.round(value / 100) * 100;
  }
  return Math.round(value / 1000) * 1000;
}

/**
 * Batch calculate fee ranges for multiple items
 * Returns a map of index -> { fee_lower, fee_amount, fee_upper }
 */
export function calculateFeeRangesForItems(
  items: { index: number; fee_upper: number; category: string | null | undefined }[]
): Map<number, { fee_lower: number; fee_amount: number; fee_upper: number }> {
  const result = new Map<number, { fee_lower: number; fee_amount: number; fee_upper: number }>();
  
  items.forEach(item => {
    const { fee_lower, fee_amount } = calculateFeeRange(item.fee_upper, item.category);
    result.set(item.index, {
      fee_lower,
      fee_amount,
      fee_upper: item.fee_upper,
    });
  });
  
  return result;
}
