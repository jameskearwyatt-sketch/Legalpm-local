import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useRealizationReport, DateRange } from '@/lib/hooks/useReportData';
import ReportControls from './ReportControls';
import { exportReportToExcel } from '@/lib/exportReportToExcel';

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function RealizationReport() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    return { start, end };
  });
  const [groupBy, setGroupBy] = useState<'month' | 'quarter'>('month');

  const { data = [], isLoading } = useRealizationReport(dateRange, groupBy);

  const avgRate = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((sum, d) => sum + d.realizationRate, 0) / data.length;
  }, [data]);

  const trend = useMemo(() => {
    if (data.length < 2) return 0;
    return data[data.length - 1].realizationRate - data[0].realizationRate;
  }, [data]);

  const handleExport = () => {
    exportReportToExcel({
      title: 'Realization Rate Report',
      columns: [
        { header: 'Period', key: 'period' },
        { header: 'Paid ($)', key: 'paid', format: 'currency' },
        { header: 'Billed ($)', key: 'billed', format: 'currency' },
        { header: 'Write-offs ($)', key: 'writeOffs', format: 'currency' },
        { header: 'Realization Rate', key: 'realizationRate', format: 'percent' },
      ],
      rows: data,
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
        reportType="realization"
        onExport={handleExport}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Average Realization</p>
            <p className="text-2xl font-bold">{formatPercent(avgRate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Trend</p>
            <div className="flex items-center gap-1">
              {trend >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
              <p className={`text-2xl font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>{trend >= 0 ? '+' : ''}{formatPercent(trend)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Periods</p>
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
            <p className="text-sm text-muted-foreground text-center py-8">No data available for this date range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => formatPercent(v)} />
                <Legend />
                <Line type="monotone" dataKey="realizationRate" name="Realization Rate" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
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
                    <th className="pb-2 font-medium">Period</th>
                    <th className="pb-2 font-medium text-right">Paid</th>
                    <th className="pb-2 font-medium text-right">Billed</th>
                    <th className="pb-2 font-medium text-right">Write-offs</th>
                    <th className="pb-2 font-medium text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(d => (
                    <tr key={d.period} className="border-b last:border-0">
                      <td className="py-2">{d.period}</td>
                      <td className="py-2 text-right">{formatCurrency(d.paid)}</td>
                      <td className="py-2 text-right">{formatCurrency(d.billed)}</td>
                      <td className="py-2 text-right">{formatCurrency(d.writeOffs)}</td>
                      <td className="py-2 text-right font-medium">{formatPercent(d.realizationRate)}</td>
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
