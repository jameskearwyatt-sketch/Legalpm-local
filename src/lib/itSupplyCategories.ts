// IT Supply Contract analysis categories
// Covers chip, server, and hardware supply agreements

export interface ITSupplyCategory {
  id: string;
  label: string;
  group: ITSupplyCategoryGroup;
  supplyTypes: ITSupplyType[];
}

export const IT_SUPPLY_TYPES = [
  { id: 'semiconductor', label: 'Semiconductor / Chip Supply' },
  { id: 'server', label: 'Server & Rack Supply' },
  { id: 'networking', label: 'Networking Equipment' },
  { id: 'storage_hw', label: 'Storage Hardware' },
  { id: 'custom_asic', label: 'Custom ASIC / SoC' },
  { id: 'components', label: 'Components & Modules' },
  { id: 'other', label: 'Other' },
] as const;

export type ITSupplyType = typeof IT_SUPPLY_TYPES[number]['id'];

export const IT_SUPPLY_CONTRACT_STAGES = [
  { id: 'framework', label: 'Framework / Master Agreement', description: 'Long-term supply framework with call-off mechanisms' },
  { id: 'purchase_order', label: 'Purchase Order', description: 'Specific purchase order under a framework or standalone' },
  { id: 'development', label: 'Development & Custom Design', description: 'Custom chip/hardware development agreement' },
] as const;

export type ITSupplyContractStage = typeof IT_SUPPLY_CONTRACT_STAGES[number]['id'];

export const IT_SUPPLY_CATEGORY_GROUPS = [
  'General',
  'Product & Specifications',
  'Supply & Delivery',
  'Pricing & Payment',
  'Quality & Testing',
  'IP & Confidentiality',
  'Risk Allocation',
  'Sustainability & Compliance',
] as const;

export type ITSupplyCategoryGroup = typeof IT_SUPPLY_CATEGORY_GROUPS[number];

const CHIP: ITSupplyType[] = ['semiconductor', 'custom_asic'];
const HW: ITSupplyType[] = ['server', 'networking', 'storage_hw', 'components'];
const ALL: ITSupplyType[] = [];

export const IT_SUPPLY_ALL_CATEGORIES: ITSupplyCategory[] = [
  // General
  { id: 'contract_term', label: 'Contract Term & Effective Date', group: 'General', supplyTypes: ALL },
  { id: 'conditions_precedent', label: 'Conditions Precedent', group: 'General', supplyTypes: ALL },
  { id: 'representations_warranties', label: 'Representations & Warranties', group: 'General', supplyTypes: ALL },
  { id: 'assignment_transfer', label: 'Assignment & Transfer', group: 'General', supplyTypes: ALL },
  { id: 'dispute_resolution', label: 'Dispute Resolution & Governing Law', group: 'General', supplyTypes: ALL },

  // Product & Specifications
  { id: 'product_specifications', label: 'Product Specifications & SKUs', group: 'Product & Specifications', supplyTypes: ALL },
  { id: 'technology_roadmap', label: 'Technology Roadmap & Refresh', group: 'Product & Specifications', supplyTypes: ALL },
  { id: 'compatibility', label: 'Compatibility & Interoperability', group: 'Product & Specifications', supplyTypes: ALL },
  { id: 'custom_design', label: 'Custom Design & Engineering (NRE)', group: 'Product & Specifications', supplyTypes: CHIP },
  { id: 'end_of_life', label: 'End-of-Life & Last-Time-Buy', group: 'Product & Specifications', supplyTypes: ALL },

  // Supply & Delivery
  { id: 'supply_commitment', label: 'Supply Commitment & Volume', group: 'Supply & Delivery', supplyTypes: ALL },
  { id: 'delivery_schedule', label: 'Delivery Schedule & Lead Times', group: 'Supply & Delivery', supplyTypes: ALL },
  { id: 'allocation_priority', label: 'Allocation & Priority Rights', group: 'Supply & Delivery', supplyTypes: ALL },
  { id: 'inventory_management', label: 'Inventory & Safety Stock', group: 'Supply & Delivery', supplyTypes: ALL },
  { id: 'packaging_logistics', label: 'Packaging, Shipping & Logistics', group: 'Supply & Delivery', supplyTypes: ALL },
  { id: 'forecasting', label: 'Forecasting & Order Mechanisms', group: 'Supply & Delivery', supplyTypes: ALL },

  // Pricing & Payment
  { id: 'pricing_structure', label: 'Pricing Structure & Adjustments', group: 'Pricing & Payment', supplyTypes: ALL },
  { id: 'volume_discounts', label: 'Volume Discounts & Rebates', group: 'Pricing & Payment', supplyTypes: ALL },
  { id: 'payment_terms', label: 'Payment Terms & Invoicing', group: 'Pricing & Payment', supplyTypes: ALL },
  { id: 'taxes_duties', label: 'Taxes, Duties & Import/Export', group: 'Pricing & Payment', supplyTypes: ALL },
  { id: 'most_favored_customer', label: 'Most Favored Customer (MFC)', group: 'Pricing & Payment', supplyTypes: ALL },

  // Quality & Testing
  { id: 'quality_standards', label: 'Quality Standards & Acceptance', group: 'Quality & Testing', supplyTypes: ALL },
  { id: 'testing_inspection', label: 'Testing & Incoming Inspection', group: 'Quality & Testing', supplyTypes: ALL },
  { id: 'defect_rates', label: 'Defect & Failure Rate Limits', group: 'Quality & Testing', supplyTypes: ALL },
  { id: 'warranty', label: 'Warranty Terms & RMA Process', group: 'Quality & Testing', supplyTypes: ALL },
  { id: 'yield_guarantees', label: 'Yield Guarantees', group: 'Quality & Testing', supplyTypes: CHIP },

  // IP & Confidentiality
  { id: 'ip_rights', label: 'Intellectual Property Rights', group: 'IP & Confidentiality', supplyTypes: ALL },
  { id: 'confidentiality', label: 'Confidentiality & NDA', group: 'IP & Confidentiality', supplyTypes: ALL },
  { id: 'export_controls', label: 'Export Controls & Sanctions', group: 'IP & Confidentiality', supplyTypes: ALL },

  // Risk Allocation
  { id: 'force_majeure', label: 'Force Majeure', group: 'Risk Allocation', supplyTypes: ALL },
  { id: 'change_in_law', label: 'Change in Law / Regulatory', group: 'Risk Allocation', supplyTypes: ALL },
  { id: 'supply_chain_disruption', label: 'Supply Chain Disruption & Continuity', group: 'Risk Allocation', supplyTypes: ALL },
  { id: 'default_termination', label: 'Default & Termination', group: 'Risk Allocation', supplyTypes: ALL },
  { id: 'termination_payments', label: 'Termination Payments & Cancellation Fees', group: 'Risk Allocation', supplyTypes: ALL },
  { id: 'indemnities', label: 'Indemnities', group: 'Risk Allocation', supplyTypes: ALL },
  { id: 'liability_caps', label: 'Liability Caps & Limitations', group: 'Risk Allocation', supplyTypes: ALL },

  // Sustainability & Compliance
  { id: 'environmental', label: 'Environmental & Sustainability', group: 'Sustainability & Compliance', supplyTypes: ALL },
  { id: 'conflict_minerals', label: 'Conflict Minerals & Responsible Sourcing', group: 'Sustainability & Compliance', supplyTypes: ALL },
  { id: 'labor_ethics', label: 'Labor Standards & Ethics Compliance', group: 'Sustainability & Compliance', supplyTypes: ALL },
];

export function getITSupplyCategoriesForContext(
  supplyType?: ITSupplyType | null,
): ITSupplyCategory[] {
  return IT_SUPPLY_ALL_CATEGORIES.filter(c => {
    if (c.supplyTypes.length > 0 && supplyType) {
      if (!c.supplyTypes.includes(supplyType)) return false;
    }
    return true;
  });
}

export function getITSupplyCategoryById(id: string): ITSupplyCategory | undefined {
  return IT_SUPPLY_ALL_CATEGORIES.find(c => c.id === id);
}

export function getITSupplyCategoriesByGroup(group: ITSupplyCategoryGroup): ITSupplyCategory[] {
  return IT_SUPPLY_ALL_CATEGORIES.filter(c => c.group === group);
}
