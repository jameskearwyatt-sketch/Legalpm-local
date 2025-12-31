import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableScrollControls } from '@/components/ui/table-scroll-controls';
import { useMatters } from '@/lib/hooks/useMatters';
import { 
  Clock, 
  CalendarClock,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Rocket
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, isAfter } from 'date-fns';

type PipelineFlagType = 'rfp_upcoming' | 'rfp_overdue';

interface FlaggedMatter {
  id: string;
  matter_name: string;
  matter_number: string;
  client_name: string;
  flags: PipelineFlagType[];
  rfpDaysInfo?: string;
}

const flagConfig: Record<PipelineFlagType, { label: string; icon: React.ReactNode; description: string }> = {
  rfp_upcoming: {
    label: 'RFP Deadline Soon',
    icon: <Clock className="h-4 w-4" />,
    description: 'RFP response deadline within 7 days'
  },
  rfp_overdue: {
    label: 'Awaiting Decision',
    icon: <CalendarClock className="h-4 w-4" />,
    description: 'RFP submitted, check in with client'
  },
};

export default function PipelineFlags() {
  const { matters, isLoading } = useMatters();

  // Only check Pipeline matters
  const pipelineMatters = matters.filter(m => m.category === 'Pipeline');
  const today = new Date();

  // Build flagged matters list
  const flaggedMatters: FlaggedMatter[] = pipelineMatters
    .map(matter => {
      const flags: PipelineFlagType[] = [];
      let rfpDaysInfo: string | undefined;
      
      // Pipeline deadline flags
      if (matter.submission_deadline) {
        const deadline = parseISO(matter.submission_deadline);
        const daysUntilDeadline = differenceInDays(deadline, today);
        
        if (!matter.submitted) {
          // Not yet submitted - check if deadline is within 7 days
          if (daysUntilDeadline <= 7 && daysUntilDeadline >= 0) {
            flags.push('rfp_upcoming');
            rfpDaysInfo = daysUntilDeadline === 0 
              ? 'Due today!' 
              : `Due in ${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'}`;
          }
        } else if (!matter.pipeline_outcome || matter.pipeline_outcome === 'Pending') {
          // Submitted but no decision yet - check if we should follow up (weekly after deadline)
          if (isAfter(today, deadline)) {
            const daysSinceDeadline = differenceInDays(today, deadline);
            const weeksSince = Math.floor(daysSinceDeadline / 7);
            if (weeksSince >= 1) {
              flags.push('rfp_overdue');
              rfpDaysInfo = `${weeksSince} week${weeksSince === 1 ? '' : 's'} since submission`;
            }
          }
        }
      }
      
      return {
        id: matter.id,
        matter_name: matter.matter_name,
        matter_number: matter.cm_number && matter.cm_number.trim() !== '' 
          ? matter.cm_number 
          : '[CM number required]',
        client_name: matter.clients?.name || '',
        flags,
        rfpDaysInfo,
      };
    })
    .filter(m => m.flags.length > 0)
    .sort((a, b) => {
      // Prioritize upcoming RFPs
      const aHasUpcoming = a.flags.includes('rfp_upcoming');
      const bHasUpcoming = b.flags.includes('rfp_upcoming');
      if (aHasUpcoming && !bHasUpcoming) return -1;
      if (!aHasUpcoming && bHasUpcoming) return 1;
      return 0;
    });

  // Count by flag type
  const flagCounts: Record<PipelineFlagType, number> = {
    rfp_upcoming: 0,
    rfp_overdue: 0,
  };
  
  flaggedMatters.forEach(m => {
    m.flags.forEach(f => flagCounts[f]++);
  });

  const totalFlags = Object.values(flagCounts).reduce((a, b) => a + b, 0);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-3">
              <Rocket className="h-7 w-7 text-amber-500" />
              Pipeline Flags
            </h1>
            <p className="text-muted-foreground mt-1">
              Track RFP deadlines and pending decisions for pipeline matters
            </p>
          </div>
          {totalFlags === 0 && !isLoading && (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">All clear!</span>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className={cn(
            "shadow-card transition-colors",
            flagCounts.rfp_upcoming > 0 ? "border-orange-300 dark:border-orange-700" : "border-success/30"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  flagCounts.rfp_upcoming > 0 
                    ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" 
                    : "bg-success/10 text-success"
                )}>
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{flagCounts.rfp_upcoming}</p>
                  <p className="text-xs text-muted-foreground">RFP Deadline Soon</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "shadow-card transition-colors",
            flagCounts.rfp_overdue > 0 ? "border-purple-300 dark:border-purple-700" : "border-success/30"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  flagCounts.rfp_overdue > 0 
                    ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" 
                    : "bg-success/10 text-success"
                )}>
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{flagCounts.rfp_overdue}</p>
                  <p className="text-xs text-muted-foreground">Awaiting Decision</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Flagged Matters Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Pipeline Matters Requiring Attention</CardTitle>
            <CardDescription>
              {flaggedMatters.length} {flaggedMatters.length === 1 ? 'matter' : 'matters'} with upcoming deadlines or pending decisions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : flaggedMatters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="h-12 w-12 text-success mb-4" />
                <h3 className="text-lg font-medium text-foreground">All clear!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  No pipeline deadlines requiring immediate attention
                </p>
              </div>
            ) : (
              <TableScrollControls>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[200px]">Matter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flaggedMatters.map((matter) => (
                      <TableRow key={matter.id} className="group">
                        <TableCell>
                          <p className="text-sm text-muted-foreground">{matter.client_name}</p>
                          <p className="font-medium text-foreground">{matter.matter_name}</p>
                          <p className="text-xs text-muted-foreground">{matter.matter_number}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {matter.flags.map((flag) => (
                              <span
                                key={flag}
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border",
                                  flag === 'rfp_upcoming' && 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
                                  flag === 'rfp_overdue' && 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700'
                                )}
                              >
                                {flagConfig[flag].icon}
                                {matter.rfpDaysInfo || flagConfig[flag].label}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/matters/${matter.id}/edit`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScrollControls>
            )}
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="shadow-card bg-muted/30">
          <CardContent className="pt-6">
            <h4 className="font-medium text-foreground mb-2">Pipeline Tracking Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Matters show alerts 7 days before RFP submission deadline</li>
              <li>• After submission, you'll be reminded weekly to follow up with the client</li>
              <li>• Update the pipeline outcome to Won, Lost, or Pending to track progress</li>
              <li>• Click the edit button to update submission status or outcome</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}