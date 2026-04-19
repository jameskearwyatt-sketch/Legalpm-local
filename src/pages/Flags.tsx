import { Link } from 'react-router-dom';
import { useState, useRef, useMemo, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableScrollControls } from '@/components/ui/table-scroll-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useDashboard, Alert, PipelineAlert } from '@/lib/hooks/useDashboard';
import { useMatters } from '@/lib/hooks/useMatters';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getClientDisplayName } from '@/lib/clientUtils';
import { JurisdictionsMultiSelect } from '@/components/matters/JurisdictionsMultiSelect';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Flag,
  AlertTriangle,
  Clock,
  CalendarClock,
  CheckCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  DollarSign,
  TrendingDown,
  CalendarX,
  ExternalLink,
  X,
  Calculator,
  FileText,
  FileSignature,
  Shield,
  FolderOpen,
  Calendar as CalendarIcon,
  Users,
  Hash,
  UserX,
  Briefcase,
  Check,
  Globe,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Financial tab (ported from RedFlags.tsx)
// ---------------------------------------------------------------------------

const alertTypeConfig: Record<Alert['type'], { icon: React.ReactNode; color: string }> = {
  'Over Budget': { icon: <DollarSign className="h-4 w-4" />, color: 'text-destructive' },
  'Near Budget': { icon: <TrendingDown className="h-4 w-4" />, color: 'text-warning' },
  'High WIP': { icon: <Clock className="h-4 w-4" />, color: 'text-warning' },
  'Poor Collection': { icon: <TrendingDown className="h-4 w-4" />, color: 'text-warning' },
  'Stale Financials': { icon: <CalendarX className="h-4 w-4" />, color: 'text-warning' },
  'Stale LC Financials': { icon: <CalendarX className="h-4 w-4" />, color: 'text-warning' },
};

const alertTypeOrder: Alert['type'][] = [
  'Over Budget',
  'Near Budget',
  'Poor Collection',
  'High WIP',
  'Stale Financials',
  'Stale LC Financials',
];

function FinancialFlagsTab({ alerts, isLoading }: { alerts: Alert[]; isLoading: boolean }) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToSection = (type: Alert['type']) => {
    const ref = sectionRefs.current[type];
    if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const alertsByType = alerts.reduce((acc, alert) => {
    if (!acc[alert.type]) acc[alert.type] = [];
    acc[alert.type].push(alert);
    return acc;
  }, {} as Record<Alert['type'], Alert[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle className="h-16 w-16 text-success mb-4" />
          <h2 className="text-xl font-heading font-semibold text-foreground mb-2">All Clear!</h2>
          <p className="text-muted-foreground max-w-md">
            There are no financial red flags across your live matters. All budgets, collections, and invoices are in good standing.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {alertTypeOrder.map((type) => {
          const count = alertsByType[type]?.length || 0;
          const config = alertTypeConfig[type];
          return (
            <Card
              key={type}
              className={cn(
                'shadow-card cursor-pointer transition-all hover:shadow-md',
                count > 0 && 'border-l-4 border-l-warning'
              )}
              onClick={() => count > 0 && scrollToSection(type)}
            >
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

      {alertTypeOrder.map((type) => {
        const typedAlerts = alertsByType[type];
        if (!typedAlerts || typedAlerts.length === 0) return null;
        const config = alertTypeConfig[type];
        return (
          <Card
            key={type}
            className="shadow-card"
            ref={(el) => {
              sectionRefs.current[type] = el;
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <span className={config.color}>{config.icon}</span>
                {type}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {typedAlerts.length} matter{typedAlerts.length !== 1 ? 's' : ''}
              </span>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {typedAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    to={`/matters/${alert.matterId}`}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={alert.type} />
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{alert.matterName}</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.clientName} • {alert.cmNumber}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
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
  );
}

// ---------------------------------------------------------------------------
// Pipeline tab (ported from PipelineFlags.tsx, consumes useDashboard data)
// ---------------------------------------------------------------------------

const pipelineStyleByType: Record<
  PipelineAlert['type'],
  { cardBorder: string; bgAccent: string; textAccent: string; badge: string; icon: React.ReactNode }
> = {
  'RFP Deadline Soon': {
    cardBorder: 'border-orange-300 dark:border-orange-700',
    bgAccent: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    textAccent: 'text-orange-600',
    badge:
      'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
    icon: <Clock className="h-4 w-4" />,
  },
  'Awaiting Decision': {
    cardBorder: 'border-purple-300 dark:border-purple-700',
    bgAccent: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    textAccent: 'text-purple-600',
    badge:
      'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
    icon: <CalendarClock className="h-4 w-4" />,
  },
};

function PipelineFlagsTab({
  pipelineAlerts,
  isLoading,
}: {
  pipelineAlerts: PipelineAlert[];
  isLoading: boolean;
}) {
  const tableRef = useRef<HTMLDivElement | null>(null);
  const scrollToTable = () => {
    if (tableRef.current) tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const counts: Record<PipelineAlert['type'], number> = {
    'RFP Deadline Soon': 0,
    'Awaiting Decision': 0,
  };
  pipelineAlerts.forEach((a) => {
    counts[a.type] = (counts[a.type] || 0) + 1;
  });

  const totalFlags = pipelineAlerts.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {(['RFP Deadline Soon', 'Awaiting Decision'] as PipelineAlert['type'][]).map((type) => {
          const count = counts[type] || 0;
          const style = pipelineStyleByType[type];
          return (
            <Card
              key={type}
              className={cn(
                'shadow-card transition-all cursor-pointer hover:shadow-md',
                count > 0 ? style.cardBorder : 'border-success/30'
              )}
              onClick={() => count > 0 && scrollToTable()}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', count > 0 ? style.bgAccent : 'bg-success/10 text-success')}>
                    {style.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{type}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-card" ref={tableRef}>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Pipeline Matters Requiring Attention</CardTitle>
          <CardDescription>
            {totalFlags} {totalFlags === 1 ? 'matter' : 'matters'} with upcoming deadlines or pending decisions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : totalFlags === 0 ? (
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
                  {pipelineAlerts.map((alert) => {
                    const style = pipelineStyleByType[alert.type];
                    return (
                      <TableRow key={alert.id} className="group">
                        <TableCell>
                          <p className="text-sm text-muted-foreground">{alert.clientName}</p>
                          <p className="font-medium text-foreground">{alert.matterName}</p>
                          <p className="text-xs text-muted-foreground">{alert.cmNumber}</p>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border',
                              style.badge
                            )}
                          >
                            {style.icon}
                            {alert.message || alert.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/matters/${alert.matterId}/edit`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableScrollControls>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium text-foreground mb-2">Pipeline Tracking Tips</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Matters show alerts 7 days before RFP submission deadline</li>
            <li>After submission, you&apos;ll be reminded weekly to follow up with the client</li>
            <li>Update the pipeline outcome to Won, Lost, or Pending to track progress</li>
            <li>Click the edit button to update submission status or outcome</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compliance tab (ported from old Admin Flags page)
// ---------------------------------------------------------------------------

type ComplianceFlagType =
  | 'engagement_letter'
  | 'aml_kyc'
  | 'matter_open'
  | 'conflicts'
  | 'no_budget_finalized'
  | 'no_assumptions'
  | 'no_start_date'
  | 'invalid_client_split'
  | 'no_cm_number'
  | 'no_mma'
  | 'no_billing_partner'
  | 'no_lc_billing'
  | 'no_jurisdictions';

interface ComplianceFlaggedMatter {
  id: string;
  matter_name: string;
  matter_number: string;
  client_name: string;
  client_display_name: string | null;
  category: string;
  flags: ComplianceFlagType[];
}

const complianceFlagConfig: Record<
  ComplianceFlagType,
  { label: string; icon: React.ReactNode; description: string; field: string | null }
> = {
  engagement_letter: { label: 'No Engagement Letter', icon: <FileSignature className="h-4 w-4" />, description: 'Assignment letter not signed', field: 'assignment_letter_signed' },
  aml_kyc: { label: 'Incomplete AML/KYC', icon: <Shield className="h-4 w-4" />, description: 'AML/KYC checks not complete', field: 'aml_kyc_complete' },
  matter_open: { label: 'Matter Not Open', icon: <FolderOpen className="h-4 w-4" />, description: 'Matter not fully opened in system', field: 'matter_open' },
  conflicts: { label: 'Conflicts Pending', icon: <AlertTriangle className="h-4 w-4" />, description: 'Conflicts check not completed', field: 'conflicts_check' },
  no_budget_finalized: { label: 'No Budget Finalized', icon: <Calculator className="h-4 w-4" />, description: 'No detailed budget version finalized', field: null },
  no_assumptions: { label: 'No Assumptions', icon: <FileText className="h-4 w-4" />, description: 'No assumptions logged for this matter', field: null },
  no_start_date: { label: 'No Start Date', icon: <CalendarIcon className="h-4 w-4" />, description: 'No start date logged for this matter', field: 'start_date' },
  invalid_client_split: { label: 'Invalid Client Split', icon: <Users className="h-4 w-4" />, description: "Multi-client fee percentages missing or don't total 100%", field: null },
  no_cm_number: { label: 'No CM Number', icon: <Hash className="h-4 w-4" />, description: 'Client matter number not set', field: null },
  no_mma: { label: 'MMA Not Specified', icon: <UserX className="h-4 w-4" />, description: 'Matter Managing Attorney not specified', field: 'matter_managing_attorney' },
  no_billing_partner: { label: 'Billing Partner Not Specified', icon: <Briefcase className="h-4 w-4" />, description: 'Billing partner not specified for this matter', field: 'lead_partner' },
  no_lc_billing: { label: 'Local Counsel Billing Missing', icon: <AlertTriangle className="h-4 w-4" />, description: 'Local counsel fee exists but billing method not specified', field: 'local_counsel_billing' },
  no_jurisdictions: { label: 'No Jurisdictions', icon: <Globe className="h-4 w-4" />, description: 'No jurisdictions specified for this matter', field: null },
};

const complianceFlagTypeOrder: ComplianceFlagType[] = [
  'engagement_letter', 'aml_kyc', 'matter_open', 'conflicts', 'no_cm_number',
  'no_mma', 'no_billing_partner', 'no_lc_billing', 'no_budget_finalized',
  'no_assumptions', 'no_start_date', 'invalid_client_split', 'no_jurisdictions',
];

function PersonInlineEditor({
  matterId, matterName, fieldName, userName, onUpdate,
}: {
  matterId: string; matterName: string;
  fieldName: 'matter_managing_attorney' | 'lead_partner';
  userName: string | null;
  onUpdate: (id: string, data: any) => Promise<void>;
}) {
  const [isMe, setIsMe] = useState(false);
  const [customName, setCustomName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const label = fieldName === 'matter_managing_attorney' ? 'MMA' : 'Billing Partner';

  const handleMeChange = async (checked: boolean) => {
    if (checked && userName) {
      setIsMe(true);
      setCustomName('');
      setIsSaving(true);
      try {
        await onUpdate(matterId, { [fieldName]: userName });
        toast({ title: 'Updated', description: `${label} set to ${userName} for ${matterName}` });
      } catch {
        toast({ title: 'Error', description: 'Failed to update. Please try again.', variant: 'destructive' });
        setIsMe(false);
      } finally { setIsSaving(false); }
    } else {
      setIsMe(false);
      setCustomName('');
      setIsSaving(true);
      try {
        await onUpdate(matterId, { [fieldName]: '' });
        toast({ title: 'Updated', description: `${label} cleared for ${matterName}` });
      } catch {
        toast({ title: 'Error', description: 'Failed to update. Please try again.', variant: 'destructive' });
      } finally { setIsSaving(false); }
    }
  };

  const handleCustomNameSave = async () => {
    if (!customName.trim()) return;
    setIsSaving(true);
    try {
      await onUpdate(matterId, { [fieldName]: customName.trim() });
      toast({ title: 'Updated', description: `${label} set to ${customName.trim()} for ${matterName}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to update. Please try again.', variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  return (
    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <Checkbox id={`me-${matterId}-${fieldName}`} checked={isMe} onCheckedChange={handleMeChange} disabled={isSaving || !userName} />
        <label htmlFor={`me-${matterId}-${fieldName}`} className="text-xs text-muted-foreground cursor-pointer">Me</label>
      </div>
      <div className="flex items-center gap-1">
        <Input placeholder="Name..." value={customName} onChange={(e) => setCustomName(e.target.value)} className="h-7 w-24 text-xs" disabled={isSaving || isMe}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCustomNameSave(); } }} />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={isSaving || isMe || !customName.trim()} onClick={handleCustomNameSave}>
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

function JurisdictionsInlineEditor({
  matterId, matterName, currentJurisdictions, onUpdate,
}: {
  matterId: string; matterName: string; currentJurisdictions: string[];
  onUpdate: (id: string, data: any) => Promise<void>;
}) {
  const [jurisdictions, setJurisdictions] = useState<string[]>(currentJurisdictions);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const handleChange = (v: string[]) => { setJurisdictions(v); setHasChanges(true); };
  const handleSave = async () => {
    if (jurisdictions.length === 0) return;
    setIsSaving(true);
    try {
      await onUpdate(matterId, { jurisdictions });
      toast({ title: 'Updated', description: `Jurisdictions set for ${matterName}` });
      setHasChanges(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to update. Please try again.', variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  return (
    <div className="flex items-center gap-2 flex-shrink-0 min-w-[280px]" onClick={(e) => e.stopPropagation()}>
      <div className="flex-1">
        <JurisdictionsMultiSelect value={jurisdictions} onChange={handleChange} placeholder="Add jurisdictions..." className="w-full" />
      </div>
      {hasChanges && jurisdictions.length > 0 && (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0" disabled={isSaving} onClick={handleSave}>
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}

function DateInlineEditor({
  matterId, matterName, onUpdate,
}: {
  matterId: string; matterName: string;
  onUpdate: (id: string, data: any) => Promise<void>;
}) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleDateSelect = async (selectedDate: Date | undefined) => {
    if (!selectedDate) return;
    setDate(selectedDate);
    setIsSaving(true);
    try {
      await onUpdate(matterId, { start_date: format(selectedDate, 'yyyy-MM-dd') });
      toast({ title: 'Updated', description: `Start date set to ${format(selectedDate, 'PP')} for ${matterName}` });
      setOpen(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to update. Please try again.', variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  return (
    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarIcon className="h-3 w-3" />}
            Set Date
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="single" selected={date} onSelect={handleDateSelect} initialFocus className="pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ComplianceFlagsTab() {
  const { matters, isLoading, updateMatter } = useMatters();
  const { user } = useAuth();
  const { toast } = useToast();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; matterId: string; matterName: string; flagType: ComplianceFlagType;
  } | null>(null);

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const liveMatters = matters.filter((m) => m.category === 'Live');
  const liveMatterIds = liveMatters.map((m) => m.id);

  const { data: budgetVersions } = useQuery({
    queryKey: ['budget-versions-for-flags', liveMatterIds],
    queryFn: async () => {
      if (liveMatterIds.length === 0) return [];
      const { data, error } = await supabase.from('budget_versions').select('matter_id').in('matter_id', liveMatterIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && liveMatterIds.length > 0,
  });

  const { data: assumptions } = useQuery({
    queryKey: ['assumptions-for-flags', liveMatterIds],
    queryFn: async () => {
      if (liveMatterIds.length === 0) return [];
      const { data, error } = await supabase.from('matter_assumptions').select('matter_id').in('matter_id', liveMatterIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && liveMatterIds.length > 0,
  });

  const multiClientMatterIds = liveMatters.filter((m) => m.is_multi_client).map((m) => m.id);
  const { data: matterClients } = useQuery({
    queryKey: ['matter-clients-for-flags', multiClientMatterIds],
    queryFn: async () => {
      if (multiClientMatterIds.length === 0) return [];
      const { data, error } = await supabase.from('matter_clients').select('matter_id, fee_percentage').in('matter_id', multiClientMatterIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && multiClientMatterIds.length > 0,
  });

  const mattersWithBudget = new Set(budgetVersions?.map((bv) => bv.matter_id) || []);
  const mattersWithAssumptions = new Set(assumptions?.map((a) => a.matter_id) || []);

  const mattersWithInvalidSplit = new Set<string>();
  if (matterClients) {
    const splitsByMatter = new Map<string, number>();
    matterClients.forEach((mc) => {
      const current = splitsByMatter.get(mc.matter_id) || 0;
      splitsByMatter.set(mc.matter_id, current + Number(mc.fee_percentage));
    });
    multiClientMatterIds.forEach((matterId) => {
      const total = splitsByMatter.get(matterId) || 0;
      if (Math.abs(total - 100) > 0.01) mattersWithInvalidSplit.add(matterId);
    });
  }

  const scrollToSection = (type: ComplianceFlagType) => {
    const ref = sectionRefs.current[type];
    if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleClearFlag = async () => {
    if (!confirmDialog) return;
    const { matterId, flagType, matterName } = confirmDialog;
    const fieldToUpdate = complianceFlagConfig[flagType].field;
    if (!fieldToUpdate) {
      toast({ title: 'Cannot clear this flag directly', description: 'This flag requires adding data via the matter details page.', variant: 'destructive' });
      setConfirmDialog(null);
      return;
    }
    try {
      await updateMatter.mutateAsync({ id: matterId, [fieldToUpdate]: true });
      toast({ title: 'Flag cleared', description: `${complianceFlagConfig[flagType].label} cleared for ${matterName}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to clear flag. Please try again.', variant: 'destructive' });
    }
    setConfirmDialog(null);
  };

  const handleInlineUpdate = async (matterId: string, data: any) => {
    await updateMatter.mutateAsync({ id: matterId, ...data });
  };

  const flaggedMatters: ComplianceFlaggedMatter[] = liveMatters
    .map((matter) => {
      const flags: ComplianceFlagType[] = [];
      if (!matter.assignment_letter_signed) flags.push('engagement_letter');
      if (!matter.aml_kyc_complete) flags.push('aml_kyc');
      if (!matter.matter_open) flags.push('matter_open');
      if (!matter.conflicts_check) flags.push('conflicts');
      if (!mattersWithBudget.has(matter.id)) flags.push('no_budget_finalized');
      if (!mattersWithAssumptions.has(matter.id)) flags.push('no_assumptions');
      if (!matter.start_date) flags.push('no_start_date');
      if (matter.is_multi_client && mattersWithInvalidSplit.has(matter.id)) flags.push('invalid_client_split');
      if (!matter.cm_number || matter.cm_number.trim() === '') flags.push('no_cm_number');
      if (!matter.matter_managing_attorney || matter.matter_managing_attorney.trim() === '') flags.push('no_mma');
      if (!matter.lead_partner || matter.lead_partner.trim() === '') flags.push('no_billing_partner');
      const localCounsels = matter.local_counsels || [];
      const localCounselFee = Number(matter.local_counsel_fee) || 0;
      const hasLcWithMissingBilling = localCounsels.length > 0
        ? localCounsels.some((lc) => !lc.billing_mode)
        : localCounselFee > 0;
      if (hasLcWithMissingBilling) flags.push('no_lc_billing');
      const jurisdictions = matter.jurisdictions || [];
      if (!jurisdictions || jurisdictions.length === 0) flags.push('no_jurisdictions');
      return {
        id: matter.id,
        matter_name: matter.matter_name,
        matter_number: matter.cm_number && matter.cm_number.trim() !== '' ? matter.cm_number : '[CM number required]',
        client_name: matter.clients?.name || '',
        client_display_name: matter.clients?.display_name || null,
        category: matter.category,
        flags,
      };
    })
    .filter((m) => m.flags.length > 0);

  const mattersByFlagType: Record<ComplianceFlagType, ComplianceFlaggedMatter[]> = {} as Record<ComplianceFlagType, ComplianceFlaggedMatter[]>;
  complianceFlagTypeOrder.forEach((type) => {
    mattersByFlagType[type] = flaggedMatters.filter((m) => m.flags.includes(type));
  });

  const totalFlags = complianceFlagTypeOrder.reduce((sum, type) => sum + mattersByFlagType[type].length, 0);

  const hasInlineEditor = (type: ComplianceFlagType) =>
    type === 'no_mma' || type === 'no_billing_partner' || type === 'no_start_date' || type === 'no_jurisdictions';

  const renderInlineEditor = (type: ComplianceFlagType, matter: ComplianceFlaggedMatter) => {
    if (type === 'no_mma') return <PersonInlineEditor matterId={matter.id} matterName={matter.matter_name} fieldName="matter_managing_attorney" userName={userProfile?.full_name || null} onUpdate={handleInlineUpdate} />;
    if (type === 'no_billing_partner') return <PersonInlineEditor matterId={matter.id} matterName={matter.matter_name} fieldName="lead_partner" userName={userProfile?.full_name || null} onUpdate={handleInlineUpdate} />;
    if (type === 'no_start_date') return <DateInlineEditor matterId={matter.id} matterName={matter.matter_name} onUpdate={handleInlineUpdate} />;
    if (type === 'no_jurisdictions') {
      const matterData = liveMatters.find((m) => m.id === matter.id);
      return <JurisdictionsInlineEditor matterId={matter.id} matterName={matter.matter_name} currentJurisdictions={matterData?.jurisdictions || []} onUpdate={handleInlineUpdate} />;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (totalFlags === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-16 w-16 text-success mb-4" />
          <h2 className="text-xl font-heading font-semibold text-foreground mb-2">All Clear!</h2>
          <p className="text-muted-foreground max-w-md">
            There are no compliance flags across your live matters. All compliance items are complete.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {complianceFlagTypeOrder.map((type) => {
            const count = mattersByFlagType[type]?.length || 0;
            const config = complianceFlagConfig[type];
            return (
              <Card
                key={type}
                className={cn('shadow-card cursor-pointer transition-all hover:shadow-md', count > 0 && 'border-l-4 border-l-warning')}
                onClick={() => count > 0 && scrollToSection(type)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-warning">{config.icon}</span>
                    <span className="text-2xl font-bold text-foreground">{count}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {complianceFlagTypeOrder.map((type) => {
          const mattersWithFlag = mattersByFlagType[type];
          if (!mattersWithFlag || mattersWithFlag.length === 0) return null;
          const config = complianceFlagConfig[type];
          const canClear = config.field !== null && !hasInlineEditor(type);
          const showInlineEditor = hasInlineEditor(type);
          return (
            <Card key={type} className="shadow-card" ref={(el) => { sectionRefs.current[type] = el; }}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <span className="text-warning">{config.icon}</span>
                  {config.label}
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {mattersWithFlag.length} matter{mattersWithFlag.length !== 1 ? 's' : ''}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{config.description}</p>
                <div className="space-y-2">
                  {mattersWithFlag.map((matter) => (
                    <div key={matter.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                      <Link to={`/matters/${matter.id}`} className="flex-1 min-w-0 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{matter.matter_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getClientDisplayName({ name: matter.client_name, display_name: matter.client_display_name })} • {matter.matter_number}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                      </Link>
                      {showInlineEditor && renderInlineEditor(type, matter)}
                      {canClear && (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setConfirmDialog({ open: true, matterId: matter.id, matterName: matter.matter_name, flagType: type })}
                                className="p-1.5 rounded-full hover:bg-warning/20 text-warning transition-colors flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>Clear flag</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this flag?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear &quot;{confirmDialog && complianceFlagConfig[confirmDialog.flagType].label}&quot; for{' '}
              <span className="font-medium text-foreground">{confirmDialog?.matterName}</span>?
              <br /><br />
              This will update the matter record to mark this item as complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearFlag}>Clear Flag</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Flags() {
  const { data: stats, isLoading: dashboardLoading } = useDashboard();
  const financialCount = stats?.alerts?.length || 0;
  const pipelineCount = stats?.pipelineAlerts?.length || 0;

  const defaultTab = useMemo(() => {
    if (pipelineCount > financialCount) return 'pipeline';
    return 'financial';
  }, [financialCount, pipelineCount]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2 sm:gap-3">
            <Flag className="h-8 w-8 text-warning" />
            Flags
          </h1>
          <p className="text-muted-foreground mt-1">
            Review financial, pipeline, and compliance flags across your matters
          </p>
        </div>
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="financial">Financial ({financialCount})</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline ({pipelineCount})</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>
          <TabsContent value="financial">
            <FinancialFlagsTab alerts={stats?.alerts || []} isLoading={dashboardLoading} />
          </TabsContent>
          <TabsContent value="pipeline">
            <PipelineFlagsTab pipelineAlerts={stats?.pipelineAlerts || []} isLoading={dashboardLoading} />
          </TabsContent>
          <TabsContent value="compliance">
            <ComplianceFlagsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
