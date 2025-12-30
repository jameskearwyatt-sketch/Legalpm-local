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
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

type FlagType = 'engagement_letter' | 'aml_kyc' | 'matter_open' | 'conflicts';

interface FlaggedMatter {
  id: string;
  matter_name: string;
  matter_number: string;
  client_name: string;
  category: string;
  flags: FlagType[];
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
};

export default function Flags() {
  const { matters, isLoading } = useMatters();

  // Only check Live and Pipeline matters
  const activeMatters = matters.filter(m => m.category === 'Live' || m.category === 'Pipeline');

  // Build flagged matters list
  const flaggedMatters: FlaggedMatter[] = activeMatters
    .map(matter => {
      const flags: FlagType[] = [];
      
      if (!matter.assignment_letter_signed) flags.push('engagement_letter');
      if (!matter.aml_kyc_complete) flags.push('aml_kyc');
      if (!matter.matter_open) flags.push('matter_open');
      if (!matter.conflicts_check) flags.push('conflicts');
      
      return {
        id: matter.id,
        matter_name: matter.matter_name,
        matter_number: matter.matter_number,
        client_name: matter.clients?.name || '',
        category: matter.category,
        flags,
      };
    })
    .filter(m => m.flags.length > 0)
    .sort((a, b) => b.flags.length - a.flags.length);

  // Count by flag type
  const flagCounts: Record<FlagType, number> = {
    engagement_letter: 0,
    aml_kyc: 0,
    matter_open: 0,
    conflicts: 0,
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
              <Flag className="h-7 w-7 text-warning" />
              Admin Flags
            </h1>
            <p className="text-muted-foreground mt-1">
              Track compliance items that need attention
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(flagConfig) as [FlagType, typeof flagConfig[FlagType]][]).map(([key, config]) => (
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
                    {config.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{flagCounts[key]}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
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
              {flaggedMatters.length} {flaggedMatters.length === 1 ? 'matter' : 'matters'} with outstanding admin items
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
                <h3 className="text-lg font-medium text-foreground">All admin items complete</h3>
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
                            matter.category === 'Live' && 'bg-blue-100 text-blue-700',
                            matter.category === 'Pipeline' && 'bg-amber-100 text-amber-700'
                          )}>
                            {matter.category}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {matter.flags.map((flag) => (
                              <span
                                key={flag}
                                className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-warning/10 text-warning border border-warning/30"
                              >
                                {flagConfig[flag].icon}
                                {flagConfig[flag].label}
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
              <li>• Engagement letters, AML/KYC, and matter open status are in the "Compliance & Admin" section of the matter form</li>
              <li>• Only Live and Pipeline matters are checked - Closed and Lost matters are excluded</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
