import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { TimeRangeSelector, TimeRange, getTimeRangeCutoff } from '@/components/ui/time-range-selector';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useDashboard, TrendDataPoint } from '@/lib/hooks/useDashboard';
import { useMatters } from '@/lib/hooks/useMatters';
import { useAuth } from '@/lib/auth';
import { formatCurrency } from '@/lib/currencyUtils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  DollarSign, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Clock,
  CheckCircle,
  Loader2,
  Rocket,
  CalendarClock,
  ListChecks,
  Trash2,
  Percent
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
import { toast } from '@/hooks/use-toast';

export default function Dashboard() {
  const [excludedMatterIds, setExcludedMatterIds] = useState<string[]>([]);
  const [excludedPipelineMatterIds, setExcludedPipelineMatterIds] = useState<string[]>([]);
  const [deleteConfirmDate, setDeleteConfirmDate] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTooltipData, setActiveTooltipData] = useState<{ dataPoint: TrendDataPoint; payload: any[] } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dashboardTimeRange, setDashboardTimeRange] = useState<TimeRange>("all");
  const isHoveringTooltipRef = useRef(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "Not my matters" checkbox defaults to unchecked (meaning they're excluded by default)
  const [notMyMattersIncluded, setNotMyMattersIncluded] = useState(false);
  const { data: stats, isLoading } = useDashboard(excludedMatterIds, excludedPipelineMatterIds);
  const { matters } = useMatters();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch current user's profile for the "Me" filter
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

  const userName = userProfile?.full_name || '';

  // Categorize LIVE matters into "my matters" and "not my matters"
  const { myMatterIds, notMyMatterIds } = useMemo(() => {
    if (!stats?.liveMatters || !userName) {
      return { myMatterIds: new Set<string>(), notMyMatterIds: new Set<string>() };
    }

    const myIds = new Set<string>();
    const notMyIds = new Set<string>();

    // Get the full matter data to check MMA and lead_partner
    const liveMattersMap = new Map(matters.filter(m => m.category === 'Live').map(m => [m.id, m]));

    stats.liveMatters.forEach(liveMatter => {
      const fullMatter = liveMattersMap.get(liveMatter.id);
      if (!fullMatter) {
        notMyIds.add(liveMatter.id);
        return;
      }

      const mma = (fullMatter as any).matter_managing_attorney || '';
      const billingPartner = fullMatter.lead_partner || '';

      // Check if user is MMA or Billing Partner (case-insensitive comparison)
      const isMMA = mma.toLowerCase().trim() === userName.toLowerCase().trim();
      const isBillingPartner = billingPartner.toLowerCase().trim() === userName.toLowerCase().trim();

      if (isMMA || isBillingPartner) {
        myIds.add(liveMatter.id);
      } else {
        notMyIds.add(liveMatter.id);
      }
    });

    return { myMatterIds: myIds, notMyMatterIds: notMyIds };
  }, [stats?.liveMatters, matters, userName]);

  // Categorize PIPELINE matters into "my matters" and "not my matters"
  // If MMA/BP fields are blank, the matter goes to "not my matters" (assumption: if I were MMA/BP, I'd have set it)
  const { myPipelineMatterIds, notMyPipelineMatterIds } = useMemo(() => {
    if (!stats?.pipelineMatters || !userName) {
      return { myPipelineMatterIds: new Set<string>(), notMyPipelineMatterIds: new Set<string>() };
    }

    const myIds = new Set<string>();
    const notMyIds = new Set<string>();

    // Get the full matter data to check MMA and lead_partner
    const pipelineMattersMap = new Map(matters.filter(m => m.category === 'Pipeline').map(m => [m.id, m]));

    stats.pipelineMatters.forEach(pipelineMatter => {
      const fullMatter = pipelineMattersMap.get(pipelineMatter.id);
      if (!fullMatter) {
        notMyIds.add(pipelineMatter.id);
        return;
      }

      const mma = (fullMatter as any).matter_managing_attorney || '';
      const billingPartner = fullMatter.lead_partner || '';

      // Check if user is MMA or Billing Partner (case-insensitive comparison)
      // If fields are blank, user is NOT considered MMA/BP
      const isMMA = mma.trim() !== '' && mma.toLowerCase().trim() === userName.toLowerCase().trim();
      const isBillingPartner = billingPartner.trim() !== '' && billingPartner.toLowerCase().trim() === userName.toLowerCase().trim();

      if (isMMA || isBillingPartner) {
        myIds.add(pipelineMatter.id);
      } else {
        notMyIds.add(pipelineMatter.id);
      }
    });

    return { myPipelineMatterIds: myIds, notMyPipelineMatterIds: notMyIds };
  }, [stats?.pipelineMatters, matters, userName]);

  // Initialize exclusions: by default, exclude "not my matters"
  // This runs once when the not-my-matters set is first populated
  const [hasInitializedExclusions, setHasInitializedExclusions] = useState(false);
  
  useEffect(() => {
    if (!hasInitializedExclusions && notMyMatterIds.size > 0) {
      // Exclude all "not my matters" by default
      setExcludedMatterIds(Array.from(notMyMatterIds));
      setExcludedPipelineMatterIds(Array.from(notMyPipelineMatterIds));
      setHasInitializedExclusions(true);
    }
  }, [notMyMatterIds, notMyPipelineMatterIds, hasInitializedExclusions]);

  // Calculate master checkbox states for Live matters
  const myMattersAllIncluded = useMemo(() => {
    if (myMatterIds.size === 0) return false;
    return Array.from(myMatterIds).every(id => !excludedMatterIds.includes(id));
  }, [myMatterIds, excludedMatterIds]);

  const notMyMattersAllIncluded = useMemo(() => {
    if (notMyMatterIds.size === 0) return false;
    return Array.from(notMyMatterIds).every(id => !excludedMatterIds.includes(id));
  }, [notMyMatterIds, excludedMatterIds]);

  const includedMatterIds = useMemo(() => {
    if (!stats?.liveMatters) return new Set<string>();
    const allIds = new Set(stats.liveMatters.map(m => m.id));
    excludedMatterIds.forEach(id => allIds.delete(id));
    return allIds;
  }, [stats?.liveMatters, excludedMatterIds]);

  const handleMatterToggle = (matterId: string, checked: boolean) => {
    setExcludedMatterIds(prev => 
      checked 
        ? prev.filter(id => id !== matterId)
        : [...prev, matterId]
    );
  };

  const handleMyMattersToggle = (checked: boolean) => {
    if (checked) {
      // Include all my matters (remove from excluded) - both Live and Pipeline
      setExcludedMatterIds(prev => prev.filter(id => !myMatterIds.has(id)));
      setExcludedPipelineMatterIds(prev => prev.filter(id => !myPipelineMatterIds.has(id)));
    } else {
      // Exclude all my matters - both Live and Pipeline
      setExcludedMatterIds(prev => {
        const newExcluded = new Set(prev);
        myMatterIds.forEach(id => newExcluded.add(id));
        return Array.from(newExcluded);
      });
      setExcludedPipelineMatterIds(prev => {
        const newExcluded = new Set(prev);
        myPipelineMatterIds.forEach(id => newExcluded.add(id));
        return Array.from(newExcluded);
      });
    }
  };

  const handleNotMyMattersToggle = (checked: boolean) => {
    if (checked) {
      // Include all not-my matters (remove from excluded) - both Live and Pipeline
      setExcludedMatterIds(prev => prev.filter(id => !notMyMatterIds.has(id)));
      setExcludedPipelineMatterIds(prev => prev.filter(id => !notMyPipelineMatterIds.has(id)));
    } else {
      // Exclude all not-my matters - both Live and Pipeline
      setExcludedMatterIds(prev => {
        const newExcluded = new Set(prev);
        notMyMatterIds.forEach(id => newExcluded.add(id));
        return Array.from(newExcluded);
      });
      setExcludedPipelineMatterIds(prev => {
        const newExcluded = new Set(prev);
        notMyPipelineMatterIds.forEach(id => newExcluded.add(id));
        return Array.from(newExcluded);
      });
    }
  };

  // Delete all snapshots for a specific date
  const handleDeleteDataPoint = async (rawDate: string) => {
    if (!user?.id) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('financial_snapshots')
        .delete()
        .eq('as_of_date', rawDate)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      toast({
        title: 'Data point deleted',
        description: 'The financial snapshots for this date have been removed.',
      });
      
      // Invalidate the dashboard query to refresh data
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      console.error('Error deleting data point:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete data point. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmDate(null);
    }
  };

  // Handle dot hover - only triggers when hovering directly over a dot
  const handleDotMouseEnter = useCallback((dataPoint: TrendDataPoint, payload: any[], cx: number, cy: number) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setActiveTooltipData({ dataPoint, payload });
    setTooltipPosition({ x: cx, y: cy });
  }, []);

  const handleDotMouseLeave = useCallback(() => {
    // Delay hiding to allow mouse to move to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringTooltipRef.current) {
        setActiveTooltipData(null);
        setTooltipPosition(null);
      }
    }, 150);
  }, []);

  const handleTooltipMouseEnter = useCallback(() => {
    isHoveringTooltipRef.current = true;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    isHoveringTooltipRef.current = false;
    setActiveTooltipData(null);
    setTooltipPosition(null);
  }, []);

  // Custom dot component that handles its own hover events
  const CustomDot = useCallback((props: any) => {
    const { cx, cy, payload, dataKey, stroke } = props;
    if (!cx || !cy) return null;
    
    // Build the payload array for all three metrics
    const fullPayload = [
      { name: 'WIP', value: payload.wip, color: 'hsl(var(--chart-3))' },
      { name: 'Billed', value: payload.billed, color: 'hsl(var(--chart-1))' },
      { name: 'Paid', value: payload.paid, color: 'hsl(var(--chart-2))' },
    ];
    
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={stroke}
        stroke={stroke}
        strokeWidth={2}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => handleDotMouseEnter(payload as TrendDataPoint, fullPayload, cx, cy)}
        onMouseLeave={handleDotMouseLeave}
      />
    );
  }, [handleDotMouseEnter, handleDotMouseLeave]);

  // Use shared formatCurrency from currencyUtils - imported at top


  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Calculate total lock-up (WIP + Outstanding AR) - all capital tied up
  const outstandingAR = (stats?.totalBilled || 0) - (stats?.totalPaid || 0);
  const totalLockup = (stats?.totalWip || 0) + outstandingAR;

  const kpiCards = [
    {
      title: 'Work in Progress',
      value: formatCurrency(stats?.totalWip || 0, 'USD'),
      icon: <Clock className="h-5 w-5" />,
      variant: 'default' as const,
      hasProposalAdjustment: stats?.hasActiveWipProposals || false,
    },
    {
      title: 'Total AR',
      value: formatCurrency(outstandingAR, 'USD'),
      icon: <FileText className="h-5 w-5" />,
      variant: 'default' as const,
    },
    {
      title: 'Total Lock-up',
      value: formatCurrency(totalLockup, 'USD'),
      icon: <DollarSign className="h-5 w-5" />,
      variant: 'default' as const,
    },
    {
      title: 'Total Billed',
      value: formatCurrency(stats?.totalBilled || 0, 'USD'),
      icon: <FileText className="h-5 w-5" />,
      variant: 'default' as const,
    },
    {
      title: 'Total Paid',
      value: formatCurrency(stats?.totalPaid || 0, 'USD'),
      icon: <CheckCircle className="h-5 w-5" />,
      variant: 'success' as const,
    },
    {
      title: 'Realization Rate',
      value: `${(stats?.realizationRate || 0).toFixed(1)}%`,
      icon: <Percent className="h-5 w-5" />,
      variant: (stats?.realizationRate || 0) >= 80 ? 'success' as const : (stats?.realizationRate || 0) >= 60 ? 'warning' as const : 'danger' as const,
      infoTooltip: 'Realization Rate measures the percentage of worked time that was actually collected as revenue. WIP write-offs hurt this rate. E.g., if you bill £100k, write off £50k, and collect £50k, your collection rate is 100% but realization rate is 50%.',
    },
    {
      title: 'Collection Rate',
      value: `${(stats?.avgCollectionRate || 0).toFixed(1)}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      variant: (stats?.avgCollectionRate || 0) >= 80 ? 'success' as const : (stats?.avgCollectionRate || 0) >= 60 ? 'warning' as const : 'danger' as const,
      infoTooltip: 'Collection Rate measures the percentage of billed amounts that have been collected. WIP write-offs do not affect this rate — it only looks at bills issued vs. payments received.',
    },
  ];

  // Use actual trend data from snapshots, filtered by time range
  const allTrendData = stats?.trendData || [];
  const trendData = allTrendData.filter(d => {
    const cutoff = getTimeRangeCutoff(dashboardTimeRange);
    if (!cutoff) return true;
    return new Date(d.rawDate || d.date) >= cutoff;
  });
  const hasData = trendData.length > 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-foreground">Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Overview of your legal matter finances</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button asChild variant="outline" size="sm" className="sm:h-10 sm:px-4 sm:py-2">
              <Link to="/matters">View All Matters</Link>
            </Button>
            <Button asChild size="sm" className="sm:h-10 sm:px-4 sm:py-2">
              <Link to="/matters/new">
                <Briefcase className="mr-1 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Matter</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-4">
          {kpiCards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              variant={card.variant}
              infoTooltip={'infoTooltip' in card ? card.infoTooltip : undefined}
              note={'hasProposalAdjustment' in card && card.hasProposalAdjustment ? 'Adjusted for WIP proposals' : undefined}
              noteVariant={'hasProposalAdjustment' in card && card.hasProposalAdjustment ? 'amber' : undefined}
            />
          ))}
        </div>

        {/* Budget Summary - Live, Pipeline & Grand Total */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 bg-primary/5 rounded-lg border border-primary/10">
          {/* Live Matters Total */}
          <Card className="shadow-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Live Matters BM Budget</p>
                  <p className="text-lg sm:text-2xl font-heading font-bold text-foreground truncate">{formatCurrency(stats?.totalBudget || 0, 'USD')}</p>
                  <p className="text-xs text-muted-foreground">{stats?.openMattersCount || 0} live matters</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <Briefcase className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Total (Potential) */}
          <Card className="shadow-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Pipeline (Potential)</p>
                  <p className="text-lg sm:text-2xl font-heading font-bold text-foreground truncate">{formatCurrency(stats?.totalPipelineValueUsd || 0, 'USD')}</p>
                  <p className="text-xs text-muted-foreground">{stats?.pipelineMattersCount || 0} pipeline matters</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <Rocket className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grand Total (Theoretical) */}
          <Card className="shadow-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Grand Total (Theoretical)</p>
                  <p className="text-lg sm:text-2xl font-heading font-bold text-foreground truncate">{formatCurrency((stats?.totalBudget || 0) + (stats?.totalPipelineValueUsd || 0), 'USD')}</p>
                  <p className="text-xs text-muted-foreground">Live + Pipeline if all won</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Matters Filter Section */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-1">
            <CardTitle className="font-heading text-base sm:text-lg flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Live Matters
            </CardTitle>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {includedMatterIds.size} of {stats?.liveMatters?.length || 0} included
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            {stats?.liveMatters && stats.liveMatters.length > 0 ? (
              <>
                {/* Master Toggle Checkboxes */}
                {userName && (
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-6 mb-4 pb-3 border-b border-border">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={myMattersAllIncluded}
                        onCheckedChange={(checked) => handleMyMattersToggle(!!checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-500">
                        Matters Where I Am MMA and/or Billing Partner
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({myMatterIds.size})
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={notMyMattersAllIncluded}
                        onCheckedChange={(checked) => handleNotMyMattersToggle(!!checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium text-rose-600 dark:text-rose-500">
                        Matters Where I Am Not MMA or Billing Partner
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({notMyMatterIds.size})
                      </span>
                    </label>
                  </div>
                )}
                {/* Individual Matter Checkboxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-8 gap-y-1 sm:gap-y-2 max-h-48 overflow-y-auto">
                  {stats.liveMatters.map((matter) => {
                    const isIncluded = !excludedMatterIds.includes(matter.id);
                    return (
                      <label
                        key={matter.id}
                        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
                      >
                        <Checkbox
                          checked={isIncluded}
                          onCheckedChange={(checked) => handleMatterToggle(matter.id, !!checked)}
                          className="h-3.5 w-3.5"
                        />
                        <span className={`text-xs truncate ${isIncluded ? 'text-foreground' : 'text-muted-foreground'}`}>
                          <span className="font-medium">{matter.clientName}</span>
                          <span className="text-muted-foreground"> – </span>
                          <span>{matter.matterName}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No live matters</p>
            )}
          </CardContent>
        </Card>

        {/* Financial Trends - Full Width */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-heading text-lg">Financial Trends</CardTitle>
            <TimeRangeSelector value={dashboardTimeRange} onChange={setDashboardTimeRange} />
          </CardHeader>
          <CardContent>
            {hasData ? (
              <div className="h-52 sm:h-64 lg:h-72 relative -mx-2 sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis 
                      className="text-xs" 
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="wip" 
                      name="WIP"
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={2}
                      dot={<CustomDot />}
                      activeDot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="billed" 
                      name="Billed"
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={<CustomDot />}
                      activeDot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="paid" 
                      name="Paid"
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={<CustomDot />}
                      activeDot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                
                {/* Custom positioned tooltip that stays still */}
                {activeTooltipData && tooltipPosition && (
                  <div
                    ref={tooltipRef}
                    className="absolute z-50 bg-card border border-border rounded-lg p-3 shadow-lg pointer-events-auto"
                    style={{
                      left: tooltipPosition.x + 15,
                      top: tooltipPosition.y - 60,
                      transform: 'translateY(-50%)',
                    }}
                    onMouseEnter={handleTooltipMouseEnter}
                    onMouseLeave={handleTooltipMouseLeave}
                  >
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <span className="font-medium text-sm">{activeTooltipData.dataPoint.date}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmDate(activeTooltipData.dataPoint.rawDate);
                          setActiveTooltipData(null);
                          setTooltipPosition(null);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {activeTooltipData.payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-muted-foreground">{entry.name}:</span>
                          <span className="font-medium">{formatCurrency(entry.value, 'USD')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

        {/* Red Flags and Pipeline Flags - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Red Flags */}
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
                          {alert.clientName} • {alert.cmNumber}
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

          {/* Pipeline Flags */}
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Rocket className="h-5 w-5 text-amber-500" />
                Pipeline Flags
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {stats?.pipelineAlerts?.length || 0} items
              </span>
            </CardHeader>
            <CardContent>
              {stats?.pipelineAlerts && stats.pipelineAlerts.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {stats.pipelineAlerts.map((alert) => (
                    <Link
                      key={alert.id}
                      to={`/matters/${alert.matterId}`}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                    >
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        alert.type === 'RFP Deadline Soon' 
                          ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' 
                          : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {alert.type === 'RFP Deadline Soon' ? (
                          <Clock className="h-4 w-4" />
                        ) : (
                          <CalendarClock className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {alert.matterName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.clientName} • {alert.cmNumber}
                        </p>
                        <p className={`text-xs mt-1 font-medium ${
                          alert.type === 'RFP Deadline Soon' 
                            ? 'text-orange-600 dark:text-orange-400' 
                            : 'text-purple-600 dark:text-purple-400'
                        }`}>
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
                  <p className="text-xs text-muted-foreground">No pipeline deadlines requiring attention</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmDate} onOpenChange={(open) => !open && setDeleteConfirmDate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete data point?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all financial snapshots for this date across all matters. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConfirmDate && handleDeleteDataPoint(deleteConfirmDate)}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
