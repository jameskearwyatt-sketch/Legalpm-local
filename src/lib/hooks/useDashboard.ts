import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface DashboardStats {
  totalBudget: number;
  totalWip: number;
  totalBilled: number;
  totalPaid: number;
  avgCollectionRate: number;
  openMattersCount: number;
  alerts: Alert[];
}

export interface Alert {
  id: string;
  type: 'Over Budget' | 'Near Budget' | 'High WIP' | 'Poor Collection' | 'Overdue Invoice';
  matterId: string;
  matterName: string;
  matterNumber: string;
  clientName: string;
  message: string;
  value?: number;
}

export function useDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: async () => {
      // Get all open matters with their clients
      const { data: matters, error: mattersError } = await supabase
        .from('matters')
        .select(`
          *,
          clients (id, name)
        `)
        .eq('status', 'Open');

      if (mattersError) throw mattersError;

      const matterIds = matters?.map(m => m.id) || [];
      
      if (matterIds.length === 0) {
        return {
          totalBudget: 0,
          totalWip: 0,
          totalBilled: 0,
          totalPaid: 0,
          avgCollectionRate: 0,
          openMattersCount: 0,
          alerts: [],
        } as DashboardStats;
      }

      // Get latest snapshots for each matter
      const { data: snapshots } = await supabase
        .from('financial_snapshots')
        .select('*')
        .in('matter_id', matterIds)
        .order('as_of_date', { ascending: false });

      // Get overdue invoices
      const today = new Date().toISOString().split('T')[0];
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select('*, matters(id, matter_name, matter_number, clients(name))')
        .in('matter_id', matterIds)
        .neq('status', 'Paid')
        .lt('due_date', today);

      // Create a map of matter_id to latest snapshot
      const snapshotMap = new Map<string, any>();
      snapshots?.forEach(snap => {
        if (!snapshotMap.has(snap.matter_id)) {
          snapshotMap.set(snap.matter_id, snap);
        }
      });

      let totalBudget = 0;
      let totalWip = 0;
      let totalBilled = 0;
      let totalPaid = 0;
      const alerts: Alert[] = [];

      matters?.forEach(matter => {
        const snapshot = snapshotMap.get(matter.id);
        const budget = Number(matter.agreed_budget_amount) || 0;
        const wipAmount = Number(snapshot?.wip_amount) || 0;
        const billedAmount = Number(snapshot?.billed_amount) || 0;
        const paidAmount = Number(snapshot?.paid_amount) || 0;

        totalBudget += budget;
        totalWip += wipAmount;
        totalBilled += billedAmount;
        totalPaid += paidAmount;

        const totalUsed = billedAmount + wipAmount;
        const budgetUsedPercent = budget > 0 ? (totalUsed / budget) * 100 : 0;
        const collectionRate = billedAmount > 0 ? (paidAmount / billedAmount) * 100 : 100;
        const clientName = matter.clients?.name || 'Unknown Client';

        // Over budget check
        if (budget > 0 && totalUsed > budget) {
          alerts.push({
            id: `over-${matter.id}`,
            type: 'Over Budget',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            clientName,
            message: `Budget exceeded by £${(totalUsed - budget).toLocaleString()}`,
            value: budgetUsedPercent,
          });
        }
        // Near budget check (>= 80%)
        else if (budget > 0 && budgetUsedPercent >= 80 && budgetUsedPercent <= 100) {
          alerts.push({
            id: `near-${matter.id}`,
            type: 'Near Budget',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            clientName,
            message: `${budgetUsedPercent.toFixed(0)}% of budget used`,
            value: budgetUsedPercent,
          });
        }

        // High WIP check
        if (wipAmount > 50000 && billedAmount < wipAmount * 0.5) {
          alerts.push({
            id: `wip-${matter.id}`,
            type: 'High WIP',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            clientName,
            message: `WIP of £${wipAmount.toLocaleString()} with low billing`,
            value: wipAmount,
          });
        }

        // Poor collection check
        if (billedAmount > 0 && collectionRate < 60) {
          alerts.push({
            id: `collection-${matter.id}`,
            type: 'Poor Collection',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            clientName,
            message: `Collection rate at ${collectionRate.toFixed(0)}%`,
            value: collectionRate,
          });
        }
      });

      // Add overdue invoice alerts
      overdueInvoices?.forEach(invoice => {
        const matter = invoice.matters as any;
        if (matter) {
          const dueDate = new Date(invoice.due_date!);
          const daysOverdue = Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          alerts.push({
            id: `overdue-${invoice.id}`,
            type: 'Overdue Invoice',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            clientName: matter.clients?.name || 'Unknown Client',
            message: `Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue`,
            value: daysOverdue,
          });
        }
      });

      const avgCollectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 100;

      return {
        totalBudget,
        totalWip,
        totalBilled,
        totalPaid,
        avgCollectionRate,
        openMattersCount: matters?.length || 0,
        alerts: alerts.sort((a, b) => {
          const priority = { 'Over Budget': 1, 'Overdue Invoice': 2, 'Near Budget': 3, 'Poor Collection': 4, 'High WIP': 5 };
          return priority[a.type] - priority[b.type];
        }),
      } as DashboardStats;
    },
    enabled: !!user,
  });
}
