import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface TimelineEvent {
  id: string;
  type: 'snapshot' | 'budget_amendment' | 'write_off' | 'wip_update';
  date: string;
  userId: string | null;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatDelta(prev: number, next: number): string {
  const delta = next - prev;
  const sign = delta >= 0 ? '+' : '';
  return `${formatCurrency(prev)} \u2192 ${formatCurrency(next)} (${sign}${formatCurrency(delta)})`;
}

async function fetchSnapshotEvents(matterId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from('financial_snapshots')
    .select('id, as_of_date, created_by, wip_amount, billed_amount, accounts_receivable, paid_amount, wip_write_off_amount, created_at, update_source')
    .eq('matter_id', matterId)
    .order('as_of_date', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((s: Record<string, unknown>) => ({
    id: `snapshot-${s.id}`,
    type: 'snapshot' as const,
    date: (s.created_at as string) || (s.as_of_date as string),
    userId: (s.created_by as string) || null,
    title: `Financial snapshot ${s.update_source === 'bulk' ? '(bulk import)' : 'updated'}`,
    description: `WIP: ${formatCurrency(s.wip_amount as number)}, Billed: ${formatCurrency(s.billed_amount as number)}, AR: ${formatCurrency(s.accounts_receivable as number)}, Paid: ${formatCurrency(s.paid_amount as number)}`,
    metadata: {
      snapshotId: s.id,
      asOfDate: s.as_of_date,
      wipAmount: s.wip_amount,
      billedAmount: s.billed_amount,
      accountsReceivable: s.accounts_receivable,
      paidAmount: s.paid_amount,
      wipWriteOffAmount: s.wip_write_off_amount,
      updateSource: s.update_source,
    },
  }));
}

async function fetchBudgetAmendmentEvents(matterId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from('budget_amendments')
    .select('id, amendment_date, created_by, previous_budget, new_budget, previous_bm_fee, new_bm_fee, previous_local_counsel, new_local_counsel, notes, created_at')
    .eq('matter_id', matterId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((a: Record<string, unknown>) => {
    const parts: string[] = [];
    if (a.previous_budget !== a.new_budget)
      parts.push(`Budget: ${formatDelta(a.previous_budget as number, a.new_budget as number)}`);
    if (a.previous_bm_fee !== a.new_bm_fee)
      parts.push(`BM Fee: ${formatDelta(a.previous_bm_fee as number, a.new_bm_fee as number)}`);
    if (a.previous_local_counsel !== a.new_local_counsel)
      parts.push(`LC: ${formatDelta(a.previous_local_counsel as number, a.new_local_counsel as number)}`);

    return {
      id: `amendment-${a.id}`,
      type: 'budget_amendment' as const,
      date: (a.created_at as string) || (a.amendment_date as string),
      userId: (a.created_by as string) || null,
      title: 'Budget amended',
      description: parts.join('; ') + (a.notes ? ` \u2014 ${a.notes}` : ''),
      metadata: {
        previousBudget: a.previous_budget,
        newBudget: a.new_budget,
        previousBmFee: a.previous_bm_fee,
        newBmFee: a.new_bm_fee,
        previousLocalCounsel: a.previous_local_counsel,
        newLocalCounsel: a.new_local_counsel,
        notes: a.notes,
      },
    };
  });
}

async function fetchWriteOffEvents(matterId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from('write_off_events' as never)
    .select('id, write_off_date, user_id, write_off_amount, fee_currency, description, created_at')
    .eq('matter_id', matterId)
    .order('write_off_date', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((w) => ({
    id: `writeoff-${w.id}`,
    type: 'write_off' as const,
    date: (w.created_at as string) || (w.write_off_date as string),
    userId: (w.user_id as string) || null,
    title: 'WIP write-off recorded',
    description: `${formatCurrency(w.write_off_amount as number)} written off${w.fee_currency !== 'USD' ? ` (${w.fee_currency})` : ''}${w.description ? ` \u2014 ${w.description}` : ''}`,
    metadata: {
      writeOffAmount: w.write_off_amount,
      feeCurrency: w.fee_currency,
      writeOffDate: w.write_off_date,
      description: w.description,
    },
  }));
}

async function fetchWipUpdateEvents(matterId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from('master_wip_snapshot_changes')
    .select('id, created_at, before_wip_amount, before_billed_amount, before_accounts_receivable, before_paid_amount, was_new_snapshot, snapshot_id')
    .eq('matter_id', matterId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((c: Record<string, unknown>) => ({
    id: `wipupdate-${c.id}`,
    type: 'wip_update' as const,
    date: c.created_at as string,
    userId: null,
    title: c.was_new_snapshot ? 'Bulk WIP import (new snapshot)' : 'Bulk WIP update',
    description: c.before_wip_amount != null
      ? `Previous WIP: ${formatCurrency(c.before_wip_amount as number)}`
      : 'Initial snapshot created by bulk import',
    metadata: {
      beforeWipAmount: c.before_wip_amount,
      beforeBilledAmount: c.before_billed_amount,
      beforeAccountsReceivable: c.before_accounts_receivable,
      beforePaidAmount: c.before_paid_amount,
      wasNewSnapshot: c.was_new_snapshot,
      snapshotId: c.snapshot_id,
    },
  }));
}

export function useMatterActivity(matterId?: string, limit = 20) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['matter-activity', matterId, limit],
    queryFn: async () => {
      if (!matterId) return [];

      const [snapshots, amendments, writeOffs, wipUpdates] = await Promise.all([
        fetchSnapshotEvents(matterId),
        fetchBudgetAmendmentEvents(matterId),
        fetchWriteOffEvents(matterId),
        fetchWipUpdateEvents(matterId),
      ]);

      const all = [...snapshots, ...amendments, ...writeOffs, ...wipUpdates];
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return all.slice(0, limit);
    },
    enabled: !!user && !!matterId,
  });
}

export function useGlobalActivity(limit = 50) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['global-activity', limit],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 1);
      const cutoff = sixMonthsAgo.toISOString();

      const [snapshots, amendments, writeOffs] = await Promise.all([
        (async () => {
          const { data } = await supabase
            .from('financial_snapshots')
            .select('id, matter_id, as_of_date, created_by, wip_amount, billed_amount, accounts_receivable, paid_amount, wip_write_off_amount, created_at, update_source')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(100);
          return (data || []).map((s: Record<string, unknown>) => ({
            id: `snapshot-${s.id}`,
            type: 'snapshot' as const,
            date: (s.created_at as string) || (s.as_of_date as string),
            userId: (s.created_by as string) || null,
            title: `Financial snapshot ${s.update_source === 'bulk' ? '(bulk import)' : 'updated'}`,
            description: `WIP: ${formatCurrency(s.wip_amount as number)}, Billed: ${formatCurrency(s.billed_amount as number)}`,
            metadata: { matterId: s.matter_id, asOfDate: s.as_of_date, updateSource: s.update_source },
          }));
        })(),
        (async () => {
          const { data } = await supabase
            .from('budget_amendments')
            .select('id, matter_id, amendment_date, created_by, previous_budget, new_budget, notes, created_at')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(100);
          return (data || []).map((a: Record<string, unknown>) => ({
            id: `amendment-${a.id}`,
            type: 'budget_amendment' as const,
            date: (a.created_at as string) || (a.amendment_date as string),
            userId: (a.created_by as string) || null,
            title: 'Budget amended',
            description: `Budget: ${formatDelta(a.previous_budget as number, a.new_budget as number)}${a.notes ? ` \u2014 ${a.notes}` : ''}`,
            metadata: { matterId: a.matter_id },
          }));
        })(),
        (async () => {
          const { data } = await supabase
            .from('write_off_events' as never)
            .select('id, matter_id, write_off_date, user_id, write_off_amount, description, created_at')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(100);
          return ((data || []) as Record<string, unknown>[]).map((w) => ({
            id: `writeoff-${w.id}`,
            type: 'write_off' as const,
            date: (w.created_at as string) || (w.write_off_date as string),
            userId: (w.user_id as string) || null,
            title: 'WIP write-off recorded',
            description: `${formatCurrency(w.write_off_amount as number)} written off${w.description ? ` \u2014 ${w.description}` : ''}`,
            metadata: { matterId: w.matter_id },
          }));
        })(),
      ]);

      const all = [...snapshots, ...amendments, ...writeOffs];
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return all.slice(0, limit);
    },
    enabled: !!user,
  });
}
