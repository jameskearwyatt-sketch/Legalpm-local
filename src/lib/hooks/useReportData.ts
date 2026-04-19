import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useExchangeRates } from './useExchangeRates';
import { convertToUsd } from '@/lib/currencyUtils';
import { format, startOfMonth, startOfQuarter, parseISO, isAfter, isBefore, endOfMonth, endOfQuarter } from 'date-fns';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface RealizationDataPoint {
  period: string;
  paid: number;
  billed: number;
  writeOffs: number;
  realizationRate: number;
}

export interface BudgetBurnItem {
  group: string;
  budget: number;
  actualSpend: number;
  burnPercent: number;
  matterCount: number;
}

export interface WipMovementDataPoint {
  period: string;
  openingWip: number;
  closingWip: number;
  delta: number;
}

export interface CollectionDataPoint {
  group: string;
  billed: number;
  paid: number;
  collectionRate: number;
}

function getPeriodKey(date: Date, groupBy: 'month' | 'quarter'): string {
  if (groupBy === 'quarter') {
    const q = Math.ceil((date.getMonth() + 1) / 3);
    return `Q${q} ${date.getFullYear()}`;
  }
  return format(date, 'MMM yyyy');
}

function getPeriodStart(date: Date, groupBy: 'month' | 'quarter'): Date {
  return groupBy === 'quarter' ? startOfQuarter(date) : startOfMonth(date);
}

function getPeriodEnd(date: Date, groupBy: 'month' | 'quarter'): Date {
  return groupBy === 'quarter' ? endOfQuarter(date) : endOfMonth(date);
}

export function useRealizationReport(dateRange: DateRange, groupBy: 'month' | 'quarter' = 'month') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['report-realization', dateRange.start.toISOString(), dateRange.end.toISOString(), groupBy],
    queryFn: async () => {
      const { data: snapshots } = await supabase
        .from('financial_snapshots')
        .select('as_of_date, billed_amount, paid_amount, wip_write_off_amount')
        .gte('as_of_date', dateRange.start.toISOString().split('T')[0])
        .lte('as_of_date', dateRange.end.toISOString().split('T')[0])
        .order('as_of_date', { ascending: true });

      if (!snapshots || snapshots.length === 0) return [];

      const periodMap = new Map<string, { paid: number; billed: number; writeOffs: number }>();

      for (const s of snapshots) {
        const key = getPeriodKey(parseISO(s.as_of_date), groupBy);
        const existing = periodMap.get(key) || { paid: 0, billed: 0, writeOffs: 0 };
        existing.paid += s.paid_amount || 0;
        existing.billed += s.billed_amount || 0;
        existing.writeOffs += s.wip_write_off_amount || 0;
        periodMap.set(key, existing);
      }

      const results: RealizationDataPoint[] = [];
      for (const [period, data] of periodMap) {
        const denominator = data.billed + data.writeOffs;
        results.push({
          period,
          ...data,
          realizationRate: denominator > 0 ? (data.paid / denominator) * 100 : 0,
        });
      }

      return results;
    },
    enabled: !!user,
  });
}

export function useBudgetBurnReport(dateRange: DateRange, groupBy: 'practice_area' | 'client' = 'practice_area') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['report-budget-burn', dateRange.start.toISOString(), dateRange.end.toISOString(), groupBy],
    queryFn: async () => {
      const { data: matters } = await supabase
        .from('matters')
        .select('id, matter_name, practice_area, total_budget, fee_currency, exchange_rate, category, matter_clients(client:clients(company_name))')
        .eq('category', 'Live')
        .gt('total_budget', 0);

      if (!matters || matters.length === 0) return [];

      const matterIds = matters.map(m => m.id);
      const { data: snapshots } = await supabase
        .from('financial_snapshots')
        .select('matter_id, wip_amount, billed_amount, paid_amount')
        .in('matter_id', matterIds)
        .gte('as_of_date', dateRange.start.toISOString().split('T')[0])
        .lte('as_of_date', dateRange.end.toISOString().split('T')[0])
        .order('as_of_date', { ascending: false });

      const latestByMatter = new Map<string, { wip: number; billed: number; paid: number }>();
      for (const s of snapshots || []) {
        if (!latestByMatter.has(s.matter_id)) {
          latestByMatter.set(s.matter_id, {
            wip: s.wip_amount || 0,
            billed: s.billed_amount || 0,
            paid: s.paid_amount || 0,
          });
        }
      }

      const groupMap = new Map<string, { budget: number; spend: number; count: number }>();

      for (const m of matters) {
        const key = groupBy === 'practice_area'
          ? (m.practice_area || 'Unspecified')
          : ((m.matter_clients as any)?.[0]?.client?.company_name || 'Unknown Client');

        const snapshot = latestByMatter.get(m.id);
        const budget = Number(m.total_budget) || 0;
        const spend = snapshot ? (snapshot.wip + snapshot.billed + snapshot.paid) : 0;

        const existing = groupMap.get(key) || { budget: 0, spend: 0, count: 0 };
        existing.budget += budget;
        existing.spend += spend;
        existing.count += 1;
        groupMap.set(key, existing);
      }

      const results: BudgetBurnItem[] = [];
      for (const [group, data] of groupMap) {
        results.push({
          group,
          budget: data.budget,
          actualSpend: data.spend,
          burnPercent: data.budget > 0 ? (data.spend / data.budget) * 100 : 0,
          matterCount: data.count,
        });
      }

      return results.sort((a, b) => b.burnPercent - a.burnPercent);
    },
    enabled: !!user,
  });
}

export function useWipMovementReport(dateRange: DateRange, groupBy: 'month' | 'quarter' = 'month') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['report-wip-movement', dateRange.start.toISOString(), dateRange.end.toISOString(), groupBy],
    queryFn: async () => {
      const { data: snapshots } = await supabase
        .from('financial_snapshots')
        .select('as_of_date, wip_amount')
        .gte('as_of_date', dateRange.start.toISOString().split('T')[0])
        .lte('as_of_date', dateRange.end.toISOString().split('T')[0])
        .order('as_of_date', { ascending: true });

      if (!snapshots || snapshots.length === 0) return [];

      const periodTotals = new Map<string, { first: number | null; last: number }>();

      for (const s of snapshots) {
        const key = getPeriodKey(parseISO(s.as_of_date), groupBy);
        const existing = periodTotals.get(key);
        if (!existing) {
          periodTotals.set(key, { first: s.wip_amount || 0, last: s.wip_amount || 0 });
        } else {
          existing.last = s.wip_amount || 0;
        }
      }

      const results: WipMovementDataPoint[] = [];
      for (const [period, data] of periodTotals) {
        const opening = data.first ?? 0;
        const closing = data.last;
        results.push({
          period,
          openingWip: opening,
          closingWip: closing,
          delta: closing - opening,
        });
      }

      return results;
    },
    enabled: !!user,
  });
}

export function useCollectionReport(dateRange: DateRange, groupBy: 'practice_area' | 'matter' = 'practice_area') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['report-collection', dateRange.start.toISOString(), dateRange.end.toISOString(), groupBy],
    queryFn: async () => {
      const { data: matters } = await supabase
        .from('matters')
        .select('id, matter_name, practice_area, category')
        .eq('category', 'Live');

      if (!matters || matters.length === 0) return [];

      const matterIds = matters.map(m => m.id);
      const { data: snapshots } = await supabase
        .from('financial_snapshots')
        .select('matter_id, billed_amount, paid_amount')
        .in('matter_id', matterIds)
        .gte('as_of_date', dateRange.start.toISOString().split('T')[0])
        .lte('as_of_date', dateRange.end.toISOString().split('T')[0])
        .order('as_of_date', { ascending: false });

      const latestByMatter = new Map<string, { billed: number; paid: number }>();
      for (const s of snapshots || []) {
        if (!latestByMatter.has(s.matter_id)) {
          latestByMatter.set(s.matter_id, { billed: s.billed_amount || 0, paid: s.paid_amount || 0 });
        }
      }

      const groupMap = new Map<string, { billed: number; paid: number }>();

      for (const m of matters) {
        const key = groupBy === 'matter' ? m.matter_name : (m.practice_area || 'Unspecified');
        const snapshot = latestByMatter.get(m.id);
        if (!snapshot) continue;

        const existing = groupMap.get(key) || { billed: 0, paid: 0 };
        existing.billed += snapshot.billed;
        existing.paid += snapshot.paid;
        groupMap.set(key, existing);
      }

      const results: CollectionDataPoint[] = [];
      for (const [group, data] of groupMap) {
        if (data.billed === 0) continue;
        results.push({
          group,
          ...data,
          collectionRate: data.billed > 0 ? (data.paid / data.billed) * 100 : 0,
        });
      }

      return results.sort((a, b) => a.collectionRate - b.collectionRate);
    },
    enabled: !!user,
  });
}
