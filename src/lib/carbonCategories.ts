// Carbon Credit Offtake Agreement analysis categories

export interface CarbonCategory {
  id: string;
  label: string;
  group: CarbonCategoryGroup;
}

export const CARBON_PROJECT_TYPES = [
  { id: 'dac', label: 'Direct Air Capture (DAC)' },
  { id: 'beccs', label: 'BECCS' },
  { id: 'biochar', label: 'Biochar' },
  { id: 'enhanced_weathering', label: 'Enhanced Weathering' },
  { id: 'ocean_based', label: 'Ocean-Based Removal' },
  { id: 'afforestation', label: 'Afforestation / Reforestation' },
  { id: 'soil_carbon', label: 'Soil Carbon Sequestration' },
  { id: 'avoidance', label: 'Avoidance / Reduction Credits' },
  { id: 'other', label: 'Other' },
] as const;

export type CarbonProjectType = typeof CARBON_PROJECT_TYPES[number]['id'];

export const CARBON_PROJECT_STAGES = [
  { id: 'pre_development', label: 'Pre-Development', description: 'Early stage project, credits may be forward-sold' },
  { id: 'development', label: 'In Development', description: 'Project under development, forward purchase agreement' },
  { id: 'operational', label: 'Operational', description: 'Project operational and generating credits' },
] as const;

export type CarbonProjectStage = typeof CARBON_PROJECT_STAGES[number]['id'];

export const CARBON_CATEGORY_GROUPS = [
  'General',
  'Credit Specifications',
  'Volume & Delivery',
  'Pricing & Payment',
  'Verification & Registry',
  'Credit Quality & Standards',
  'Risk Allocation',
  'Termination & Remedies',
] as const;

export type CarbonCategoryGroup = typeof CARBON_CATEGORY_GROUPS[number];

export const CARBON_ALL_CATEGORIES: CarbonCategory[] = [
  // General
  { id: 'contract_term', label: 'Contract Term & Effective Date', group: 'General' },
  { id: 'conditions_precedent', label: 'Conditions Precedent', group: 'General' },
  { id: 'representations_warranties', label: 'Representations & Warranties', group: 'General' },
  { id: 'assignment_transfer', label: 'Assignment & Transfer', group: 'General' },
  { id: 'dispute_resolution', label: 'Dispute Resolution & Governing Law', group: 'General' },
  { id: 'confidentiality', label: 'Confidentiality & Public Announcements', group: 'General' },

  // Credit Specifications
  { id: 'credit_type', label: 'Credit Type & Methodology', group: 'Credit Specifications' },
  { id: 'project_description', label: 'Project Description & Location', group: 'Credit Specifications' },
  { id: 'vintage_requirements', label: 'Vintage Requirements', group: 'Credit Specifications' },
  { id: 'additionality', label: 'Additionality Requirements', group: 'Credit Specifications' },
  { id: 'permanence', label: 'Permanence & Durability', group: 'Credit Specifications' },
  { id: 'co_benefits', label: 'Co-Benefits & SDG Alignment', group: 'Credit Specifications' },

  // Volume & Delivery
  { id: 'annual_volume', label: 'Annual Volume Commitment', group: 'Volume & Delivery' },
  { id: 'delivery_schedule', label: 'Delivery Schedule & Milestones', group: 'Volume & Delivery' },
  { id: 'shortfall_remedies', label: 'Volume Shortfall & Make-Up Rights', group: 'Volume & Delivery' },
  { id: 'excess_volume', label: 'Excess Volume & Right of First Refusal', group: 'Volume & Delivery' },
  { id: 'transfer_mechanics', label: 'Credit Transfer Mechanics', group: 'Volume & Delivery' },

  // Pricing & Payment
  { id: 'pricing_structure', label: 'Pricing Structure & Escalation', group: 'Pricing & Payment' },
  { id: 'payment_terms', label: 'Payment Terms & Invoicing', group: 'Pricing & Payment' },
  { id: 'price_adjustment', label: 'Price Adjustment Mechanisms', group: 'Pricing & Payment' },
  { id: 'taxes_duties', label: 'Taxes & Duties', group: 'Pricing & Payment' },

  // Verification & Registry
  { id: 'verification_standard', label: 'Verification Standard & Body', group: 'Verification & Registry' },
  { id: 'registry_requirements', label: 'Registry & Retirement Requirements', group: 'Verification & Registry' },
  { id: 'monitoring_reporting', label: 'Monitoring, Reporting & Verification (MRV)', group: 'Verification & Registry' },
  { id: 'audit_rights', label: 'Audit & Inspection Rights', group: 'Verification & Registry' },

  // Credit Quality & Standards
  { id: 'compliance_eligibility', label: 'Compliance Market Eligibility', group: 'Credit Quality & Standards' },
  { id: 'corresponding_adjustments', label: 'Corresponding Adjustments (Article 6)', group: 'Credit Quality & Standards' },
  { id: 'double_counting', label: 'Double Counting Prevention', group: 'Credit Quality & Standards' },
  { id: 'replacement_credits', label: 'Replacement & Substitution Rights', group: 'Credit Quality & Standards' },

  // Risk Allocation
  { id: 'force_majeure', label: 'Force Majeure', group: 'Risk Allocation' },
  { id: 'change_in_law', label: 'Change in Law & Regulatory Risk', group: 'Risk Allocation' },
  { id: 'invalidation_risk', label: 'Invalidation & Reversal Risk', group: 'Risk Allocation' },
  { id: 'buffer_pool', label: 'Buffer Pool & Insurance', group: 'Risk Allocation' },
  { id: 'indemnities', label: 'Indemnities', group: 'Risk Allocation' },
  { id: 'liability_caps', label: 'Liability Caps & Limitations', group: 'Risk Allocation' },

  // Termination & Remedies
  { id: 'events_of_default', label: 'Events of Default', group: 'Termination & Remedies' },
  { id: 'termination_rights', label: 'Termination Rights & Consequences', group: 'Termination & Remedies' },
  { id: 'termination_payments', label: 'Termination Payments & LDs', group: 'Termination & Remedies' },
  { id: 'credit_support', label: 'Credit Support & Security', group: 'Termination & Remedies' },
];

export function getCarbonCategoryById(id: string): CarbonCategory | undefined {
  return CARBON_ALL_CATEGORIES.find(c => c.id === id);
}

export function getCarbonCategoriesByGroup(group: CarbonCategoryGroup): CarbonCategory[] {
  return CARBON_ALL_CATEGORIES.filter(c => c.group === group);
}
