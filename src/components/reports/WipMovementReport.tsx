import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { useWipMovementReport, DateRange } from '@/lib/hooks/useReportData';
import ReportControls from './ReportControls';
import { exportReportToExcel } from '@/lib/exportReportToExcel';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function WipMovementReport() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    return { start, end };
  });
  const [groupBy, setGroupBy] = useState<'month' | 'quarter'>('month');

  const { data = [], isLoading } = useWipMovementReport(dateRange, groupBy);

  const totalDelta = useMemo(() => data.reduce((sum, d) => sum + d.delta, 0), [data]);

  const handleExport = () => {
    exportReportToExcel({
      title: 'WIP Movement Report',
      columns: [
        { header: 'Period', key: 'period' },
        { header: 'Opening WIP ($)', key: 'openingWip', format: 'currency' },
        { header: 'Closing WIP ($)', key: 'closingWip', format: 'currency' },
        { header: 'Delta ($)', key: 'delta', format: 'currency' },
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
        onGroupByChange={v => setGroupBy(v as 'month' | 'quarter')}
        groupByOptions={[{ value: 'month', label: 'Monthly' }, { value: 'quarter', label: 'Quarterly' }]}
        reportType="wip_movement"
        onExport={handleExport}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Net WIP Movement</p>
            <div className="flex items-center gap-1">
              {totalDelta >= 0 ? <ArrowUp className="h-5 w-5 text-red-600" /> : <ArrowDown className="h-5 w-5 text-green-600" />}
              <p className={`text-2xl font-bold ${totalDelta >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(Math.abs(totalDelta))}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Periods Analyzed</p>
            <p className="text-2xl font-bold">{data.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="delta" name="WIP Change" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={index} fill={entry.delta >= 0 ? 'hsl(var(--chart-3))' : 'hsl(var(--chart-2))'} />
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
            <CardTitle className="text-sm">Period-over-Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Period</th>
                    <th className="pb-2 font-medium text-right">Opening WIP</th>
                    <th className="pb-2 font-medium text-right">Closing WIP</th>
                    <th className="pb-2 font-medium text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(d => (
                    <tr key={d.period} className="border-b last:border-0">
                      <td className="py-2">{d.period}</td>
                      <td className="py-2 text-right">{formatCurrency(d.openingWip)}</td>
                      <td className="py-2 text-right">{formatCurrency(d.closingWip)}</td>
                      <td className={`py-2 text-right font-medium ${d.delta >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {d.delta >= 0 ? '+' : ''}{formatCurrency(d.delta)}
                      </td>
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
