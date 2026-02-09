// Tolling Agreement analysis categories
// Technology-aware: Gas CCGT/OCGT categories differ significantly from BESS categories

export interface TollingCategory {
  id: string;
  label: string;
  group: TollingCategoryGroup;
  /** Which technology types this category applies to. Empty = all technologies */
  technologies: TollingTechnologyType[];
}

export const TOLLING_TECHNOLOGY_TYPES = [
  { id: 'gas_ccgt', label: 'Gas CCGT' },
  { id: 'gas_ocgt', label: 'Gas OCGT' },
  { id: 'bess', label: 'Battery Energy Storage (BESS)' },
  { id: 'coal', label: 'Coal' },
  { id: 'biomass', label: 'Biomass' },
  { id: 'other', label: 'Other' },
] as const;

export type TollingTechnologyType = typeof TOLLING_TECHNOLOGY_TYPES[number]['id'];

export const TOLLING_FACILITY_STAGES = [
  { id: 'development', label: 'In Development (Pre-Construction)', description: 'Project is being developed; tolling agreement supports bankability' },
  { id: 'construction', label: 'Under Construction', description: 'Facility is being built; tolling agreement in place for project finance' },
  { id: 'operating', label: 'Operating Facility', description: 'Facility is already built and operational' },
] as const;

export type TollingFacilityStage = typeof TOLLING_FACILITY_STAGES[number]['id'];

export const TOLLING_CATEGORY_GROUPS = [
  'General',
  'Capacity & Availability',
  'Fuel & Conversion',
  'Energy Storage',
  'Dispatch & Operations',
  'Pricing & Payment',
  'Credit & Security',
  'Risk Allocation',
  'Construction & Development',
] as const;

export type TollingCategoryGroup = typeof TOLLING_CATEGORY_GROUPS[number];

// Helper: thermal = gas_ccgt, gas_ocgt, coal, biomass
const THERMAL: TollingTechnologyType[] = ['gas_ccgt', 'gas_ocgt', 'coal', 'biomass'];
const BESS: TollingTechnologyType[] = ['bess'];
const ALL: TollingTechnologyType[] = [];

export const TOLLING_ALL_CATEGORIES: TollingCategory[] = [
  // General (all technologies)
  { id: 'contract_term', label: 'Contract Term & Effective Date', group: 'General', technologies: ALL },
  { id: 'conditions_precedent', label: 'Conditions Precedent', group: 'General', technologies: ALL },
  { id: 'representations_warranties', label: 'Representations & Warranties', group: 'General', technologies: ALL },
  { id: 'assignment_transfer', label: 'Assignment & Transfer', group: 'General', technologies: ALL },
  { id: 'dispute_resolution', label: 'Dispute Resolution', group: 'General', technologies: ALL },

  // Capacity & Availability (all technologies)
  { id: 'dependable_capacity', label: 'Dependable Capacity', group: 'Capacity & Availability', technologies: ALL },
  { id: 'availability_guarantee', label: 'Availability Guarantee', group: 'Capacity & Availability', technologies: ALL },
  { id: 'capacity_testing', label: 'Capacity Testing & Adjustments', group: 'Capacity & Availability', technologies: ALL },
  { id: 'outages_maintenance', label: 'Outages & Scheduled Maintenance', group: 'Capacity & Availability', technologies: ALL },

  // Fuel & Conversion (thermal only)
  { id: 'fuel_supply_delivery', label: 'Fuel Supply & Delivery', group: 'Fuel & Conversion', technologies: THERMAL },
  { id: 'fuel_specifications', label: 'Fuel Specifications & Quality', group: 'Fuel & Conversion', technologies: THERMAL },
  { id: 'heat_rate_guarantee', label: 'Heat Rate Guarantee', group: 'Fuel & Conversion', technologies: THERMAL },
  { id: 'fuel_conversion_services', label: 'Fuel Conversion Services', group: 'Fuel & Conversion', technologies: THERMAL },

  // Energy Storage (BESS only)
  { id: 'storage_capacity', label: 'Storage Capacity (MWh) & Duration', group: 'Energy Storage', technologies: BESS },
  { id: 'round_trip_efficiency', label: 'Round-Trip Efficiency Guarantee', group: 'Energy Storage', technologies: BESS },
  { id: 'state_of_charge', label: 'State of Charge Management', group: 'Energy Storage', technologies: BESS },
  { id: 'cycle_degradation', label: 'Cycle Degradation & Throughput Limits', group: 'Energy Storage', technologies: BESS },
  { id: 'augmentation', label: 'Augmentation Obligations', group: 'Energy Storage', technologies: BESS },
  { id: 'charging_arrangements', label: 'Charging Arrangements & Grid Import', group: 'Energy Storage', technologies: BESS },

  // Dispatch & Operations (all technologies)
  { id: 'dispatch_rights', label: 'Dispatch Rights & Exclusivity', group: 'Dispatch & Operations', technologies: ALL },
  { id: 'dispatch_procedures', label: 'Dispatch Procedures & Notices', group: 'Dispatch & Operations', technologies: ALL },
  { id: 'ancillary_services', label: 'Ancillary Services', group: 'Dispatch & Operations', technologies: ALL },
  { id: 'metering_measurement', label: 'Metering & Measurement', group: 'Dispatch & Operations', technologies: ALL },
  { id: 'facility_utilization', label: 'Facility Utilization Planning', group: 'Dispatch & Operations', technologies: ALL },
  { id: 'environmental_compliance', label: 'Environmental Compliance', group: 'Dispatch & Operations', technologies: THERMAL },

  // Pricing & Payment (all, but structure differs)
  { id: 'fixed_capacity_payment', label: 'Fixed Capacity Payment', group: 'Pricing & Payment', technologies: ALL },
  { id: 'variable_energy_payment', label: 'Variable Energy Payment', group: 'Pricing & Payment', technologies: ALL },
  { id: 'start_up_charges', label: 'Start-Up Charges', group: 'Pricing & Payment', technologies: THERMAL },
  { id: 'revenue_sharing', label: 'Revenue Sharing & Optimisation', group: 'Pricing & Payment', technologies: BESS },
  { id: 'payment_billing', label: 'Payment & Billing Terms', group: 'Pricing & Payment', technologies: ALL },
  { id: 'taxes_duties', label: 'Taxes & Duties', group: 'Pricing & Payment', technologies: ALL },

  // Credit & Security (all)
  { id: 'credit_support', label: 'Credit Support & Security', group: 'Credit & Security', technologies: ALL },
  { id: 'lender_consent', label: 'Lender Consent & Financing', group: 'Credit & Security', technologies: ALL },
  { id: 'insurance', label: 'Insurance Requirements', group: 'Credit & Security', technologies: ALL },

  // Risk Allocation (all)
  { id: 'force_majeure', label: 'Force Majeure', group: 'Risk Allocation', technologies: ALL },
  { id: 'change_in_law', label: 'Change in Law', group: 'Risk Allocation', technologies: ALL },
  { id: 'default_termination', label: 'Default & Termination', group: 'Risk Allocation', technologies: ALL },
  { id: 'termination_payments', label: 'Termination Payments & LDs', group: 'Risk Allocation', technologies: ALL },
  { id: 'indemnities', label: 'Indemnities', group: 'Risk Allocation', technologies: ALL },
  { id: 'liability_caps', label: 'Liability Caps & Limitations', group: 'Risk Allocation', technologies: ALL },

  // Construction & Development (development/construction stage only - all technologies)
  { id: 'construction_milestones', label: 'Construction Milestones & COD', group: 'Construction & Development', technologies: ALL },
  { id: 'performance_testing', label: 'Performance Testing at COD', group: 'Construction & Development', technologies: ALL },
  { id: 'delay_liquidated_damages', label: 'Delay Liquidated Damages', group: 'Construction & Development', technologies: ALL },
  { id: 'commissioning', label: 'Commissioning & Takeover', group: 'Construction & Development', technologies: ALL },
];

/**
 * Get categories applicable to a given technology and facility stage.
 * If technology is empty/null, returns all categories.
 */
export function getCategoriesForContext(
  technology?: TollingTechnologyType | null,
  facilityStage?: TollingFacilityStage | null,
): TollingCategory[] {
  return TOLLING_ALL_CATEGORIES.filter(c => {
    // Technology filter: if category has specific technologies, check match
    if (c.technologies.length > 0 && technology) {
      if (!c.technologies.includes(technology)) return false;
    }
    // Stage filter: construction/development categories only for non-operating
    if (c.group === 'Construction & Development' && facilityStage === 'operating') {
      return false;
    }
    return true;
  });
}

export function getTollingCategoryById(id: string): TollingCategory | undefined {
  return TOLLING_ALL_CATEGORIES.find(c => c.id === id);
}

export function getTollingCategoriesByGroup(group: TollingCategoryGroup): TollingCategory[] {
  return TOLLING_ALL_CATEGORIES.filter(c => c.group === group);
}

/** Check if a technology is thermal (gas/coal/biomass) */
export function isThermalTechnology(tech: string | null | undefined): boolean {
  return !!tech && ['gas_ccgt', 'gas_ocgt', 'coal', 'biomass'].includes(tech);
}

/** Check if a technology is BESS */
export function isBessTechnology(tech: string | null | undefined): boolean {
  return tech === 'bess';
}
