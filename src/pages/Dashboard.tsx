import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { TimeRangeSelector, TimeRange, getTimeRangeCutoff } from '@/components/ui/time-range-selector';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboard, TrendDataPoint, MatterBreakdown } from '@/lib/hooks/useDashboard';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { useUserSettings } from '@/lib/hooks/useUserSettings';
import { useMatters } from '@/lib/hooks/useMatters';
import { useAuth } from '@/lib/auth';
import { formatCurrency } from '@/lib/currencyUtils';
import { cn } from '@/lib/utils';
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
  const [expandedTile, setExpandedTile] = useState<'wip' | 'ar' | 'paid' | 'realization' | null>(null);
  const [excludedWriteOffYears, setExcludedWriteOffYears] = useState<Set<number>>(new Set());
  // Financial year start (month 1-12, day 1-31). Persisted to localStorage so it
  // survives reloads. Default: 1 July (firm's choice — adjustable in the drill-down).
  const [fyStart, setFyStart] = useState<{ month: number; day: number }>(() => {
    try {
      const raw = localStorage.getItem('dashboard:fyStart');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.month === 'number' && typeof parsed?.day === 'number') return parsed;
      }
    } catch { /* ignore */ }
    return { month: 7, day: 1 };
  });
  useEffect(() => {
    try { localStorage.setItem('dashboard:fyStart', JSON.stringify(fyStart)); } catch { /* ignore */ }
  }, [fyStart]);
  const breakdownRef = useRef<HTMLDivElement>(null);
  // "Not my matters" checkbox defaults to unchecked (meaning they're excluded by default)
  const [notMyMattersIncluded, setNotMyMattersIncluded] = useState(false);
  const { settings } = useUserSettings();
  const alertThresholds = useMemo(() => settings ? {
    nearBudgetPercent: settings.near_budget_threshold,
    wipWarningAmount: settings.wip_warning_threshold,
    poorCollectionPercent: settings.poor_collection_threshold,
  } : undefined, [settings]);
  const { data: stats, isLoading } = useDashboard(excludedMatterIds, excludedPipelineMatterIds, alertThresholds);
  const { matters } = useMatters();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { syncAlerts } = useNotifications();

  useEffect(() => {
    if (stats?.alerts || stats?.pipelineAlerts) {
      syncAlerts(stats.alerts || [], stats.pipelineAlerts || []);
    }
  }, [stats?.alerts, stats?.pipelineAlerts, syncAlerts]);

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

      const mma = fullMatter.matter_managing_attorney || '';
      const billingPartner = fullMatter.lead_partner || '';

      // Check if user is MMA or Billing Partner (case-insensitive comparison)
      // If fields are blank, user is NOT considered MMA/BP
      const isMMA = mma.trim() !== '' && mma.toLowerCase().trim() === userName.toLowerCase().trim();
      const isBillingPartner = billingPartner.trim() !== '' && billingPartner.toLowerCase().trim() === userName.toLowerCase().trim();

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

      const mma = fullMatter.matter_managing_attorney || '';
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

  // Master checkbox states are user-controlled only (one-way control).
  // Toggling a master checkbox includes/excludes all its children, but
  // toggling individual child matters does NOT change the master state.
  // Defaults match the initial exclusion behavior: "my matters" included,
  // "not my matters" excluded.
  const [myMattersAllIncluded, setMyMattersAllIncluded] = useState(true);
  const [notMyMattersAllIncluded, setNotMyMattersAllIncluded] = useState(false);

  const includedMatterIds = useMemo(() => {
    if (!stats?.liveMatters) return new Set<string>();
    const allIds = new Set(stats.liveMatters.map(m => m.id));
    excludedMatterIds.forEach(id => allIds.delete(id));
    return allIds;
  }, [stats?.liveMatters, excludedMatterIds]);

  const includedLiveCount = useMemo(() => {
    if (!stats?.liveMatters) return 0;
    return stats.liveMatters.filter(m => !excludedMatterIds.includes(m.id)).length;
  }, [stats?.liveMatters, excludedMatterIds]);

  const includedPipelineCount = useMemo(() => {
    if (!stats?.pipelineMatters) return 0;
    return stats.pipelineMatters.filter(m => !excludedPipelineMatterIds.includes(m.id)).length;
  }, [stats?.pipelineMatters, excludedPipelineMatterIds]);

  // Budget totals computed client-side from per-matter USD values on
  // stats.liveMatters / stats.pipelineMatters. This keeps the tiles
  // instantly in sync with the exclusion checkboxes without waiting for
  // a useDashboard refetch or any server-side filter logic.
  const displayedLiveBudget = useMemo(() => {
    if (!stats?.liveMatters) return 0;
    return stats.liveMatters
      .filter(m => !excludedMatterIds.includes(m.id))
      .reduce((sum, m) => sum + (m.bmFeeUsd || 0), 0);
  }, [stats?.liveMatters, excludedMatterIds]);

  const displayedLiveUsed = useMemo(() => {
    if (!stats?.liveMatters) return 0;
    return stats.liveMatters
      .filter(m => !excludedMatterIds.includes(m.id))
      .reduce((sum, m) => sum + (m.usedUsd || 0), 0);
  }, [stats?.liveMatters, excludedMatterIds]);

  const displayedPipelineBudget = useMemo(() => {
    if (!stats?.pipelineMatters) return 0;
    return stats.pipelineMatters
      .filter(m => !excludedPipelineMatterIds.includes(m.id))
      .reduce((sum, m) => sum + (m.bmFeeUsd || 0), 0);
  }, [stats?.pipelineMatters, excludedPipelineMatterIds]);

  const handleMatterToggle = (matterId: string, checked: boolean) => {
    setExcludedMatterIds(prev =>
      checked
        ? prev.filter(id => id !== matterId)
        : [...prev, matterId]
    );
  };

  const handlePipelineMatterToggle = (matterId: string, checked: boolean) => {
    setExcludedPipelineMatterIds(prev =>
      checked
        ? prev.filter(id => id !== matterId)
        : [...prev, matterId]
    );
  };

  const handleMyMattersToggle = (checked: boolean) => {
    setMyMattersAllIncluded(checked);
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
    setNotMyMattersAllIncluded(checked);
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
      // Find the snapshot ids being deleted so their seeded write_off_events
      // can be cleaned up too. Without this, the write-off amounts persist
      // (FK is ON DELETE SET NULL) and keep contributing to dashboard /
      // realization / burn calculations after the snapshot is gone.
      const { data: snapsToDelete } = await supabase
        .from('financial_snapshots')
        .select('id')
        .eq('as_of_date', rawDate)
        .eq('user_id', user.id);
      const snapIds = (snapsToDelete || []).map(s => s.id);
      if (snapIds.length > 0) {
        await supabase
          .from('write_off_events' as never)
          .delete()
          .in('source_snapshot_id', snapIds);
      }

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
      
      // Wipe cached chart data entirely — invalidate alone would render
      // the stale cache momentarily before the background refetch completes,
      // leaving graphs showing deleted data on filter combinations the user
      // hasn't yet revisited.
      queryClient.removeQueries({ queryKey: ['dashboard'] });
      queryClient.removeQueries({ queryKey: ['report-realization'] });
      queryClient.removeQueries({ queryKey: ['report-budget-burn'] });
      queryClient.removeQueries({ queryKey: ['report-wip-movement'] });
      queryClient.removeQueries({ queryKey: ['report-collection'] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
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
      { name: 'AR', value: payload.ar, color: 'hsl(var(--chart-1))' },
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

  const breakdownData = useMemo(() => {
    if (!expandedTile || !stats?.matterBreakdowns) return [];
    const sorted = [...stats.matterBreakdowns];
    if (expandedTile === 'wip') {
      return sorted.filter(m => m.wipAmount > 0).sort((a, b) => b.wipAmount - a.wipAmount);
    }
    if (expandedTile === 'ar') {
      return sorted.filter(m => m.arAmount > 0).sort((a, b) => b.arAmount - a.arAmount);
    }
    if (expandedTile === 'paid') {
      return sorted.filter(m => m.paidAmount > 0).sort((a, b) => b.paidAmount - a.paidAmount);
    }
    return [];
  }, [expandedTile, stats?.matterBreakdowns]);

  // Attribute a snapshot date to the firm's financial year (by FY-ending calendar year).
  // Example: FY starts 1 July. A write-off on 30 Jun 2026 → FY 2026 (ends 30 Jun 2026).
  // A write-off on 1 Jul 2026 → FY 2027 (next FY, ends 30 Jun 2027).
  const getFiscalYear = useCallback((dateIso: string): number => {
    let d = new Date(dateIso);
    // Some snapshots may have a malformed or missing as_of_date — fall back to today
    // so the write-off is still attributed to a real financial year instead of "FY NaN".
    if (isNaN(d.getTime())) d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1; // 1-12
    const day = d.getDate();
    if (fyStart.month === 1 && fyStart.day === 1) return y;
    const onOrAfterFyStart = m > fyStart.month || (m === fyStart.month && day >= fyStart.day);
    return onOrAfterFyStart ? y + 1 : y;
  }, [fyStart]);

  // Write-offs grouped by financial year (for Realization Rate drill-down).
  // Each entry in stats.writeOffsByMatter represents one dated write-off event,
  // so a single matter can contribute to multiple years. matterCount counts
  // distinct matters rather than events.
  const writeOffsByYear = useMemo(() => {
    const rows = stats?.writeOffsByMatter || [];
    const byYear = new Map<number, { year: number; totalUsd: number; matterIds: Set<string> }>();
    rows.forEach(w => {
      const fy = getFiscalYear(w.asOfDate);
      const entry = byYear.get(fy) || { year: fy, totalUsd: 0, matterIds: new Set<string>() };
      entry.totalUsd += w.writeOffUsd;
      entry.matterIds.add(w.id);
      byYear.set(fy, entry);
    });
    return Array.from(byYear.values())
      .map(e => ({ year: e.year, totalUsd: e.totalUsd, matterCount: e.matterIds.size }))
      .sort((a, b) => b.year - a.year);
  }, [stats?.writeOffsByMatter, getFiscalYear]);

  const isFiscalYearCalendar = fyStart.month === 1 && fyStart.day === 1;

  // Realization rate adjusted for excluded write-off years.
  // Formula: Paid / (Billed + IncludedWriteOffs). Excluding a year's write-offs
  // removes them from the denominator, which raises the rate.
  const adjustedRealizationRate = useMemo(() => {
    if (!stats) return 0;
    if (excludedWriteOffYears.size === 0) return stats.realizationRate;
    const excludedUsd = writeOffsByYear
      .filter(y => excludedWriteOffYears.has(y.year))
      .reduce((sum, y) => sum + y.totalUsd, 0);
    const includedWriteOffs = (stats.totalWipWriteOff || 0) - excludedUsd;
    const denom = (stats.totalBilled || 0) + includedWriteOffs;
    if (denom <= 0) return 100;
    return ((stats.totalPaid || 0) / denom) * 100;
  }, [stats, excludedWriteOffYears, writeOffsByYear]);

  const toggleWriteOffYear = (year: number) => {
    setExcludedWriteOffYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
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

  // Calculate total lock-up (WIP + Outstanding AR) - all capital tied up
  const outstandingAR = (stats?.totalBilled || 0) - (stats?.totalPaid || 0);
  const totalLockup = (stats?.totalWip || 0) + outstandingAR;

  const handleTileClick = (tile: 'wip' | 'ar' | 'paid' | 'realization') => {
    setExpandedTile(prev => prev === tile ? null : tile);
    // Scroll to breakdown after a tick
    setTimeout(() => {
      breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const kpiCards = [
    {
      title: 'Work in Progress',
      value: formatCurrency(stats?.totalWip || 0, 'USD'),
      icon: <Clock className="h-5 w-5" />,
      variant: 'default' as const,
      hasProposalAdjustment: stats?.hasActiveWipProposals || false,
      tileKey: 'wip' as const,
    },
    {
      title: 'Total AR',
      value: formatCurrency(outstandingAR, 'USD'),
      icon: <FileText className="h-5 w-5" />,
      variant: 'default' as const,
      tileKey: 'ar' as const,
    },
    {
      title: 'Total Lock-up',
      value: formatCurrency(totalLockup, 'USD'),
      icon: <DollarSign className="h-5 w-5" />,
      variant: 'default' as const,
      tileKey: null,
    },
    {
      title: 'Total Billed',
      value: formatCurrency(stats?.totalBilled || 0, 'USD'),
      icon: <FileText className="h-5 w-5" />,
      variant: 'default' as const,
      tileKey: null,
    },
    {
      title: 'Total Paid',
      value: formatCurrency(stats?.totalPaid || 0, 'USD'),
      icon: <CheckCircle className="h-5 w-5" />,
      variant: 'success' as const,
      tileKey: 'paid' as const,
    },
    {
      title: 'Realization Rate',
      value: `${adjustedRealizationRate.toFixed(1)}%`,
      icon: <Percent className="h-5 w-5" />,
      variant: adjustedRealizationRate >= 80 ? 'success' as const : adjustedRealizationRate >= 60 ? 'warning' as const : 'danger' as const,
      infoTooltip: 'Realization Rate measures the percentage of worked time that was actually collected as revenue. WIP write-offs hurt this rate. Click the tile to see write-offs by year and toggle them in/out of the calculation.',
      note: excludedWriteOffYears.size > 0 ? `Excluding ${excludedWriteOffYears.size} write-off year${excludedWriteOffYears.size > 1 ? 's' : ''}` : undefined,
      noteVariant: excludedWriteOffYears.size > 0 ? 'info' as const : undefined,
      tileKey: 'realization' as const,
    },
    {
      title: 'Collection Rate',
      value: `${(stats?.avgCollectionRate || 0).toFixed(1)}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      variant: (stats?.avgCollectionRate || 0) >= 80 ? 'success' as const : (stats?.avgCollectionRate || 0) >= 60 ? 'warning' as const : 'danger' as const,
      infoTooltip: 'Collection Rate measures the percentage of billed amounts that have been collected. WIP write-offs do not affect this rate — it only looks at bills issued vs. payments received.',
      tileKey: null,
    },
  ];


  const breakdownTitle = expandedTile === 'wip' ? 'Work in Progress' : expandedTile === 'ar' ? 'Accounts Receivable' : 'Paid';
  const getBreakdownValue = (m: MatterBreakdown) => {
    if (expandedTile === 'wip') return m.wipAmount;
    if (expandedTile === 'ar') return m.arAmount;
    return m.paidAmount;
  };

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-2 sm:gap-4">
          {kpiCards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              variant={card.variant}
              infoTooltip={'infoTooltip' in card ? card.infoTooltip : undefined}
              note={
                'note' in card && card.note
                  ? card.note
                  : 'hasProposalAdjustment' in card && card.hasProposalAdjustment
                    ? 'Adjusted for WIP proposals'
                    : undefined
              }
              noteVariant={
                'noteVariant' in card && card.noteVariant
                  ? card.noteVariant
                  : 'hasProposalAdjustment' in card && card.hasProposalAdjustment
                    ? 'amber'
                    : undefined
              }
              onClick={card.tileKey ? () => handleTileClick(card.tileKey!) : undefined}
              isExpanded={card.tileKey ? expandedTile === card.tileKey : false}
            />
          ))}
        </div>

        {/* Realization Rate Drill-down */}
        {expandedTile === 'realization' && (
          <div ref={breakdownRef}>
            <Card className="shadow-card animate-in slide-in-from-top-2 duration-200 max-w-2xl">
              <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-foreground">
                    Write-offs by Year
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setExpandedTile(null)} className="text-xs text-muted-foreground">
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 pt-0 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Financial year starts:
                  </p>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(fyStart.day)}
                      onValueChange={v => setFyStart(prev => ({ ...prev, day: Math.min(parseInt(v, 10) || 1, 28) }))}
                    >
                      <SelectTrigger className="h-8 w-[70px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28].map(d => (
                          <SelectItem key={d} value={String(d)} className="text-xs">{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(fyStart.month)}
                      onValueChange={v => setFyStart(prev => ({ ...prev, month: parseInt(v, 10) || 1 }))}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['January','February','March','April','May','June','July','August','September','October','November','December'].map((name, idx) => (
                          <SelectItem key={name} value={String(idx + 1)} className="text-xs">{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Uncheck a financial year to remove its write-offs from the realization rate calculation.
                  Current rate: <span className="font-medium text-foreground">{adjustedRealizationRate.toFixed(1)}%</span>
                  {excludedWriteOffYears.size > 0 && stats && (
                    <span className="text-muted-foreground"> (base {stats.realizationRate.toFixed(1)}%)</span>
                  )}
                </p>
                {writeOffsByYear.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No write-offs recorded on the included matters.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="w-8 py-2"></th>
                        <th className="text-left py-2 pr-2 text-xs font-medium text-muted-foreground">{isFiscalYearCalendar ? 'Year' : 'Financial Year'}</th>
                        <th className="text-left py-2 pr-2 text-xs font-medium text-muted-foreground">Matters</th>
                        <th className="text-right py-2 text-xs font-medium text-muted-foreground">Written off (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {writeOffsByYear.map(row => {
                        const included = !excludedWriteOffYears.has(row.year);
                        return (
                          <tr key={row.year} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-2">
                              <Checkbox
                                checked={included}
                                onCheckedChange={() => toggleWriteOffYear(row.year)}
                                aria-label={`${included ? 'Exclude' : 'Include'} ${row.year} write-offs`}
                              />
                            </td>
                            <td className={cn('py-2 pr-2 text-xs sm:text-sm', included ? 'text-foreground' : 'text-muted-foreground line-through')}>
                              {isFiscalYearCalendar ? row.year : `FY ${row.year}`}
                            </td>
                            <td className={cn('py-2 pr-2 text-xs', included ? 'text-muted-foreground' : 'text-muted-foreground/60')}>
                              {row.matterCount}
                            </td>
                            <td className={cn('py-2 text-right text-xs sm:text-sm tabular-nums', included ? 'font-medium text-foreground' : 'text-muted-foreground line-through')}>
                              {formatCurrency(row.totalUsd, 'USD')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Matter Breakdown Panel */}
        {expandedTile && expandedTile !== 'realization' && breakdownData.length > 0 && (
          <div ref={breakdownRef}>
            <Card className="shadow-card animate-in slide-in-from-top-2 duration-200 max-w-2xl">
              <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-foreground">
                    {breakdownTitle} by Matter ({breakdownData.length})
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setExpandedTile(null)} className="text-xs text-muted-foreground">
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 pt-0">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-2 text-xs font-medium text-muted-foreground">Matter</th>
                        <th className="text-left py-2 pr-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Client</th>
                        <th className="text-right py-2 text-xs font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdownData.map((m) => (
                        <tr key={m.id} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="py-2 pr-2">
                            <Link to={`/matters/${m.id}`} className="text-primary hover:underline text-xs sm:text-sm">
                              {m.matterName}
                            </Link>
                          </td>
                          <td className="py-2 pr-2 text-xs text-muted-foreground hidden sm:table-cell">{m.clientName}</td>
                          <td className="py-2 text-right text-xs sm:text-sm font-medium text-foreground">
                            {formatCurrency(getBreakdownValue(m), m.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Budget Summary - Live, Pipeline & Grand Total */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 bg-primary/5 rounded-lg border border-primary/10">
          {/* Live Matters Total */}
          <Card className="shadow-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Live Matters BM Budget</p>
                  <p className="text-lg sm:text-2xl font-heading font-bold text-foreground truncate">{formatCurrency(displayedLiveBudget, 'USD')}</p>
                  <p className="text-xs text-muted-foreground">{includedLiveCount} live matters</p>
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
                  <p className="text-lg sm:text-2xl font-heading font-bold text-foreground truncate">{formatCurrency(displayedPipelineBudget, 'USD')}</p>
                  <p className="text-xs text-muted-foreground">{includedPipelineCount} pipeline matters</p>
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
                  <p className="text-lg sm:text-2xl font-heading font-bold text-foreground truncate">{formatCurrency(displayedLiveBudget + displayedPipelineBudget, 'USD')}</p>
                  <p className="text-xs text-muted-foreground">Live + Pipeline if all won</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Matters Filter Section */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-1">
            <CardTitle className="font-heading text-base sm:text-lg flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Matters &amp; Budgets
            </CardTitle>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {includedLiveCount + includedPipelineCount} of {(stats?.liveMatters?.length || 0) + (stats?.pipelineMatters?.length || 0)} included
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            {((stats?.liveMatters?.length || 0) + (stats?.pipelineMatters?.length || 0)) > 0 ? (
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
                        ({myMatterIds.size + myPipelineMatterIds.size})
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
                        ({notMyMatterIds.size + notMyPipelineMatterIds.size})
                      </span>
                    </label>
                  </div>
                )}

                {/* Live Matters subsection */}
                <h3 className="text-sm font-heading font-semibold text-foreground mt-2 mb-2">
                  Live Matters
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    {includedLiveCount} of {stats?.liveMatters?.length || 0} included
                  </span>
                </h3>
                {stats?.liveMatters && stats.liveMatters.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-8 gap-y-1 sm:gap-y-2 max-h-48 overflow-y-auto">
                    {stats.liveMatters.map((matter) => {
                      const isIncluded = !excludedMatterIds.includes(matter.id);
                      return (
                        <div
                          key={matter.id}
                          className="flex items-center gap-2 py-1 rounded px-1 -mx-1 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={isIncluded}
                            onCheckedChange={(checked) => handleMatterToggle(matter.id, !!checked)}
                            className="h-3.5 w-3.5 cursor-pointer"
                            aria-label={`Include ${matter.matterName} in totals`}
                          />
                          <Link
                            to={`/matters/${matter.id}`}
                            className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer"
                          >
                            <span className={`text-xs truncate flex-1 ${isIncluded ? 'text-foreground' : 'text-muted-foreground'}`}>
                              <span className="font-medium">{matter.clientName}</span>
                              <span className="text-muted-foreground"> – </span>
                              <span>{matter.matterName}</span>
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                              {formatCurrency(matter.bmFeeUsd || 0, 'USD')}
                            </span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-1">No live matters</p>
                )}

                {/* Pipeline Matters subsection */}
                <h3 className="text-sm font-heading font-semibold text-foreground mt-6 mb-2">
                  Pipeline Matters
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    {includedPipelineCount} of {stats?.pipelineMatters?.length || 0} included
                  </span>
                </h3>
                {stats?.pipelineMatters && stats.pipelineMatters.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-8 gap-y-1 sm:gap-y-2 max-h-48 overflow-y-auto">
                    {stats.pipelineMatters.map((matter) => {
                      const isIncluded = !excludedPipelineMatterIds.includes(matter.id);
                      return (
                        <div
                          key={matter.id}
                          className="flex items-center gap-2 py-1 rounded px-1 -mx-1 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={isIncluded}
                            onCheckedChange={(checked) => handlePipelineMatterToggle(matter.id, !!checked)}
                            className="h-3.5 w-3.5 cursor-pointer"
                            aria-label={`Include ${matter.matterName} in totals`}
                          />
                          <Link
                            to={`/matters/${matter.id}`}
                            className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer"
                          >
                            <span className={`text-xs truncate flex-1 ${isIncluded ? 'text-foreground' : 'text-muted-foreground'}`}>
                              <span className="font-medium">{matter.clientName}</span>
                              <span className="text-muted-foreground"> – </span>
                              <span>{matter.matterName}</span>
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                              {formatCurrency(matter.bmFeeUsd || 0, 'USD')}
                            </span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-1">No pipeline matters</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No matters</p>
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
                      dataKey="ar" 
                      name="AR"
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
