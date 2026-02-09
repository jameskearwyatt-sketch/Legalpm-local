// Full PPA categories based on the Bible framework

export interface PPACategory {
  id: string;
  label: string;
  group: PPACategoryGroup;
}

export const PPA_CATEGORY_GROUPS = [
  'General',
  'Pre-COD / Development',
  'Pricing & Settlement',
  'Operations',
  'Environmental Attributes',
  'Credit & Payment',
  'Risk Allocation',
] as const;

export type PPACategoryGroup = typeof PPA_CATEGORY_GROUPS[number];

export const PPA_ALL_CATEGORIES: PPACategory[] = [
  // General (typically front-of-contract: definitions, term, reps)
  { id: 'contract_term', label: 'Contract Term', group: 'General' },
  { id: 'representations_warranties', label: 'Representations & Warranties', group: 'General' },
  { id: 'conditions_precedent', label: 'Conditions Precedent', group: 'Pre-COD / Development' },

  // Pre-COD / Development
  { id: 'target_cod', label: 'Target COD & Milestones', group: 'Pre-COD / Development' },
  { id: 'construction_obligations', label: 'Construction & Development', group: 'Pre-COD / Development' },
  { id: 'delay_liquidated_damages', label: 'Delay Liquidated Damages', group: 'Pre-COD / Development' },

  // Pricing & Settlement
  { id: 'pricing_structure', label: 'Pricing Structure', group: 'Pricing & Settlement' },
  { id: 'volume_structure', label: 'Volume & Shape', group: 'Pricing & Settlement' },
  { id: 'settlement_metering', label: 'Settlement & Metering', group: 'Pricing & Settlement' },
  { id: 'balancing_costs', label: 'Balancing & Imbalance Costs', group: 'Pricing & Settlement' },

  // Operations
  { id: 'availability_guarantee', label: 'Availability Guarantee', group: 'Operations' },
  { id: 'curtailment', label: 'Curtailment', group: 'Operations' },
  { id: 'outages_maintenance', label: 'Outages & Maintenance', group: 'Operations' },
  { id: 'operations_reporting', label: 'Operations & Reporting', group: 'Operations' },

  // Environmental Attributes
  { id: 'green_certificates', label: 'REGOs & Green Certificates', group: 'Environmental Attributes' },
  { id: 'additionality', label: 'Additionality & Claims', group: 'Environmental Attributes' },

  // Credit & Payment
  { id: 'seller_credit_support', label: 'Credit Support (Seller)', group: 'Credit & Payment' },
  { id: 'buyer_credit_support', label: 'Credit Support (Buyer)', group: 'Credit & Payment' },
  { id: 'payment_terms', label: 'Payment Terms', group: 'Credit & Payment' },
  { id: 'credit_events', label: 'Credit Events & Downgrades', group: 'Credit & Payment' },

  // Risk Allocation (typically later in PPA)
  { id: 'change_in_law', label: 'Change in Law', group: 'Risk Allocation' },
  { id: 'force_majeure', label: 'Force Majeure', group: 'Risk Allocation' },
  { id: 'market_disruption', label: 'Market Disruption', group: 'Risk Allocation' },
  { id: 'insurance', label: 'Insurance Requirements', group: 'Risk Allocation' },

  // General (back-of-contract provisions)
  { id: 'termination_rights', label: 'Termination Rights', group: 'General' },
  { id: 'termination_payments', label: 'Termination Payments', group: 'General' },
  { id: 'assignment_transfer', label: 'Assignment & Transfer', group: 'General' },
  { id: 'liability_caps', label: 'Liability & Limitations', group: 'General' },
  { id: 'dispute_resolution', label: 'Dispute Resolution', group: 'General' },
];

export function getCategoryById(id: string): PPACategory | undefined {
  return PPA_ALL_CATEGORIES.find(c => c.id === id);
}

export function getCategoriesByGroup(group: PPACategoryGroup): PPACategory[] {
  return PPA_ALL_CATEGORIES.filter(c => c.group === group);
}

// Change type badges for comparison view
export const CHANGE_TYPE_CONFIG = {
  modified: { 
    label: 'Modified', 
    color: 'text-amber-700', 
    bg: 'bg-amber-100',
    icon: '✏️'
  },
  unchanged: { 
    label: 'Unchanged', 
    color: 'text-slate-600', 
    bg: 'bg-slate-100',
    icon: '—'
  },
  added: { 
    label: 'New', 
    color: 'text-green-700', 
    bg: 'bg-green-100',
    icon: '+'
  },
  removed: { 
    label: 'Removed', 
    color: 'text-red-700', 
    bg: 'bg-red-100',
    icon: '−'
  },
} as const;

export type ChangeType = keyof typeof CHANGE_TYPE_CONFIG;
