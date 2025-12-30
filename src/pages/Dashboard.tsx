import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { 
  PoundSterling, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Clock,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboard();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const kpiCards = [
    {
      title: 'Total Agreed Budget',
      value: formatCurrency(stats?.totalBudget || 0),
      icon: <PoundSterling className="h-5 w-5" />,
      variant: 'default' as const,
    },
    {
      title: 'Work in Progress',
      value: formatCurrency(stats?.totalWip || 0),
      icon: <Clock className="h-5 w-5" />,
      variant: 'default' as const,
    },
    {
      title: 'Total Billed',
      value: formatCurrency(stats?.totalBilled || 0),
      icon: <FileText className="h-5 w-5" />,
      variant: 'default' as const,
    },
    {
      title: 'Cash Received',
      value: formatCurrency(stats?.totalPaid || 0),
      icon: <CheckCircle className="h-5 w-5" />,
      variant: 'success' as const,
    },
    {
      title: 'Collection Rate',
      value: `${(stats?.avgCollectionRate || 0).toFixed(1)}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      variant: (stats?.avgCollectionRate || 0) >= 80 ? 'success' as const : (stats?.avgCollectionRate || 0) >= 60 ? 'warning' as const : 'danger' as const,
    },
    {
      title: 'Open Matters',
      value: stats?.openMattersCount || 0,
      icon: <Briefcase className="h-5 w-5" />,
      variant: 'default' as const,
    },
  ];

  // Only show chart with actual data - no sample data
  const hasData = (stats?.totalWip || 0) + (stats?.totalBilled || 0) + (stats?.totalPaid || 0) > 0;
  const trendData = hasData ? [
    { month: 'Current', wip: stats?.totalWip || 0, billed: stats?.totalBilled || 0, paid: stats?.totalPaid || 0 },
  ] : [];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of your legal matter finances</p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link to="/matters">View All Matters</Link>
            </Button>
            <Button asChild>
              <Link to="/matters/new">
                <Briefcase className="mr-2 h-4 w-4" />
                New Matter
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpiCards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              variant={card.variant}
            />
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Trend Chart */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Financial Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {hasData ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis 
                        className="text-xs" 
                        tickFormatter={(value) => `£${(value / 1000)}k`}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 'var(--radius)',
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="wip" 
                        name="WIP"
                        stroke="hsl(var(--chart-3))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-3))' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="billed" 
                        name="Billed"
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-1))' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="paid" 
                        name="Paid"
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-2))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-72 text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No financial data yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Add snapshots to your matters to see trends</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Red Flags
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {stats?.alerts?.length || 0} issues
              </span>
            </CardHeader>
            <CardContent>
              {stats?.alerts && stats.alerts.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {stats.alerts.slice(0, 8).map((alert) => (
                    <Link
                      key={alert.id}
                      to={`/matters/${alert.matterId}`}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge status={alert.type} />
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">
                          {alert.matterName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alert.clientName} • {alert.matterNumber}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {alert.message}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-1" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-success mb-3" />
                  <p className="text-sm font-medium text-foreground">All clear!</p>
                  <p className="text-xs text-muted-foreground">No issues requiring attention</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
