// Cloud Compute Services analysis categories
// Covers compute capability offtake agreements (tenant ↔ provider)

export interface CloudComputeCategory {
  id: string;
  label: string;
  group: CloudComputeCategoryGroup;
  serviceTypes: CloudServiceType[];
}

export const CLOUD_SERVICE_TYPES = [
  { id: 'iaas', label: 'Infrastructure as a Service (IaaS)' },
  { id: 'paas', label: 'Platform as a Service (PaaS)' },
  { id: 'gpu_compute', label: 'GPU / AI Compute' },
  { id: 'colocation', label: 'Colocation & Bare Metal' },
  { id: 'hybrid', label: 'Hybrid Cloud' },
  { id: 'other', label: 'Other' },
] as const;

export type CloudServiceType = typeof CLOUD_SERVICE_TYPES[number]['id'];

export const CLOUD_DEPLOYMENT_MODELS = [
  { id: 'public_cloud', label: 'Public Cloud', description: 'Multi-tenant shared infrastructure' },
  { id: 'private_cloud', label: 'Private / Dedicated Cloud', description: 'Single-tenant dedicated infrastructure' },
  { id: 'hybrid', label: 'Hybrid Cloud', description: 'Mix of on-premises and cloud resources' },
  { id: 'sovereign', label: 'Sovereign Cloud', description: 'Jurisdiction-restricted cloud deployment' },
] as const;

export type CloudDeploymentModel = typeof CLOUD_DEPLOYMENT_MODELS[number]['id'];

export const CLOUD_COMPUTE_CATEGORY_GROUPS = [
  'General',
  'Capacity & Resources',
  'Service Levels',
  'Pricing & Payment',
  'Security & Compliance',
  'Operations',
  'Risk Allocation',
  'IP & Data',
] as const;

export type CloudComputeCategoryGroup = typeof CLOUD_COMPUTE_CATEGORY_GROUPS[number];

const GPU: CloudServiceType[] = ['gpu_compute'];
const COLO: CloudServiceType[] = ['colocation'];
const ALL: CloudServiceType[] = [];

export const CLOUD_COMPUTE_ALL_CATEGORIES: CloudComputeCategory[] = [
  // General
  { id: 'contract_term', label: 'Contract Term & Effective Date', group: 'General', serviceTypes: ALL },
  { id: 'conditions_precedent', label: 'Conditions Precedent', group: 'General', serviceTypes: ALL },
  { id: 'representations_warranties', label: 'Representations & Warranties', group: 'General', serviceTypes: ALL },
  { id: 'assignment_transfer', label: 'Assignment & Transfer', group: 'General', serviceTypes: ALL },
  { id: 'dispute_resolution', label: 'Dispute Resolution & Governing Law', group: 'General', serviceTypes: ALL },

  // Capacity & Resources
  { id: 'compute_capacity', label: 'Compute Capacity Commitment', group: 'Capacity & Resources', serviceTypes: ALL },
  { id: 'storage_allocation', label: 'Storage Allocation & Tiers', group: 'Capacity & Resources', serviceTypes: ALL },
  { id: 'network_bandwidth', label: 'Network & Bandwidth', group: 'Capacity & Resources', serviceTypes: ALL },
  { id: 'scalability_burst', label: 'Scalability & Burst Rights', group: 'Capacity & Resources', serviceTypes: ALL },
  { id: 'gpu_allocation', label: 'GPU / Accelerator Allocation', group: 'Capacity & Resources', serviceTypes: GPU },
  { id: 'rack_power', label: 'Rack Space & Power (kW)', group: 'Capacity & Resources', serviceTypes: COLO },
  { id: 'resource_reservations', label: 'Resource Reservations & Guarantees', group: 'Capacity & Resources', serviceTypes: ALL },

  // Service Levels
  { id: 'availability_sla', label: 'Availability SLA & Uptime', group: 'Service Levels', serviceTypes: ALL },
  { id: 'performance_guarantees', label: 'Performance Guarantees', group: 'Service Levels', serviceTypes: ALL },
  { id: 'latency_response', label: 'Latency & Response Time', group: 'Service Levels', serviceTypes: ALL },
  { id: 'maintenance_windows', label: 'Maintenance Windows & Scheduling', group: 'Service Levels', serviceTypes: ALL },
  { id: 'sla_credits', label: 'SLA Credits & Remedies', group: 'Service Levels', serviceTypes: ALL },

  // Pricing & Payment
  { id: 'pricing_model', label: 'Pricing Model & Rate Card', group: 'Pricing & Payment', serviceTypes: ALL },
  { id: 'reserved_vs_ondemand', label: 'Reserved vs On-Demand', group: 'Pricing & Payment', serviceTypes: ALL },
  { id: 'egress_costs', label: 'Egress & Data Transfer Costs', group: 'Pricing & Payment', serviceTypes: ALL },
  { id: 'payment_terms', label: 'Payment Terms & Invoicing', group: 'Pricing & Payment', serviceTypes: ALL },
  { id: 'true_up', label: 'True-Up & Reconciliation', group: 'Pricing & Payment', serviceTypes: ALL },
  { id: 'most_favored_customer', label: 'Most Favored Customer (MFC)', group: 'Pricing & Payment', serviceTypes: ALL },
  { id: 'taxes_duties', label: 'Taxes & Duties', group: 'Pricing & Payment', serviceTypes: ALL },

  // Security & Compliance
  { id: 'data_security', label: 'Data Security & Encryption', group: 'Security & Compliance', serviceTypes: ALL },
  { id: 'data_residency', label: 'Data Residency & Sovereignty', group: 'Security & Compliance', serviceTypes: ALL },
  { id: 'regulatory_compliance', label: 'Regulatory Compliance', group: 'Security & Compliance', serviceTypes: ALL },
  { id: 'audit_rights', label: 'Audit Rights & Transparency', group: 'Security & Compliance', serviceTypes: ALL },
  { id: 'certifications', label: 'Certifications (SOC 2 / ISO / FedRAMP)', group: 'Security & Compliance', serviceTypes: ALL },

  // Operations
  { id: 'monitoring_reporting', label: 'Monitoring & Reporting', group: 'Operations', serviceTypes: ALL },
  { id: 'incident_management', label: 'Incident Management & Escalation', group: 'Operations', serviceTypes: ALL },
  { id: 'change_management', label: 'Change Management', group: 'Operations', serviceTypes: ALL },
  { id: 'disaster_recovery', label: 'Disaster Recovery & BCP', group: 'Operations', serviceTypes: ALL },
  { id: 'support_tiers', label: 'Support Tiers & Response Times', group: 'Operations', serviceTypes: ALL },

  // Risk Allocation
  { id: 'force_majeure', label: 'Force Majeure', group: 'Risk Allocation', serviceTypes: ALL },
  { id: 'change_in_law', label: 'Change in Law / Regulatory', group: 'Risk Allocation', serviceTypes: ALL },
  { id: 'default_termination', label: 'Default & Termination', group: 'Risk Allocation', serviceTypes: ALL },
  { id: 'termination_data_return', label: 'Termination Payments & Data Return', group: 'Risk Allocation', serviceTypes: ALL },
  { id: 'indemnities', label: 'Indemnities', group: 'Risk Allocation', serviceTypes: ALL },
  { id: 'liability_caps', label: 'Liability Caps & Limitations', group: 'Risk Allocation', serviceTypes: ALL },
  { id: 'data_breach_liability', label: 'Data Breach Liability', group: 'Risk Allocation', serviceTypes: ALL },

  // IP & Data
  { id: 'data_ownership', label: 'Data Ownership & Portability', group: 'IP & Data', serviceTypes: ALL },
  { id: 'ip_rights', label: 'Intellectual Property Rights', group: 'IP & Data', serviceTypes: ALL },
  { id: 'confidentiality', label: 'Confidentiality & NDA', group: 'IP & Data', serviceTypes: ALL },
  { id: 'lock_in_migration', label: 'Lock-In Prevention & Migration Assistance', group: 'IP & Data', serviceTypes: ALL },
];

export function getCloudComputeCategoriesForContext(
  serviceType?: CloudServiceType | null,
): CloudComputeCategory[] {
  return CLOUD_COMPUTE_ALL_CATEGORIES.filter(c => {
    if (c.serviceTypes.length > 0 && serviceType) {
      if (!c.serviceTypes.includes(serviceType)) return false;
    }
    return true;
  });
}

export function getCloudComputeCategoryById(id: string): CloudComputeCategory | undefined {
  return CLOUD_COMPUTE_ALL_CATEGORIES.find(c => c.id === id);
}

export function getCloudComputeCategoriesByGroup(group: CloudComputeCategoryGroup): CloudComputeCategory[] {
  return CLOUD_COMPUTE_ALL_CATEGORIES.filter(c => c.group === group);
}
