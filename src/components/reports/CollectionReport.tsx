import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { useCollectionReport, DateRange } from '@/lib/hooks/useReportData';
import ReportControls from './ReportControls';
import { exportReportToExcel } from '@/lib/exportReportToExcel';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function CollectionReport() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    return { start, end };
  });
  const [groupBy, setGroupBy] = useState<'practice_area' | 'matter'>('practice_area');

  const { data = [], isLoading } = useCollectionReport(dateRange, groupBy);

  const avgRate = useMemo(() => {
    if (data.length === 0) return 0;
    const totalBilled = data.reduce((s, d) => s + d.billed, 0);
    const totalPaid = data.reduce((s, d) => s + d.paid, 0);
    return totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
  }, [data]);

  const handleExport = () => {
    exportReportToExcel({
      title: 'Collection Rate Report',
      columns: [
        { header: 'Group', key: 'group' },
        { header: 'Billed ($)', key: 'billed', format: 'currency' },
        { header: 'Paid ($)', key: 'paid', format: 'currency' },
        { header: 'Collection Rate', key: 'collectionRate', format: 'percent' },
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
        onGroupByChange={v => setGroupBy(v as 'practice_area' | 'matter')}
        groupByOptions={[{ value: 'practice_area', label: 'Practice Area' }, { value: 'matter', label: 'Matter' }]}
        reportType="collection"
        onExport={handleExport}
      />

      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Overall Collection Rate</p>
          <p className={`text-2xl font-bold ${avgRate < 60 ? 'text-red-600' : avgRate < 80 ? 'text-amber-600' : 'text-green-600'}`}>
            {avgRate.toFixed(1)}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, data.length * 35)}>
              <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <YAxis type="category" dataKey="group" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Bar dataKey="collectionRate" name="Collection Rate" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={index} fill={entry.collectionRate < 60 ? 'hsl(var(--destructive))' : entry.collectionRate < 80 ? 'hsl(var(--chart-3))' : 'hsl(var(--chart-2))'} />
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
                    <th className="pb-2 font-medium text-right">Billed</th>
                    <th className="pb-2 font-medium text-right">Paid</th>
                    <th className="pb-2 font-medium text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(d => (
                    <tr key={d.group} className="border-b last:border-0">
                      <td className="py-2">{d.group}</td>
                      <td className="py-2 text-right">{formatCurrency(d.billed)}</td>
                      <td className="py-2 text-right">{formatCurrency(d.paid)}</td>
                      <td className="py-2 text-right">
                        <Badge variant={d.collectionRate < 60 ? 'destructive' : d.collectionRate < 80 ? 'secondary' : 'outline'}>
                          {d.collectionRate.toFixed(1)}%
                        </Badge>
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
