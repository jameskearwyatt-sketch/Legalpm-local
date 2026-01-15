/**
 * AFA Compatibility Matrix
 * 
 * Defines which AFAs can be layered together and which are mutually exclusive.
 * 
 * Categories:
 * 1. Rate Modifiers: Affect how fees are calculated
 *    - discounted_rates: Applies % discount to standard rates
 *    - blended_rate: Replaces individual rates with single rate
 * 
 * 2. Pricing Models: Determine final fee structure
 *    - fixed_fee_whole: Single fixed fee for entire matter
 *    - fixed_fee_phase: Fixed fees per workstream
 *    - fee_cap: Maximum fee ceiling
 *    - fee_collar: Target with bands
 *    - milestone: Payment on deliverables
 *    - monthly_retainer: Fixed monthly fee
 * 
 * 3. Add-ons: Can compound with any pricing model
 *    - success_fee: Optional uplift on success
 * 
 * Layering Rules:
 * - Rate modifiers are mutually exclusive with each other
 * - Fixed fee variants are mutually exclusive with each other
 * - Fee cap and collar are mutually exclusive with fixed fee options
 * - Rate modifiers CAN be calculation basis for fixed fees
 * - Success fee can always compound with any pricing model
 */

import { AFAType } from '@/lib/hooks/useProposalAFAs';

export type AFACategory = 'rate_modifier' | 'pricing_model' | 'add_on';

export const AFA_CATEGORIES: Record<AFAType, AFACategory> = {
  discounted_rates: 'rate_modifier',
  blended_rate: 'rate_modifier',
  fixed_fee_whole: 'pricing_model',
  fixed_fee_phase: 'pricing_model',
  fee_cap: 'pricing_model',
  fee_collar: 'pricing_model',
  milestone: 'pricing_model',
  monthly_retainer: 'pricing_model',
  success_fee: 'add_on',
};

// Groups of mutually exclusive AFAs
const RATE_MODIFIERS: AFAType[] = ['discounted_rates', 'blended_rate'];
const FIXED_FEE_VARIANTS: AFAType[] = ['fixed_fee_whole', 'fixed_fee_phase'];
const FEE_CAP_TYPES: AFAType[] = ['fee_cap', 'fee_collar'];

// AFAs that can use a rate modifier as their calculation basis
const CAN_USE_RATE_BASIS: AFAType[] = ['fixed_fee_whole', 'fixed_fee_phase'];

// AFAs that are always available as add-ons
const ALWAYS_AVAILABLE: AFAType[] = ['success_fee'];

export interface AFACompatibilityResult {
  isAvailable: boolean;
  isBlocked: boolean;
  blockedBy: AFAType[];
  canBeUsedAsBasis: boolean;
  usedAsBasisFor: AFAType[];
  reason?: string;
}

/**
 * Check if enabling a specific AFA type is compatible with currently enabled AFAs
 */
export function checkAFACompatibility(
  targetType: AFAType,
  enabledAFAs: AFAType[]
): AFACompatibilityResult {
  // Success fee is always available
  if (ALWAYS_AVAILABLE.includes(targetType)) {
    return {
      isAvailable: true,
      isBlocked: false,
      blockedBy: [],
      canBeUsedAsBasis: false,
      usedAsBasisFor: [],
    };
  }

  const blockedBy: AFAType[] = [];
  let reason: string | undefined;

  // Check rate modifier mutual exclusivity
  if (RATE_MODIFIERS.includes(targetType)) {
    const conflictingRateModifiers = enabledAFAs.filter(
      afa => RATE_MODIFIERS.includes(afa) && afa !== targetType
    );
    if (conflictingRateModifiers.length > 0) {
      blockedBy.push(...conflictingRateModifiers);
      reason = 'Only one rate modifier can be active at a time';
    }
  }

  // Check fixed fee mutual exclusivity
  if (FIXED_FEE_VARIANTS.includes(targetType)) {
    const conflictingFixedFees = enabledAFAs.filter(
      afa => FIXED_FEE_VARIANTS.includes(afa) && afa !== targetType
    );
    if (conflictingFixedFees.length > 0) {
      blockedBy.push(...conflictingFixedFees);
      reason = 'Only one fixed fee structure can be active at a time';
    }

    // Fixed fees are mutually exclusive with fee cap/collar
    const conflictingCaps = enabledAFAs.filter(afa => FEE_CAP_TYPES.includes(afa));
    if (conflictingCaps.length > 0) {
      blockedBy.push(...conflictingCaps);
      reason = 'Fixed fees are mutually exclusive with fee caps/collars';
    }
  }

  // Check fee cap/collar mutual exclusivity with fixed fees and each other
  if (FEE_CAP_TYPES.includes(targetType)) {
    // Mutually exclusive with other fee cap types
    const conflictingCaps = enabledAFAs.filter(
      afa => FEE_CAP_TYPES.includes(afa) && afa !== targetType
    );
    if (conflictingCaps.length > 0) {
      blockedBy.push(...conflictingCaps);
      reason = 'Only one fee cap/collar can be active at a time';
    }

    // Mutually exclusive with fixed fees
    const conflictingFixedFees = enabledAFAs.filter(afa => FIXED_FEE_VARIANTS.includes(afa));
    if (conflictingFixedFees.length > 0) {
      blockedBy.push(...conflictingFixedFees);
      reason = 'Fee caps/collars are mutually exclusive with fixed fees';
    }
  }

  // Check if this AFA can be used as a basis for others
  const canBeUsedAsBasis = RATE_MODIFIERS.includes(targetType);
  const usedAsBasisFor = canBeUsedAsBasis
    ? enabledAFAs.filter(afa => CAN_USE_RATE_BASIS.includes(afa))
    : [];

  return {
    isAvailable: blockedBy.length === 0,
    isBlocked: blockedBy.length > 0,
    blockedBy,
    canBeUsedAsBasis,
    usedAsBasisFor,
    reason,
  };
}

/**
 * Get all AFAs that would be blocked if a specific AFA is enabled
 */
export function getBlockedAFAs(targetType: AFAType): AFAType[] {
  const blocked: AFAType[] = [];

  // Rate modifiers block each other
  if (RATE_MODIFIERS.includes(targetType)) {
    blocked.push(...RATE_MODIFIERS.filter(t => t !== targetType));
  }

  // Fixed fee variants block each other and fee caps
  if (FIXED_FEE_VARIANTS.includes(targetType)) {
    blocked.push(...FIXED_FEE_VARIANTS.filter(t => t !== targetType));
    blocked.push(...FEE_CAP_TYPES);
  }

  // Fee caps block each other and fixed fees
  if (FEE_CAP_TYPES.includes(targetType)) {
    blocked.push(...FEE_CAP_TYPES.filter(t => t !== targetType));
    blocked.push(...FIXED_FEE_VARIANTS);
  }

  return blocked;
}

/**
 * Get the active rate modifier that should be used as calculation basis
 */
export function getActiveRateModifier(enabledAFAs: AFAType[]): AFAType | null {
  for (const modifier of RATE_MODIFIERS) {
    if (enabledAFAs.includes(modifier)) {
      return modifier;
    }
  }
  return null;
}

/**
 * Check if a rate modifier is being used as basis for fixed fee calculations
 */
export function isRateModifierUsedAsBasis(
  rateModifier: AFAType,
  enabledAFAs: AFAType[]
): boolean {
  if (!RATE_MODIFIERS.includes(rateModifier)) return false;
  return enabledAFAs.some(afa => CAN_USE_RATE_BASIS.includes(afa));
}

/**
 * Get all currently compatible AFAs that can be enabled
 */
export function getAvailableAFAs(enabledAFAs: AFAType[]): AFAType[] {
  const allTypes: AFAType[] = [
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

  return allTypes.filter(type => {
    const compatibility = checkAFACompatibility(type, enabledAFAs);
    return compatibility.isAvailable;
  });
}

/**
 * Get human-readable explanation of layering for UI
 */
export function getLayeringExplanation(targetType: AFAType, enabledAFAs: AFAType[]): string | null {
  const activeRateModifier = getActiveRateModifier(enabledAFAs);
  
  // If enabling a fixed fee and a rate modifier is active, explain the basis
  if (CAN_USE_RATE_BASIS.includes(targetType) && activeRateModifier) {
    if (activeRateModifier === 'discounted_rates') {
      return 'Fixed fees will be calculated using discounted rates as the baseline';
    }
    if (activeRateModifier === 'blended_rate') {
      return 'Fixed fees will be calculated using the blended rate as the baseline';
    }
  }

  return null;
}
