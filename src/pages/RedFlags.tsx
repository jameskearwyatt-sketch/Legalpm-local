import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDashboard, Alert } from '@/lib/hooks/useDashboard';
import { 
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Loader2,
  DollarSign,
  TrendingDown,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const alertTypeConfig: Record<Alert['type'], { icon: React.ReactNode; color: string }> = {
  'Over Budget': { icon: <DollarSign className="h-4 w-4" />, color: 'text-destructive' },
  'Near Budget': { icon: <TrendingDown className="h-4 w-4" />, color: 'text-warning' },
  'High WIP': { icon: <Clock className="h-4 w-4" />, color: 'text-warning' },
  'Poor Collection': { icon: <TrendingDown className="h-4 w-4" />, color: 'text-warning' },
};

export default function RedFlags() {
  const { data: stats, isLoading } = useDashboard();

  // Group alerts by type
  const alertsByType = stats?.alerts?.reduce((acc, alert) => {
    if (!acc[alert.type]) {
      acc[alert.type] = [];
    }
    acc[alert.type].push(alert);
    return acc;
  }, {} as Record<Alert['type'], Alert[]>) || {};

  const alertTypeOrder: Alert['type'][] = ['Over Budget', 'Near Budget', 'Poor Collection', 'High WIP'];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const totalAlerts = stats?.alerts?.length || 0;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-warning" />
              Red Flags
            </h1>
            <p className="text-muted-foreground mt-1">
              {totalAlerts > 0 
                ? `${totalAlerts} issue${totalAlerts !== 1 ? 's' : ''} requiring attention across your live matters`
                : 'All clear - no issues requiring attention'}
            </p>
          </div>
        </div>

        {totalAlerts === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle className="h-16 w-16 text-success mb-4" />
              <h2 className="text-xl font-heading font-semibold text-foreground mb-2">All Clear!</h2>
              <p className="text-muted-foreground max-w-md">
                There are no red flags across your live matters. All budgets, collections, and invoices are in good standing.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {alertTypeOrder.map((type) => {
                const count = alertsByType[type]?.length || 0;
                const config = alertTypeConfig[type];
                return (
                  <Card key={type} className={cn("shadow-card", count > 0 && "border-l-4 border-l-warning")}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={config.color}>{config.icon}</span>
                        <span className="text-2xl font-bold text-foreground">{count}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{type}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Alert Lists by Type */}
            {alertTypeOrder.map((type) => {
              const alerts = alertsByType[type];
              if (!alerts || alerts.length === 0) return null;
              
              const config = alertTypeConfig[type];
              
              return (
                <Card key={type} className="shadow-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="font-heading text-lg flex items-center gap-2">
                      <span className={config.color}>{config.icon}</span>
                      {type}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {alerts.length} matter{alerts.length !== 1 ? 's' : ''}
                    </span>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {alerts.map((alert) => (
                        <Link
                          key={alert.id}
                          to={`/matters/${alert.matterId}`}
                          className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <StatusBadge status={alert.type} />
                            </div>
                            <p className="text-sm font-medium text-foreground truncate">
                              {alert.matterName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {alert.clientName} • {alert.cmNumber}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm text-muted-foreground">
                              {alert.message}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
