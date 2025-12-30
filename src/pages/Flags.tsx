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
import { useMatters } from '@/lib/hooks/useMatters';
import { 
  Flag, 
  FileSignature, 
  Shield, 
  FolderOpen, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Clock,
  CalendarClock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, isAfter, isBefore, addDays } from 'date-fns';

type FlagType = 'engagement_letter' | 'aml_kyc' | 'matter_open' | 'conflicts' | 'rfp_upcoming' | 'rfp_overdue';

interface FlaggedMatter {
  id: string;
  matter_name: string;
  matter_number: string;
  client_name: string;
  category: string;
  flags: FlagType[];
  rfpDaysInfo?: string;
}

const flagConfig: Record<FlagType, { label: string; icon: React.ReactNode; description: string }> = {
  engagement_letter: {
    label: 'No Engagement Letter',
    icon: <FileSignature className="h-4 w-4" />,
    description: 'Assignment letter not signed'
  },
  aml_kyc: {
    label: 'Incomplete AML/KYC',
    icon: <Shield className="h-4 w-4" />,
    description: 'AML/KYC checks not complete'
  },
  matter_open: {
    label: 'Matter Not Open',
    icon: <FolderOpen className="h-4 w-4" />,
    description: 'Matter not fully opened in system'
  },
  conflicts: {
    label: 'Conflicts Pending',
    icon: <AlertTriangle className="h-4 w-4" />,
    description: 'Conflicts check not completed'
  },
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

export default function Flags() {
  const { matters, isLoading } = useMatters();

  // Only check Live and Pipeline matters
  const activeMatters = matters.filter(m => m.category === 'Live' || m.category === 'Pipeline');
  const today = new Date();

  // Build flagged matters list
  const flaggedMatters: FlaggedMatter[] = activeMatters
    .map(matter => {
      const flags: FlagType[] = [];
      let rfpDaysInfo: string | undefined;
      
      // Admin flags
      if (!matter.assignment_letter_signed) flags.push('engagement_letter');
      if (!matter.aml_kyc_complete) flags.push('aml_kyc');
      if (!matter.matter_open) flags.push('matter_open');
      if (!matter.conflicts_check) flags.push('conflicts');
      
      // Pipeline deadline flags
      if (matter.category === 'Pipeline' && matter.submission_deadline) {
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
        matter_number: matter.cm_number || matter.matter_number,
        client_name: matter.clients?.name || '',
        category: matter.category,
        flags,
        rfpDaysInfo,
      };
    })
    .filter(m => m.flags.length > 0)
    .sort((a, b) => {
      // Prioritize RFP flags
      const aHasRfp = a.flags.includes('rfp_upcoming') || a.flags.includes('rfp_overdue');
      const bHasRfp = b.flags.includes('rfp_upcoming') || b.flags.includes('rfp_overdue');
      if (aHasRfp && !bHasRfp) return -1;
      if (!aHasRfp && bHasRfp) return 1;
      return b.flags.length - a.flags.length;
    });

  // Count by flag type
  const flagCounts: Record<FlagType, number> = {
    engagement_letter: 0,
    aml_kyc: 0,
    matter_open: 0,
    conflicts: 0,
    rfp_upcoming: 0,
    rfp_overdue: 0,
  };
  
  flaggedMatters.forEach(m => {
    m.flags.forEach(f => flagCounts[f]++);
  });

  const totalFlags = Object.values(flagCounts).reduce((a, b) => a + b, 0);
  const pipelineAlertCount = flagCounts.rfp_upcoming + flagCounts.rfp_overdue;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-3">
              <Flag className="h-7 w-7 text-warning" />
              Admin Flags
            </h1>
            <p className="text-muted-foreground mt-1">
              Track compliance items and pipeline deadlines that need attention
            </p>
          </div>
          {totalFlags === 0 && !isLoading && (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">All clear!</span>
            </div>
          )}
        </div>

        {/* Pipeline Alerts Section */}
        {pipelineAlertCount > 0 && (
          <Card className="shadow-card border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-amber-600" />
                Pipeline Deadlines
              </CardTitle>
              <CardDescription>
                {pipelineAlertCount} pipeline {pipelineAlertCount === 1 ? 'matter needs' : 'matters need'} attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/80">
                  <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{flagCounts.rfp_upcoming}</p>
                    <p className="text-xs text-muted-foreground">RFP deadline within 7 days</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/80">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{flagCounts.rfp_overdue}</p>
                    <p className="text-xs text-muted-foreground">Awaiting client decision</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['engagement_letter', 'aml_kyc', 'matter_open', 'conflicts'] as FlagType[]).map((key) => (
            <Card key={key} className={cn(
              "shadow-card transition-colors",
              flagCounts[key] > 0 ? "border-warning/50" : "border-success/30"
            )}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    flagCounts[key] > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                  )}>
                    {flagConfig[key].icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{flagCounts[key]}</p>
                    <p className="text-xs text-muted-foreground">{flagConfig[key].label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Flagged Matters Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Matters Requiring Attention</CardTitle>
            <CardDescription>
              {flaggedMatters.length} {flaggedMatters.length === 1 ? 'matter' : 'matters'} with outstanding items
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
                <h3 className="text-lg font-medium text-foreground">All items complete</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  No outstanding flags on any active matters
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[200px]">Matter</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Outstanding Items</TableHead>
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
                          <span className={cn(
                            "text-sm font-medium px-2 py-1 rounded",
                            matter.category === 'Live' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                            matter.category === 'Pipeline' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          )}>
                            {matter.category}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {matter.flags.map((flag) => (
                              <span
                                key={flag}
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border",
                                  flag === 'rfp_upcoming' && 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
                                  flag === 'rfp_overdue' && 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
                                  !['rfp_upcoming', 'rfp_overdue'].includes(flag) && 'bg-warning/10 text-warning border-warning/30'
                                )}
                              >
                                {flagConfig[flag].icon}
                                {flag === 'rfp_upcoming' || flag === 'rfp_overdue' 
                                  ? matter.rfpDaysInfo || flagConfig[flag].label
                                  : flagConfig[flag].label
                                }
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="shadow-card bg-muted/30">
          <CardContent className="pt-6">
            <h4 className="font-medium text-foreground mb-2">Tips for Clearing Flags</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Click the edit button on any matter to update its admin status</li>
              <li>• Pipeline matters show alerts 7 days before RFP response date</li>
              <li>• After RFP submission, you'll be reminded weekly to follow up with the client</li>
              <li>• Only Live and Pipeline matters are checked - Closed and Lost matters are excluded</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
