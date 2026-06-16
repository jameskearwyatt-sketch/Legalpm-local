import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { formatCurrency } from '@/lib/currencyUtils';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MonthlyBurn } from '@/lib/hooks/useDashboard';

interface BusynessDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthlyData: MonthlyBurn[];
  avg3M: number;
  avg6M: number;
  avg12M: number;
}

export function BusynessDetailDialog({ open, onOpenChange, monthlyData, avg3M, avg6M, avg12M }: BusynessDetailDialogProps) {
  const enrichedData = useMemo(() => {
    return monthlyData.map((d, i) => {
      const prev = i > 0 ? monthlyData[i - 1].burnUsd : null;
      const change = prev !== null && prev > 0 ? ((d.burnUsd - prev) / prev) * 100 : null;
      return { ...d, change };
    });
  }, [monthlyData]);

  const maxBurn = Math.max(...monthlyData.map(d => d.burnUsd), 1);

  // Quarter-over-quarter trend: recent 3 months vs preceding 3 months
  const recent3 = monthlyData.slice(-3);
  const prev3 = monthlyData.slice(-6, -3);
  const recentQAvg = recent3.reduce((s, d) => s + d.burnUsd, 0) / 3;
  const prevQAvg = prev3.reduce((s, d) => s + d.burnUsd, 0) / 3;
  const prevQHasData = prev3.some(d => d.matterCount > 0);
  const qoqChange = prevQHasData && prevQAvg > 0 ? ((recentQAvg - prevQAvg) / prevQAvg) * 100 : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Practice Busyness — Last 12 Months
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/60 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">3M Avg</p>
              <p className="text-sm font-heading font-bold tabular-nums">{formatCurrency(avg3M, 'USD')}</p>
              <p className="text-[10px] text-muted-foreground">/ month</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">6M Avg</p>
              <p className="text-sm font-heading font-bold tabular-nums">{formatCurrency(avg6M, 'USD')}</p>
              <p className="text-[10px] text-muted-foreground">/ month</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">12M Avg</p>
              <p className="text-sm font-heading font-bold tabular-nums">{formatCurrency(avg12M, 'USD')}</p>
              <p className="text-[10px] text-muted-foreground">/ month</p>
            </div>
          </div>

          {/* Trend Indicator — quarter-over-quarter */}
          <div className="flex items-center justify-center gap-2 text-sm">
            {qoqChange === null ? (
              <>
                <Minus className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Insufficient history for trend</span>
              </>
            ) : qoqChange > 10 ? (
              <>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-600 font-medium">Getting busier</span>
                <span className="text-muted-foreground">(+{qoqChange.toFixed(0)}% vs prior quarter)</span>
              </>
            ) : qoqChange < -10 ? (
              <>
                <TrendingDown className="h-4 w-4 text-amber-600" />
                <span className="text-amber-600 font-medium">Quietening down</span>
                <span className="text-muted-foreground">({qoqChange.toFixed(0)}% vs prior quarter)</span>
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Stable</span>
                <span className="text-muted-foreground">({qoqChange > 0 ? '+' : ''}{qoqChange.toFixed(0)}% vs prior quarter)</span>
              </>
            )}
          </div>

          {/* Chart */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={enrichedData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: string) => v.split(' ')[0]}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload as (typeof enrichedData)[0];
                    return (
                      <div className="rounded-lg border border-border bg-card p-2.5 shadow-lg text-xs">
                        <p className="font-medium text-foreground">{d.monthLabel}</p>
                        <p className="text-foreground mt-1">{formatCurrency(d.burnUsd, 'USD')}</p>
                        {d.change !== null && (
                          <p className={cn('mt-0.5', d.change > 0 ? 'text-emerald-600' : d.change < 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                            {d.change > 0 ? '+' : ''}{d.change.toFixed(1)}% vs prev month
                          </p>
                        )}
                        <p className="text-muted-foreground mt-0.5">{d.matterCount} matter{d.matterCount !== 1 ? 's' : ''} contributing</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={avg12M} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" opacity={0.6} />
                <Area
                  type="monotone"
                  dataKey="burnUsd"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#burnGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Month-by-month table */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Month</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Burn (USD)</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Change</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Matters</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground w-24">Level</th>
                </tr>
              </thead>
              <tbody>
                {enrichedData.map((d) => (
                  <tr key={d.month} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 px-3 font-medium text-foreground">{d.monthLabel}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-foreground">{formatCurrency(d.burnUsd, 'USD')}</td>
                    <td className={cn(
                      'py-1.5 px-3 text-right tabular-nums',
                      d.change === null ? 'text-muted-foreground' : d.change > 0 ? 'text-emerald-600' : d.change < 0 ? 'text-amber-600' : 'text-muted-foreground'
                    )}>
                      {d.change !== null ? `${d.change > 0 ? '+' : ''}${d.change.toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{d.matterCount}</td>
                    <td className="py-1.5 px-3">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${maxBurn > 0 ? (d.burnUsd / maxBurn) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Burn = new work entering WIP each month (ΔWIP + ΔBilled + ΔWrite-off). Higher burn = busier practice.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
