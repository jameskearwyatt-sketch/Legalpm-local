import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Camera, DollarSign, TrendingDown, RefreshCw, History, ChevronDown, ChevronUp } from 'lucide-react';
import { useMatterActivity, TimelineEvent } from '@/lib/hooks/useMatterActivity';
import { formatDistanceToNow } from 'date-fns';

const EVENT_CONFIG: Record<TimelineEvent['type'], { icon: typeof Camera; color: string; bgColor: string; borderColor: string }> = {
  snapshot: { icon: Camera, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
  budget_amendment: { icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-300' },
  write_off: { icon: TrendingDown, color: 'text-amber-600', bgColor: 'bg-amber-100', borderColor: 'border-amber-300' },
  wip_update: { icon: RefreshCw, color: 'text-purple-600', bgColor: 'bg-purple-100', borderColor: 'border-purple-300' },
};

const TYPE_LABELS: Record<TimelineEvent['type'], string> = {
  snapshot: 'Snapshots',
  budget_amendment: 'Budget',
  write_off: 'Write-offs',
  wip_update: 'WIP Updates',
};

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <div className="flex gap-3 relative">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        <div className="w-px flex-1 bg-border min-h-[16px]" />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{event.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
            </p>
          </div>
          <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${config.borderColor}`}>
            {TYPE_LABELS[event.type]}
          </Badge>
        </div>
        {event.description && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 text-left w-full"
          >
            <p className={`text-xs text-muted-foreground ${expanded ? '' : 'line-clamp-2'}`}>
              {event.description}
            </p>
            {event.description.length > 100 && (
              <span className="text-xs text-primary flex items-center gap-0.5 mt-0.5">
                {expanded ? <><ChevronUp className="h-3 w-3" /> Less</> : <><ChevronDown className="h-3 w-3" /> More</>}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

interface MatterActivityTimelineProps {
  matterId: string;
}

export default function MatterActivityTimeline({ matterId }: MatterActivityTimelineProps) {
  const [limit, setLimit] = useState(20);
  const [typeFilter, setTypeFilter] = useState<TimelineEvent['type'] | 'all'>('all');
  const { data: events = [], isLoading } = useMatterActivity(matterId, limit);

  const filtered = typeFilter === 'all' ? events : events.filter(e => e.type === typeFilter);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Activity Timeline
        </CardTitle>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(['all', 'snapshot', 'budget_amendment', 'write_off', 'wip_update'] as const).map(t => (
            <Button
              key={t}
              variant={typeFilter === t ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? 'All' : TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet.</p>
        ) : (
          <>
            <div className="space-y-0">
              {filtered.map(event => (
                <TimelineEventCard key={event.id} event={event} />
              ))}
            </div>
            {events.length >= limit && (
              <div className="text-center pt-2">
                <Button variant="ghost" size="sm" onClick={() => setLimit(l => l + 20)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
