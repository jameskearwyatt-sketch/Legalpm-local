export const NON_CHARGEABLE_CODES = [
  { code: '98444444-3', name: 'Business Development' },
  { code: '', name: 'New Matter Onboarding' },
  { code: '', name: 'Travel for Clients' },
  { code: '98444444-8', name: 'Firm Meetings' },
  { code: '', name: 'Pro Bono' },
  { code: '98444444-1', name: 'Admin' },
  { code: '98444444-13', name: 'Annual Leave' },
  { code: '98444444-5', name: 'L&D / Training' },
  { code: 'OTHER', name: 'Other' },
];

export interface BudgetLineItem {
  id: string;
  work_item: string;
  fee_amount: number;
  category: string | null;
  provider: string;
  sort_order: number;
}

export interface WorkItemAllocation {
  id: string;
  name: string;
  hours: number;
}

export interface GridRowEntry {
  id: string;
  type: 'matter' | 'non-chargeable' | 'ad-hoc';
  matterId?: string;
  matterNumber?: string;
  matterName?: string;
  clientName?: string;
  cmNumber?: string;
  nonChargeableCode?: string;
  nonChargeableName?: string;
  adHocMatterName?: string;
  adHocMatterNumber?: string;
  hours: number;
  narrative: string;
  selectedDays: Date[];
  dayNarratives: { [dateKey: string]: string };
  otherDescription?: string;
  workItemAllocations: WorkItemAllocation[];
  dayWorkItemAllocations: { [dateKey: string]: WorkItemAllocation[] };
}

export interface DayOutputEntry {
  id: string;
  type: 'matter' | 'non-chargeable' | 'ad-hoc';
  matterId?: string;
  matterNumber?: string;
  matterName?: string;
  clientName?: string;
  cmNumber?: string;
  nonChargeableCode?: string;
  nonChargeableName?: string;
  otherDescription?: string;
  adHocMatterName?: string;
  adHocMatterNumber?: string;
  hours: number;
  narrative: string;
  polishedNarrative: string;
  workItemName?: string;
}

export interface DayOutput {
  date: Date;
  entries: DayOutputEntry[];
}

export type Step = 'mode-select' | 'grid-input' | 'output';
