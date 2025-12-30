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
  type: 'Over Budget' | 'Near Budget' | 'High WIP' | 'Poor Collection';
  matterId: string;
  matterName: string;
  matterNumber: string;
  cmNumber: string;
  clientName: string;
  message: string;
  currency: string;
  value?: number;
}

export function useDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: async () => {
      // Get all Live matters (not Pipeline) with their clients
      const { data: matters, error: mattersError } = await supabase
        .from('matters')
        .select(`
          *,
          clients (id, name)
        `)
        .eq('category', 'Live');

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

      // Create a map of matter_id to latest snapshot
      const snapshotMap = new Map<string, any>();
      snapshots?.forEach(snap => {
        if (!snapshotMap.has(snap.matter_id)) {
          snapshotMap.set(snap.matter_id, snap);
        }
      });

      let totalBmFeesUsd = 0;
      let totalWipUsd = 0;
      let totalBilledUsd = 0;
      let totalPaidUsd = 0;
      const alerts: Alert[] = [];

      matters?.forEach(matter => {
        const snapshot = snapshotMap.get(matter.id);
        // Use bm_fee_component as the BM fee and convert to USD using exchange_rate
        const bmFee = Number(matter.bm_fee_component) || 0;
        const exchangeRate = Number(matter.exchange_rate) || 1;
        const budget = Number(matter.fee_amount_upper_end) || 0;
        const wipAmount = Number(snapshot?.wip_amount) || 0;
        const billedAmount = Number(snapshot?.billed_amount) || 0;
        const paidAmount = Number(snapshot?.paid_amount) || 0;

        // Convert to USD using exchange rate
        totalBmFeesUsd += bmFee * exchangeRate;
        totalWipUsd += wipAmount * exchangeRate;
        totalBilledUsd += billedAmount * exchangeRate;
        totalPaidUsd += paidAmount * exchangeRate;

        const totalUsed = billedAmount + wipAmount;
        const budgetUsedPercent = budget > 0 ? (totalUsed / budget) * 100 : 0;
        const collectionRate = billedAmount > 0 ? (paidAmount / billedAmount) * 100 : 100;
        const clientName = matter.clients?.name || 'Unknown Client';

        // Use cm_number if available, otherwise show placeholder
        const cmNumber = matter.cm_number && matter.cm_number.trim() !== '' 
          ? matter.cm_number 
          : '[CM number required]';
        
        // Get the correct currency symbol for display
        const feeCurrency = matter.fee_currency || 'GBP';
        const currencySymbols: Record<string, string> = {
          'GBP': '£', 'USD': '$', 'EUR': '€', 'MYR': 'RM ', 'CHF': 'CHF ', 'AUD': 'A$', 'CAD': 'C$', 'SGD': 'S$'
        };
        const currencySymbol = currencySymbols[feeCurrency] || feeCurrency + ' ';

        // Over budget check
        if (budget > 0 && totalUsed > budget) {
          alerts.push({
            id: `over-${matter.id}`,
            type: 'Over Budget',
            matterId: matter.id,
            matterName: matter.matter_name,
            matterNumber: matter.matter_number,
            cmNumber,
            clientName,
            currency: feeCurrency,
            message: `Budget exceeded by ${currencySymbol}${(totalUsed - budget).toLocaleString()}`,
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
            cmNumber,
            clientName,
            currency: feeCurrency,
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
            cmNumber,
            clientName,
            currency: feeCurrency,
            message: `WIP of ${currencySymbol}${wipAmount.toLocaleString()} with low billing`,
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
            cmNumber,
            clientName,
            currency: feeCurrency,
            message: `Collection rate at ${collectionRate.toFixed(0)}%`,
            value: collectionRate,
          });
        }
      });

      const avgCollectionRate = totalBilledUsd > 0 ? (totalPaidUsd / totalBilledUsd) * 100 : 100;

      return {
        totalBudget: totalBmFeesUsd,
        totalWip: totalWipUsd,
        totalBilled: totalBilledUsd,
        totalPaid: totalPaidUsd,
        avgCollectionRate,
        openMattersCount: matters?.length || 0,
        alerts: alerts.sort((a, b) => {
          const priority = { 'Over Budget': 1, 'Near Budget': 2, 'Poor Collection': 3, 'High WIP': 4 };
          return priority[a.type] - priority[b.type];
        }),
      } as DashboardStats;
    },
    enabled: !!user,
  });
}
