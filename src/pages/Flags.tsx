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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMatters } from '@/lib/hooks/useMatters';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { 
  Flag, 
  FileSignature, 
  Shield, 
  FolderOpen, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  X,
  Calculator,
  FileText,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

type FlagType = 'engagement_letter' | 'aml_kyc' | 'matter_open' | 'conflicts' | 'no_budget_finalized' | 'no_assumptions' | 'no_start_date';

interface FlaggedMatter {
  id: string;
  matter_name: string;
  matter_number: string;
  client_name: string;
  category: string;
  flags: FlagType[];
}

const flagConfig: Record<FlagType, { label: string; icon: React.ReactNode; description: string; field: string | null }> = {
  engagement_letter: {
    label: 'No Engagement Letter',
    icon: <FileSignature className="h-4 w-4" />,
    description: 'Assignment letter not signed',
    field: 'assignment_letter_signed'
  },
  aml_kyc: {
    label: 'Incomplete AML/KYC',
    icon: <Shield className="h-4 w-4" />,
    description: 'AML/KYC checks not complete',
    field: 'aml_kyc_complete'
  },
  matter_open: {
    label: 'Matter Not Open',
    icon: <FolderOpen className="h-4 w-4" />,
    description: 'Matter not fully opened in system',
    field: 'matter_open'
  },
  conflicts: {
    label: 'Conflicts Pending',
    icon: <AlertTriangle className="h-4 w-4" />,
    description: 'Conflicts check not completed',
    field: 'conflicts_check'
  },
  no_budget_finalized: {
    label: 'No Budget Finalized',
    icon: <Calculator className="h-4 w-4" />,
    description: 'No detailed budget version finalized',
    field: null
  },
  no_assumptions: {
    label: 'No Assumptions',
    icon: <FileText className="h-4 w-4" />,
    description: 'No assumptions logged for this matter',
    field: null
  },
  no_start_date: {
    label: 'No Start Date',
    icon: <Calendar className="h-4 w-4" />,
    description: 'No start date logged for this matter',
    field: 'start_date'
  },
};

export default function Flags() {
  const { matters, isLoading, updateMatter } = useMatters();
  const { user } = useAuth();
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    matterId: string;
    matterName: string;
    flagType: FlagType;
  } | null>(null);

  // Only check Live matters for admin flags
  const liveMatters = matters.filter(m => m.category === 'Live');
  const liveMatterIds = liveMatters.map(m => m.id);

  // Fetch budget versions for live matters
  const { data: budgetVersions } = useQuery({
    queryKey: ['budget-versions-for-flags', liveMatterIds],
    queryFn: async () => {
      if (liveMatterIds.length === 0) return [];
      const { data, error } = await supabase
        .from('budget_versions')
        .select('matter_id')
        .in('matter_id', liveMatterIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && liveMatterIds.length > 0,
  });

  // Fetch assumptions for live matters
  const { data: assumptions } = useQuery({
    queryKey: ['assumptions-for-flags', liveMatterIds],
    queryFn: async () => {
      if (liveMatterIds.length === 0) return [];
      const { data, error } = await supabase
        .from('matter_assumptions')
        .select('matter_id')
        .in('matter_id', liveMatterIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && liveMatterIds.length > 0,
  });

  // Build sets for quick lookup
  const mattersWithBudget = new Set(budgetVersions?.map(bv => bv.matter_id) || []);
  const mattersWithAssumptions = new Set(assumptions?.map(a => a.matter_id) || []);

  const handleClearFlag = async () => {
    if (!confirmDialog) return;
    
    const { matterId, flagType, matterName } = confirmDialog;
    const fieldToUpdate = flagConfig[flagType].field;
    
    // Can't clear flags that don't have a direct field to update
    if (!fieldToUpdate) {
      toast({
        title: "Cannot clear this flag directly",
        description: "This flag requires adding data (budget, assumptions, or start date) via the matter details page.",
        variant: "destructive",
      });
      setConfirmDialog(null);
      return;
    }
    
    try {
      await updateMatter.mutateAsync({
        id: matterId,
        [fieldToUpdate]: fieldToUpdate === 'start_date' ? new Date().toISOString().split('T')[0] : true
      });
      
      toast({
        title: "Flag cleared",
        description: `${flagConfig[flagType].label} cleared for ${matterName}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear flag. Please try again.",
        variant: "destructive",
      });
    }
    
    setConfirmDialog(null);
  };

  // Build flagged matters list (admin flags only)
  const flaggedMatters: FlaggedMatter[] = liveMatters
    .map(matter => {
      const flags: FlagType[] = [];
      
      // Admin flags only
      if (!matter.assignment_letter_signed) flags.push('engagement_letter');
      if (!matter.aml_kyc_complete) flags.push('aml_kyc');
      if (!matter.matter_open) flags.push('matter_open');
      if (!matter.conflicts_check) flags.push('conflicts');
      
      // New flags
      if (!mattersWithBudget.has(matter.id)) flags.push('no_budget_finalized');
      if (!mattersWithAssumptions.has(matter.id)) flags.push('no_assumptions');
      if (!matter.start_date) flags.push('no_start_date');
      
      return {
        id: matter.id,
        matter_name: matter.matter_name,
        matter_number: matter.cm_number && matter.cm_number.trim() !== '' 
          ? matter.cm_number 
          : '[CM number required]',
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
    no_budget_finalized: 0,
    no_assumptions: 0,
    no_start_date: 0,
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
              Track compliance items for live matters
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {(['engagement_letter', 'aml_kyc', 'matter_open', 'conflicts', 'no_budget_finalized', 'no_assumptions', 'no_start_date'] as FlagType[]).map((key) => (
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
                <h3 className="text-lg font-medium text-foreground">All items complete</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  No outstanding admin flags on any active matters
                </p>
              </div>
            ) : (
              <TableScrollControls>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[200px]">Matter</TableHead>
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
                          <div className="flex flex-wrap gap-2">
                            {matter.flags.map((flag) => (
                              <span
                                key={flag}
                                className="inline-flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-full border bg-warning/10 text-warning border-warning/30 group/flag relative"
                              >
                                {flagConfig[flag].icon}
                                {flagConfig[flag].label}
                                <TooltipProvider delayDuration={100}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => setConfirmDialog({
                                          open: true,
                                          matterId: matter.id,
                                          matterName: matter.matter_name,
                                          flagType: flag
                                        })}
                                        className="ml-1 p-0.5 rounded-full hover:bg-warning/30 transition-colors"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>Clear</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
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
            <h4 className="font-medium text-foreground mb-2">Tips for Clearing Admin Flags</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Click the edit button on any matter to update its admin status</li>
              <li>• Ensure engagement letters are signed before work begins</li>
              <li>• Complete AML/KYC checks as required by firm policy</li>
              <li>• Only Live matters are checked - Pipeline, Closed and Lost matters are excluded</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this flag?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear "{confirmDialog && flagConfig[confirmDialog.flagType].label}" for{' '}
              <span className="font-medium text-foreground">{confirmDialog?.matterName}</span>?
              <br /><br />
              This will update the matter record to mark this item as complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearFlag}>
              Clear Flag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
