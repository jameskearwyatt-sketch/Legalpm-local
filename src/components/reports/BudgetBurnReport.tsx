import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { useBudgetBurnReport, DateRange } from '@/lib/hooks/useReportData';
import ReportControls from './ReportControls';
import { exportReportToExcel } from '@/lib/exportReportToExcel';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function BudgetBurnReport() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    return { start, end };
  });
  const [groupBy, setGroupBy] = useState<'practice_area' | 'client'>('practice_area');

  const { data = [], isLoading } = useBudgetBurnReport(dateRange, groupBy);

  const handleExport = () => {
    exportReportToExcel({
      title: 'Budget Burn Report',
      columns: [
        { header: 'Group', key: 'group' },
        { header: 'Budget ($)', key: 'budget', format: 'currency' },
        { header: 'Actual Spend ($)', key: 'actualSpend', format: 'currency' },
        { header: 'Burn %', key: 'burnPercent', format: 'percent' },
        { header: 'Matters', key: 'matterCount' },
      ],
      rows: data as unknown as Record<string, unknown>[],
    });
  };

  return (
    <div className="space-y-4">
      <ReportControls
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        groupBy={groupBy}
        onGroupByChange={v => setGroupBy(v as 'practice_area' | 'client')}
        groupByOptions={[{ value: 'practice_area', label: 'Practice Area' }, { value: 'client', label: 'Client' }]}
        reportType="budget_burn"
        onExport={handleExport}
      />

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, data.length * 40)}>
              <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="group" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Bar dataKey="burnPercent" name="Burn %" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={index} fill={entry.burnPercent > 100 ? 'hsl(var(--destructive))' : entry.burnPercent > 80 ? 'hsl(var(--chart-3))' : 'hsl(var(--chart-2))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detailed Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Group</th>
                    <th className="pb-2 font-medium text-right">Budget</th>
                    <th className="pb-2 font-medium text-right">Actual</th>
                    <th className="pb-2 font-medium text-right">Burn %</th>
                    <th className="pb-2 font-medium text-right">Matters</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(d => (
                    <tr key={d.group} className="border-b last:border-0">
                      <td className="py-2">{d.group}</td>
                      <td className="py-2 text-right">{formatCurrency(d.budget)}</td>
                      <td className="py-2 text-right">{formatCurrency(d.actualSpend)}</td>
                      <td className="py-2 text-right">
                        <Badge variant={d.burnPercent > 100 ? 'destructive' : d.burnPercent > 80 ? 'secondary' : 'outline'}>
                          {d.burnPercent.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="py-2 text-right">{d.matterCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
