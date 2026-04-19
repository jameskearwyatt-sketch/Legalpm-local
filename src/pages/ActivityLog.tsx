import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, History, Camera, DollarSign, TrendingDown, Search } from 'lucide-react';
import { useGlobalActivity, TimelineEvent } from '@/lib/hooks/useMatterActivity';
import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'react-router-dom';

const EVENT_CONFIG: Record<TimelineEvent['type'], { icon: typeof Camera; color: string; bgColor: string; label: string }> = {
  snapshot: { icon: Camera, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Snapshot' },
  budget_amendment: { icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Budget' },
  write_off: { icon: TrendingDown, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Write-off' },
  wip_update: { icon: Camera, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'WIP Update' },
};

export default function ActivityLog() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { data: events = [], isLoading } = useGlobalActivity(100);

  const filtered = events.filter(e => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      return e.title.toLowerCase().includes(term) || e.description.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Activity Log
          </h1>
          <p className="text-muted-foreground mt-1">Recent changes across all matters (last 30 days)</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activity..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="snapshot">Snapshots</SelectItem>
                  <SelectItem value="budget_amendment">Budget Amendments</SelectItem>
                  <SelectItem value="write_off">Write-offs</SelectItem>
                  <SelectItem value="wip_update">WIP Updates</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activity found.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map(event => {
                  const config = EVENT_CONFIG[event.type];
                  const Icon = config.icon;
                  const matterId = (event.metadata as Record<string, unknown>).matterId as string | undefined;

                  return (
                    <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <Badge variant="outline" className="text-[10px]">{config.label}</Badge>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        {matterId && (
                          <Link to={`/matters/${matterId}`} className="text-xs text-primary hover:underline mt-1 inline-block">
                            View matter
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
