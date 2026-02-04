// PPA Analysis Categories based on the VPPA How-To Bible

export interface PPACategory {
  id: string;
  label: string;
  description: string;
  bibleReference: string;
  group: string;
}

export const PPA_CATEGORY_GROUPS = [
  'Pre-COD & Development',
  'Operations',
  'Pricing & Settlement',
  'Environmental Attributes',
  'Credit & Payment',
  'Risk Allocation',
  'General',
] as const;

export type PPACategoryGroup = typeof PPA_CATEGORY_GROUPS[number];

// Initial 7 pilot categories
export const PPA_PILOT_CATEGORIES: PPACategory[] = [
  {
    id: 'pricing_structure',
    label: 'Pricing Structure',
    description: 'Fixed price, floating with floor/cap, indexation mechanisms',
    bibleReference: 'Section 2.1 - Pricing Mechanisms',
    group: 'Pricing & Settlement',
  },
  {
    id: 'seller_credit_support',
    label: 'Credit Support (Seller)',
    description: 'Parent company guarantees, letters of credit, performance bonds',
    bibleReference: 'Section 5.2 - Seller Credit Support',
    group: 'Credit & Payment',
  },
  {
    id: 'buyer_credit_support',
    label: 'Credit Support (Buyer)',
    description: 'Payment security, credit rating requirements, collateral',
    bibleReference: 'Section 5.3 - Buyer Credit Support',
    group: 'Credit & Payment',
  },
  {
    id: 'delay_liquidated_damages',
    label: 'Delay Liquidated Damages',
    description: 'Pre-COD delay compensation, daily rates, caps',
    bibleReference: 'Section 3.1 - Delay LDs',
    group: 'Pre-COD & Development',
  },
  {
    id: 'availability_guarantee',
    label: 'Availability Guarantee',
    description: 'Minimum availability commitments, calculation methodology, remedies',
    bibleReference: 'Section 4.1 - Availability',
    group: 'Operations',
  },
  {
    id: 'contract_term',
    label: 'Contract Term',
    description: 'Duration, start date triggers, extension options',
    bibleReference: 'Section 1.1 - Term',
    group: 'General',
  },
  {
    id: 'payment_terms',
    label: 'Payment Terms',
    description: 'Invoice frequency, payment deadlines, dispute mechanisms',
    bibleReference: 'Section 5.1 - Payment',
    group: 'Credit & Payment',
  },
];

// Full category set (for future expansion)
export const PPA_ALL_CATEGORIES: PPACategory[] = [
  ...PPA_PILOT_CATEGORIES,
  {
    id: 'targeted_cod',
    label: 'Targeted COD',
    description: 'Commercial operation date, conditions precedent, certification',
    bibleReference: 'Section 1.2 - COD',
    group: 'Pre-COD & Development',
  },
  {
    id: 'longstop_date',
    label: 'Longstop Date',
    description: 'Sunrise/sunset provisions, termination triggers',
    bibleReference: 'Section 1.3 - Longstop',
    group: 'Pre-COD & Development',
  },
  {
    id: 'force_majeure',
    label: 'Force Majeure',
    description: 'Definition, notification, relief period, termination rights',
    bibleReference: 'Section 6.1 - Force Majeure',
    group: 'Risk Allocation',
  },
  {
    id: 'change_in_law',
    label: 'Change in Law',
    description: 'Qualifying changes, allocation of costs, reopener provisions',
    bibleReference: 'Section 6.2 - Change in Law',
    group: 'Risk Allocation',
  },
  {
    id: 'curtailment',
    label: 'Curtailment',
    description: 'Grid curtailment allocation, compensation mechanisms',
    bibleReference: 'Section 4.2 - Curtailment',
    group: 'Operations',
  },
  {
    id: 'negative_pricing',
    label: 'Negative Pricing',
    description: 'Floor prices, curtailment rights during negative periods',
    bibleReference: 'Section 2.2 - Negative Pricing',
    group: 'Pricing & Settlement',
  },
  {
    id: 'green_certificates',
    label: 'Green Certificates / REGOs',
    description: 'Ownership, transfer mechanisms, pricing',
    bibleReference: 'Section 7.1 - Environmental Attributes',
    group: 'Environmental Attributes',
  },
  {
    id: 'additionality',
    label: 'Additionality',
    description: 'New build requirements, timing, certification',
    bibleReference: 'Section 7.2 - Additionality',
    group: 'Environmental Attributes',
  },
  {
    id: 'metering',
    label: 'Metering',
    description: 'Meter specifications, data access, dispute resolution',
    bibleReference: 'Section 4.3 - Metering',
    group: 'Operations',
  },
  {
    id: 'balancing',
    label: 'Balancing Responsibility',
    description: 'Imbalance costs allocation, scheduling requirements',
    bibleReference: 'Section 2.3 - Balancing',
    group: 'Pricing & Settlement',
  },
  {
    id: 'termination_rights',
    label: 'Termination Rights',
    description: 'Events of default, cure periods, termination payments',
    bibleReference: 'Section 8.1 - Termination',
    group: 'General',
  },
  {
    id: 'assignment',
    label: 'Assignment & Transfer',
    description: 'Consent requirements, change of control, permitted transfers',
    bibleReference: 'Section 8.2 - Assignment',
    group: 'General',
  },
  {
    id: 'insurance',
    label: 'Insurance',
    description: 'Required coverages, limits, named insured',
    bibleReference: 'Section 6.3 - Insurance',
    group: 'Risk Allocation',
  },
  {
    id: 'dispute_resolution',
    label: 'Dispute Resolution',
    description: 'Escalation, arbitration, governing law',
    bibleReference: 'Section 8.3 - Disputes',
    group: 'General',
  },
  {
    id: 'interconnection',
    label: 'Interconnection',
    description: 'Grid connection responsibility, costs, timelines',
    bibleReference: 'Section 3.2 - Interconnection',
    group: 'Pre-COD & Development',
  },
  {
    id: 'capacity',
    label: 'Contracted Capacity',
    description: 'Nameplate capacity, adjustments, overbuild rights',
    bibleReference: 'Section 1.4 - Capacity',
    group: 'General',
  },
  {
    id: 'shape_risk',
    label: 'Shape / Profile Risk',
    description: 'Volume shape allocation, baseload vs as-produced',
    bibleReference: 'Section 2.4 - Shape Risk',
    group: 'Pricing & Settlement',
  },
  {
    id: 'degradation',
    label: 'Degradation',
    description: 'Performance degradation assumptions, adjustments',
    bibleReference: 'Section 4.4 - Degradation',
    group: 'Operations',
  },
  {
    id: 'site_access',
    label: 'Site Access',
    description: 'Buyer site access rights, audit rights',
    bibleReference: 'Section 4.5 - Site Access',
    group: 'Operations',
  },
  {
    id: 'confidentiality',
    label: 'Confidentiality',
    description: 'Information protection, permitted disclosures',
    bibleReference: 'Section 8.4 - Confidentiality',
    group: 'General',
  },
];

export function getCategoryById(id: string): PPACategory | undefined {
  return PPA_ALL_CATEGORIES.find(c => c.id === id);
}

export function getCategoriesByGroup(group: PPACategoryGroup): PPACategory[] {
  return PPA_ALL_CATEGORIES.filter(c => c.group === group);
}

export function getPilotCategoryIds(): string[] {
  return PPA_PILOT_CATEGORIES.map(c => c.id);
}
