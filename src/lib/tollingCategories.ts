// Tolling Agreement analysis categories derived from Baker McKenzie CCGT precedent

export interface TollingCategory {
  id: string;
  label: string;
  group: TollingCategoryGroup;
}

export const TOLLING_CATEGORY_GROUPS = [
  'General',
  'Capacity & Availability',
  'Fuel & Conversion',
  'Dispatch & Operations',
  'Pricing & Payment',
  'Credit & Security',
  'Risk Allocation',
] as const;

export type TollingCategoryGroup = typeof TOLLING_CATEGORY_GROUPS[number];

export const TOLLING_ALL_CATEGORIES: TollingCategory[] = [
  // General
  { id: 'contract_term', label: 'Contract Term & Effective Date', group: 'General' },
  { id: 'conditions_precedent', label: 'Conditions Precedent', group: 'General' },
  { id: 'representations_warranties', label: 'Representations & Warranties', group: 'General' },
  { id: 'assignment_transfer', label: 'Assignment & Transfer', group: 'General' },
  { id: 'dispute_resolution', label: 'Dispute Resolution', group: 'General' },

  // Capacity & Availability
  { id: 'dependable_capacity', label: 'Dependable Capacity', group: 'Capacity & Availability' },
  { id: 'availability_guarantee', label: 'Availability Guarantee', group: 'Capacity & Availability' },
  { id: 'capacity_testing', label: 'Capacity Testing & Adjustments', group: 'Capacity & Availability' },
  { id: 'outages_maintenance', label: 'Outages & Scheduled Maintenance', group: 'Capacity & Availability' },

  // Fuel & Conversion
  { id: 'fuel_supply_delivery', label: 'Fuel Supply & Delivery', group: 'Fuel & Conversion' },
  { id: 'fuel_specifications', label: 'Fuel Specifications & Quality', group: 'Fuel & Conversion' },
  { id: 'heat_rate_guarantee', label: 'Heat Rate Guarantee', group: 'Fuel & Conversion' },
  { id: 'fuel_conversion_services', label: 'Fuel Conversion Services', group: 'Fuel & Conversion' },

  // Dispatch & Operations
  { id: 'dispatch_rights', label: 'Dispatch Rights & Exclusivity', group: 'Dispatch & Operations' },
  { id: 'dispatch_procedures', label: 'Dispatch Procedures & Notices', group: 'Dispatch & Operations' },
  { id: 'ancillary_services', label: 'Ancillary Services', group: 'Dispatch & Operations' },
  { id: 'metering_measurement', label: 'Metering & Measurement', group: 'Dispatch & Operations' },
  { id: 'facility_utilization', label: 'Facility Utilization Planning', group: 'Dispatch & Operations' },
  { id: 'environmental_compliance', label: 'Environmental Compliance', group: 'Dispatch & Operations' },

  // Pricing & Payment
  { id: 'fixed_capacity_payment', label: 'Fixed Capacity Payment', group: 'Pricing & Payment' },
  { id: 'variable_energy_payment', label: 'Variable Energy Payment', group: 'Pricing & Payment' },
  { id: 'start_up_charges', label: 'Start-Up Charges', group: 'Pricing & Payment' },
  { id: 'payment_billing', label: 'Payment & Billing Terms', group: 'Pricing & Payment' },
  { id: 'taxes_duties', label: 'Taxes & Duties', group: 'Pricing & Payment' },

  // Credit & Security
  { id: 'credit_support', label: 'Credit Support & Security', group: 'Credit & Security' },
  { id: 'lender_consent', label: 'Lender Consent & Financing', group: 'Credit & Security' },
  { id: 'insurance', label: 'Insurance Requirements', group: 'Credit & Security' },

  // Risk Allocation
  { id: 'force_majeure', label: 'Force Majeure', group: 'Risk Allocation' },
  { id: 'change_in_law', label: 'Change in Law', group: 'Risk Allocation' },
  { id: 'default_termination', label: 'Default & Termination', group: 'Risk Allocation' },
  { id: 'termination_payments', label: 'Termination Payments & LDs', group: 'Risk Allocation' },
  { id: 'indemnities', label: 'Indemnities', group: 'Risk Allocation' },
  { id: 'liability_caps', label: 'Liability Caps & Limitations', group: 'Risk Allocation' },
];

export function getTollingCategoryById(id: string): TollingCategory | undefined {
  return TOLLING_ALL_CATEGORIES.find(c => c.id === id);
}

export function getTollingCategoriesByGroup(group: TollingCategoryGroup): TollingCategory[] {
  return TOLLING_ALL_CATEGORIES.filter(c => c.group === group);
}
