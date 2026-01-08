import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClientDisplayName } from '@/lib/clientUtils';
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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useMatters } from '@/lib/hooks/useMatters';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { format, differenceInDays, parseISO } from 'date-fns';
import { 
  Flag, 
  FileSignature, 
  Shield, 
  FolderOpen, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  X,
  Calculator,
  FileText,
  Calendar as CalendarIcon,
  Users,
  Hash,
  UserX,
  Briefcase,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

type FlagType = 'engagement_letter' | 'aml_kyc' | 'matter_open' | 'conflicts' | 'no_budget_finalized' | 'no_assumptions' | 'no_start_date' | 'invalid_client_split' | 'no_cm_number' | 'no_mma' | 'no_billing_partner' | 'no_lc_billing';

interface FlaggedMatter {
  id: string;
  matter_name: string;
  matter_number: string;
  client_name: string;
  client_display_name: string | null;
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
    icon: <CalendarIcon className="h-4 w-4" />,
    description: 'No start date logged for this matter',
    field: 'start_date'
  },
  invalid_client_split: {
    label: 'Invalid Client Split',
    icon: <Users className="h-4 w-4" />,
    description: 'Multi-client fee percentages missing or don\'t total 100%',
    field: null
  },
  no_cm_number: {
    label: 'No CM Number',
    icon: <Hash className="h-4 w-4" />,
    description: 'Client matter number not set',
    field: null
  },
  no_mma: {
    label: 'MMA Not Specified',
    icon: <UserX className="h-4 w-4" />,
    description: 'Matter Managing Attorney not specified',
    field: 'matter_managing_attorney'
  },
  no_billing_partner: {
    label: 'Billing Partner Not Specified',
    icon: <Briefcase className="h-4 w-4" />,
    description: 'Billing partner not specified for this matter',
    field: 'lead_partner'
  },
  no_lc_billing: {
    label: 'Local Counsel Billing Missing',
    icon: <AlertTriangle className="h-4 w-4" />,
    description: 'Local counsel fee exists but billing method not specified',
    field: 'local_counsel_billing'
  },
};

const flagTypeOrder: FlagType[] = [
  'engagement_letter', 
  'aml_kyc', 
  'matter_open', 
  'conflicts', 
  'no_cm_number',
  'no_mma',
  'no_billing_partner',
  'no_lc_billing',
  'no_budget_finalized', 
  'no_assumptions', 
  'no_start_date', 
  'invalid_client_split'
];

// Inline editor component for MMA and Billing Partner flags
function PersonInlineEditor({ 
  matterId, 
  matterName,
  fieldName,
  userName,
  onUpdate 
}: { 
  matterId: string; 
  matterName: string;
  fieldName: 'matter_managing_attorney' | 'lead_partner';
  userName: string | null;
  onUpdate: (id: string, data: any) => Promise<void>;
}) {
  const [isMe, setIsMe] = useState(false);
  const [customName, setCustomName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleMeChange = async (checked: boolean) => {
    if (checked && userName) {
      setIsMe(true);
      setCustomName('');
      setIsSaving(true);
      try {
        await onUpdate(matterId, { [fieldName]: userName });
        toast({
          title: "Updated",
          description: `${fieldName === 'matter_managing_attorney' ? 'MMA' : 'Billing Partner'} set to ${userName} for ${matterName}`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update. Please try again.",
          variant: "destructive",
        });
        setIsMe(false);
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsMe(false);
      setCustomName('');
      setIsSaving(true);
      try {
        await onUpdate(matterId, { [fieldName]: '' });
        toast({
          title: "Updated",
          description: `${fieldName === 'matter_managing_attorney' ? 'MMA' : 'Billing Partner'} cleared for ${matterName}`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleCustomNameSave = async () => {
    if (!customName.trim()) return;
    setIsSaving(true);
    try {
      await onUpdate(matterId, { [fieldName]: customName.trim() });
      toast({
        title: "Updated",
        description: `${fieldName === 'matter_managing_attorney' ? 'MMA' : 'Billing Partner'} set to ${customName.trim()} for ${matterName}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <Checkbox 
          id={`me-${matterId}-${fieldName}`}
          checked={isMe}
          onCheckedChange={handleMeChange}
          disabled={isSaving || !userName}
        />
        <label 
          htmlFor={`me-${matterId}-${fieldName}`} 
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Me
        </label>
      </div>
      <div className="flex items-center gap-1">
        <Input
          placeholder="Name..."
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          className="h-7 w-24 text-xs"
          disabled={isSaving || isMe}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCustomNameSave();
            }
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          disabled={isSaving || isMe || !customName.trim()}
          onClick={handleCustomNameSave}
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

// Inline date picker for start date flag
function DateInlineEditor({ 
  matterId, 
  matterName,
  onUpdate 
}: { 
  matterId: string; 
  matterName: string;
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
      toast({
        title: "Updated",
        description: `Start date set to ${format(selectedDate, 'PP')} for ${matterName}`,
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CalendarIcon className="h-3 w-3" />
            )}
            Set Date
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function Flags() {
  const { matters, isLoading, updateMatter } = useMatters();
  const { user } = useAuth();
  const { toast } = useToast();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    matterId: string;
    matterName: string;
    flagType: FlagType;
  } | null>(null);

  // Fetch current user's profile for the "Me" checkbox
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const scrollToSection = (type: FlagType) => {
    const ref = sectionRefs.current[type];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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

  // Fetch matter_clients for multi-client matters
  const multiClientMatterIds = liveMatters.filter(m => m.is_multi_client).map(m => m.id);
  const { data: matterClients } = useQuery({
    queryKey: ['matter-clients-for-flags', multiClientMatterIds],
    queryFn: async () => {
      if (multiClientMatterIds.length === 0) return [];
      const { data, error } = await supabase
        .from('matter_clients')
        .select('matter_id, fee_percentage')
        .in('matter_id', multiClientMatterIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && multiClientMatterIds.length > 0,
  });

  // Build sets for quick lookup
  const mattersWithBudget = new Set(budgetVersions?.map(bv => bv.matter_id) || []);
  const mattersWithAssumptions = new Set(assumptions?.map(a => a.matter_id) || []);
  
  // Calculate which multi-client matters have invalid splits
  const mattersWithInvalidSplit = new Set<string>();
  if (matterClients) {
    const splitsByMatter = new Map<string, number>();
    matterClients.forEach(mc => {
      const current = splitsByMatter.get(mc.matter_id) || 0;
      splitsByMatter.set(mc.matter_id, current + Number(mc.fee_percentage));
    });
    multiClientMatterIds.forEach(matterId => {
      const total = splitsByMatter.get(matterId) || 0;
      if (Math.abs(total - 100) > 0.01) {
        mattersWithInvalidSplit.add(matterId);
      }
    });
  }

  const handleClearFlag = async () => {
    if (!confirmDialog) return;
    
    const { matterId, flagType, matterName } = confirmDialog;
    const fieldToUpdate = flagConfig[flagType].field;
    
    // Can't clear flags that don't have a direct field to update
    if (!fieldToUpdate) {
      toast({
        title: "Cannot clear this flag directly",
        description: "This flag requires adding data via the matter details page.",
        variant: "destructive",
      });
      setConfirmDialog(null);
      return;
    }
    
    try {
      await updateMatter.mutateAsync({
        id: matterId,
        [fieldToUpdate]: true
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

  const handleInlineUpdate = async (matterId: string, data: any) => {
    await updateMatter.mutateAsync({ id: matterId, ...data });
  };

  // Build flagged matters list
  const flaggedMatters: FlaggedMatter[] = liveMatters
    .map(matter => {
      const flags: FlagType[] = [];
      
      if (!matter.assignment_letter_signed) flags.push('engagement_letter');
      if (!matter.aml_kyc_complete) flags.push('aml_kyc');
      if (!matter.matter_open) flags.push('matter_open');
      if (!matter.conflicts_check) flags.push('conflicts');
      if (!mattersWithBudget.has(matter.id)) flags.push('no_budget_finalized');
      if (!mattersWithAssumptions.has(matter.id)) flags.push('no_assumptions');
      if (!matter.start_date) flags.push('no_start_date');
      if (matter.is_multi_client && mattersWithInvalidSplit.has(matter.id)) flags.push('invalid_client_split');
      if (!matter.cm_number || matter.cm_number.trim() === '') flags.push('no_cm_number');
      // Cast to any to access new field until types are regenerated
      const mma = (matter as any).matter_managing_attorney;
      if (!mma || mma.trim() === '') flags.push('no_mma');
      if (!matter.lead_partner || matter.lead_partner.trim() === '') flags.push('no_billing_partner');
      // Local counsel billing missing check - check per-LC billing_mode
      const localCounsels = (matter as any).local_counsels || [];
      const localCounselFee = Number(matter.local_counsel_fee) || 0;
      // Flag if there's LC fee but no LC records, or if any LC is missing billing_mode
      const hasLcWithMissingBilling = localCounsels.length > 0 
        ? localCounsels.some((lc: any) => !lc.billing_mode)
        : localCounselFee > 0; // Flag if fee exists but no LC records
      if (hasLcWithMissingBilling) {
        flags.push('no_lc_billing');
      }
      
      return {
        id: matter.id,
        matter_name: matter.matter_name,
        matter_number: matter.cm_number && matter.cm_number.trim() !== '' 
          ? matter.cm_number 
          : '[CM number required]',
        client_name: matter.clients?.name || '',
        client_display_name: matter.clients?.display_name || null,
        category: matter.category,
        flags,
      };
    })
    .filter(m => m.flags.length > 0);

  // Group matters by flag type
  const mattersByFlagType: Record<FlagType, FlaggedMatter[]> = {} as Record<FlagType, FlaggedMatter[]>;
  flagTypeOrder.forEach(type => {
    mattersByFlagType[type] = flaggedMatters.filter(m => m.flags.includes(type));
  });

  const totalFlags = flagTypeOrder.reduce((sum, type) => sum + mattersByFlagType[type].length, 0);

  // Check if flag type has inline editor
  const hasInlineEditor = (type: FlagType) => {
    return type === 'no_mma' || type === 'no_billing_partner' || type === 'no_start_date';
  };

  // Render inline editor based on flag type
  const renderInlineEditor = (type: FlagType, matter: FlaggedMatter) => {
    if (type === 'no_mma') {
      return (
        <PersonInlineEditor
          matterId={matter.id}
          matterName={matter.matter_name}
          fieldName="matter_managing_attorney"
          userName={userProfile?.full_name || null}
          onUpdate={handleInlineUpdate}
        />
      );
    }
    if (type === 'no_billing_partner') {
      return (
        <PersonInlineEditor
          matterId={matter.id}
          matterName={matter.matter_name}
          fieldName="lead_partner"
          userName={userProfile?.full_name || null}
          onUpdate={handleInlineUpdate}
        />
      );
    }
    if (type === 'no_start_date') {
      return (
        <DateInlineEditor
          matterId={matter.id}
          matterName={matter.matter_name}
          onUpdate={handleInlineUpdate}
        />
      );
    }
    return null;
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

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-3">
              <Flag className="h-8 w-8 text-warning" />
              Admin Flags
            </h1>
            <p className="text-muted-foreground mt-1">
              {totalFlags > 0 
                ? `${totalFlags} issue${totalFlags !== 1 ? 's' : ''} requiring attention across your live matters`
                : 'All clear - no issues requiring attention'}
            </p>
          </div>
        </div>

        {totalFlags === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="h-16 w-16 text-success mb-4" />
              <h2 className="text-xl font-heading font-semibold text-foreground mb-2">All Clear!</h2>
              <p className="text-muted-foreground max-w-md">
                There are no admin flags across your live matters. All compliance items are complete.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {flagTypeOrder.map((type) => {
                const count = mattersByFlagType[type]?.length || 0;
                const config = flagConfig[type];
                return (
                  <Card 
                    key={type} 
                    className={cn(
                      "shadow-card cursor-pointer transition-all hover:shadow-md", 
                      count > 0 && "border-l-4 border-l-warning"
                    )}
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

            {/* Flag Lists by Type */}
            {flagTypeOrder.map((type) => {
              const mattersWithFlag = mattersByFlagType[type];
              if (!mattersWithFlag || mattersWithFlag.length === 0) return null;
              
              const config = flagConfig[type];
              const canClear = config.field !== null && !hasInlineEditor(type);
              const showInlineEditor = hasInlineEditor(type);
              
              return (
                <Card 
                  key={type} 
                  className="shadow-card"
                  ref={(el) => { sectionRefs.current[type] = el; }}
                >
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
                        <div
                          key={matter.id}
                          className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                        >
                          <Link
                            to={`/matters/${matter.id}`}
                            className="flex-1 min-w-0 flex items-center gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {matter.matter_name}
                              </p>
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
                                    onClick={() => setConfirmDialog({
                                      open: true,
                                      matterId: matter.id,
                                      matterName: matter.matter_name,
                                      flagType: type
                                    })}
                                    className="p-1.5 rounded-full hover:bg-warning/20 text-warning transition-colors flex-shrink-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Clear flag</p>
                                </TooltipContent>
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
        )}
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