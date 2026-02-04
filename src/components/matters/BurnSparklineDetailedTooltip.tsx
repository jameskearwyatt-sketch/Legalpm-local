import { useMemo } from 'react';
import { format, parseISO, differenceInMonths, differenceInDays } from 'date-fns';
import { formatCurrency } from '@/lib/currencyUtils';
import { TrendingUp, TrendingDown, Calendar, Target, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface SnapshotPoint {
  as_of_date: string;
  wip_amount: number;
  accounts_receivable: number;
  paid_amount: number;
  wip_write_off_amount?: number;
}

interface ProposalData {
  wip_write_off_amount?: number;
  ar_write_off_amount?: number;
}

interface DataPoint {
  date: string;
  burn: number;
  isSynthetic?: boolean;
}

interface BurnSparklineDetailedTooltipProps {
  snapshots: SnapshotPoint[];
  bmBudget: number;
  currentBurn: number;
  currency: string;
  burnPercent: number;
  usdEquivalent?: number;
  startDate?: string | null;
  onHoldMonths?: number;
  hasActiveProposal?: boolean;
  proposalData?: ProposalData | null;
  rawBurn?: number;
  dataPoints: DataPoint[];
}

export function BurnSparklineDetailedTooltip({
  snapshots,
  bmBudget,
  currentBurn,
  currency,
  burnPercent,
  usdEquivalent,
  startDate,
  onHoldMonths = 0,
  hasActiveProposal = false,
  proposalData,
  rawBurn,
  dataPoints,
}: BurnSparklineDetailedTooltipProps) {
  // Larger chart dimensions
  const width = 280;
  const height = 140;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const realSnapshotCount = dataPoints.filter(d => !d.isSynthetic).length;
  const proposalWriteOff = proposalData 
    ? (proposalData.wip_write_off_amount || 0) + (proposalData.ar_write_off_amount || 0)
    : 0;

  // Calculate burn rate per month
  const burnRatePerMonth = useMemo(() => {
    if (!startDate || currentBurn <= 0) return 0;
    
    const start = parseISO(startDate);
    const now = new Date();
    
    const yearDiff = now.getFullYear() - start.getFullYear();
    const monthDiff = now.getMonth() - start.getMonth();
    const dayDiff = now.getDate() - start.getDate();
    let totalMonths = yearDiff * 12 + monthDiff;
    const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    totalMonths += dayDiff / daysInCurrentMonth;
    
    const activeMonths = Math.max(totalMonths - onHoldMonths, 0.1);
    
    return currentBurn / activeMonths;
  }, [startDate, currentBurn, onHoldMonths]);

  // Calculate months to budget exhaustion
  const monthsToExhaustion = useMemo(() => {
    if (burnRatePerMonth <= 0 || currentBurn >= bmBudget) return 0;
    const remaining = bmBudget - currentBurn;
    return remaining / burnRatePerMonth;
  }, [burnRatePerMonth, currentBurn, bmBudget]);

  // Calculate active months
  const activeMonths = useMemo(() => {
    if (!startDate) return 0;
    const start = parseISO(startDate);
    const now = new Date();
    const months = differenceInMonths(now, start);
    return Math.max(months - onHoldMonths, 0);
  }, [startDate, onHoldMonths]);

  // Adjusted burn percent when proposal is active
  const adjustedBurnPercent = hasActiveProposal && bmBudget > 0 
    ? (currentBurn / bmBudget) * 100 
    : burnPercent;

  // Determine status color
  const getStatusColor = (percent: number) => {
    if (percent > 105) return { bg: 'bg-destructive/10', text: 'text-destructive', stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.2)' };
    if (percent > 80) return { bg: 'bg-warning/10', text: 'text-warning', stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)' };
    return { bg: 'bg-success/10', text: 'text-success', stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.2)' };
  };

  const statusColors = getStatusColor(adjustedBurnPercent);

  // Build larger chart paths
  const chartData = useMemo(() => {
    if (dataPoints.length === 0) {
      return { linePath: '', areaPath: '', budgetLineY: 0, gridLines: [], xLabels: [], yLabels: [] };
    }

    const chartEndValue = hasActiveProposal && rawBurn !== undefined ? rawBurn : currentBurn;
    const maxBurn = Math.max(...dataPoints.map(d => d.burn), chartEndValue, currentBurn);
    const yMax = Math.max(bmBudget * 1.2, maxBurn * 1.2, 1);
    
    const dates = dataPoints.map(d => new Date(d.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates, Date.now());
    const dateRange = maxDate - minDate || 1;

    const scaleX = (date: number) => padding.left + ((date - minDate) / dateRange) * chartWidth;
    const scaleY = (value: number) => padding.top + chartHeight - (value / yMax) * chartHeight;

    // Y-axis grid lines and labels
    const yGridCount = 4;
    const yLabels: { y: number; label: string }[] = [];
    const gridLines: { y: number }[] = [];
    
    for (let i = 0; i <= yGridCount; i++) {
      const value = (yMax / yGridCount) * i;
      const y = scaleY(value);
      gridLines.push({ y });
      // Format large numbers in K notation
      const labelValue = value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toFixed(0);
      yLabels.push({ y, label: labelValue });
    }

    // X-axis labels (first, middle, last)
    const xLabels: { x: number; label: string }[] = [];
    if (dataPoints.length > 0) {
      const firstDate = new Date(dataPoints[0].date);
      const lastDate = new Date(dataPoints[dataPoints.length - 1].date);
      
      xLabels.push({ x: scaleX(firstDate.getTime()), label: format(firstDate, 'MMM yy') });
      if (dataPoints.length > 2) {
        const midIndex = Math.floor(dataPoints.length / 2);
        const midDate = new Date(dataPoints[midIndex].date);
        xLabels.push({ x: scaleX(midDate.getTime()), label: format(midDate, 'MMM yy') });
      }
      xLabels.push({ x: scaleX(lastDate.getTime()), label: format(lastDate, 'MMM yy') });
    }

    const budgetLineY = scaleY(bmBudget);

    // Build paths
    const points = dataPoints.map(d => ({
      x: scaleX(new Date(d.date).getTime()),
      y: scaleY(d.burn),
      isSynthetic: d.isSynthetic,
    }));

    if (points.length < 2) {
      return { linePath: '', areaPath: '', budgetLineY, gridLines, xLabels, yLabels };
    }

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      linePath += ` L ${points[i].x} ${points[i].y}`;
    }

    const bottomY = padding.top + chartHeight;
    let areaPath = `M ${points[0].x} ${bottomY}`;
    areaPath += ` L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      areaPath += ` L ${points[i].x} ${points[i].y}`;
    }
    areaPath += ` L ${points[points.length - 1].x} ${bottomY} Z`;

    // Data point dots (only real snapshots)
    const dots = points.filter((_, i) => !dataPoints[i].isSynthetic);

    return { linePath, areaPath, budgetLineY, gridLines, xLabels, yLabels, dots };
  }, [dataPoints, bmBudget, currentBurn, chartWidth, chartHeight, hasActiveProposal, rawBurn]);

  // WIP/AR/Paid breakdown from latest snapshot
  const latestSnapshot = snapshots.length > 0 
    ? [...snapshots].sort((a, b) => new Date(b.as_of_date).getTime() - new Date(a.as_of_date).getTime())[0]
    : null;

  return (
    <div className="flex flex-col gap-3 min-w-[300px]">
      {/* Header with status */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-md ${statusColors.bg}`}>
        <div className="flex items-center gap-2">
          {adjustedBurnPercent > 100 ? (
            <AlertTriangle className={`h-4 w-4 ${statusColors.text}`} />
          ) : (
            <CheckCircle className={`h-4 w-4 ${statusColors.text}`} />
          )}
          <span className={`font-semibold ${statusColors.text}`}>
            {adjustedBurnPercent.toFixed(0)}% of Budget
          </span>
        </div>
        <span className={`text-sm ${statusColors.text}`}>
          {adjustedBurnPercent > 100 ? 'Over Budget' : adjustedBurnPercent > 80 ? 'Nearing Limit' : 'On Track'}
        </span>
      </div>

      {/* Large detailed chart */}
      <div className="bg-muted/30 rounded-md p-2">
        <svg width={width} height={height} className="overflow-visible">
          {/* Grid lines */}
          {chartData.gridLines?.map((line, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={line.y}
              x2={width - padding.right}
              y2={line.y}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          ))}

          {/* Area fill */}
          {chartData.areaPath && (
            <path d={chartData.areaPath} fill={statusColors.fill} />
          )}

          {/* Main line */}
          {chartData.linePath && (
            <path
              d={chartData.linePath}
              fill="none"
              stroke={statusColors.stroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data point dots */}
          {chartData.dots?.map((dot, i) => (
            <circle
              key={i}
              cx={dot.x}
              cy={dot.y}
              r={3}
              fill={statusColors.stroke}
              stroke="white"
              strokeWidth={1.5}
            />
          ))}

          {/* Budget line */}
          {bmBudget > 0 && chartData.budgetLineY > padding.top && (
            <>
              <line
                x1={padding.left}
                y1={chartData.budgetLineY}
                x2={width - padding.right}
                y2={chartData.budgetLineY}
                stroke="#dc2626"
                strokeWidth={1.5}
                strokeDasharray="4,3"
              />
              <text
                x={width - padding.right + 3}
                y={chartData.budgetLineY + 3}
                fontSize={9}
                fill="#dc2626"
                fontWeight={500}
              >
                Budget
              </text>
            </>
          )}

          {/* Y-axis labels */}
          {chartData.yLabels?.map((label, i) => (
            <text
              key={i}
              x={padding.left - 5}
              y={label.y + 3}
              fontSize={9}
              fill="currentColor"
              opacity={0.5}
              textAnchor="end"
            >
              {label.label}
            </text>
          ))}

          {/* X-axis labels */}
          {chartData.xLabels?.map((label, i) => (
            <text
              key={i}
              x={label.x}
              y={height - 5}
              fontSize={9}
              fill="currentColor"
              opacity={0.5}
              textAnchor="middle"
            >
              {label.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Current Burn */}
        <div className="bg-muted/50 rounded px-2 py-1.5">
          <div className="text-muted-foreground text-[10px]">BM Burn</div>
          <div className="font-semibold">
            {formatCurrency(currentBurn, currency)}
            {hasActiveProposal && proposalWriteOff > 0 && (
              <span className="text-muted-foreground font-normal ml-1">(adj.)</span>
            )}
          </div>
          {usdEquivalent !== undefined && currency !== 'USD' && (
            <div className="text-muted-foreground text-[10px]">
              ≈ {formatCurrency(usdEquivalent, 'USD')}
            </div>
          )}
        </div>

        {/* Budget */}
        <div className="bg-muted/50 rounded px-2 py-1.5">
          <div className="text-muted-foreground text-[10px]">BM Budget</div>
          <div className="font-semibold">{formatCurrency(bmBudget, currency)}</div>
          <div className="text-muted-foreground text-[10px]">
            Remaining: {formatCurrency(Math.max(0, bmBudget - currentBurn), currency)}
          </div>
        </div>

        {/* Burn Rate */}
        <div className="bg-muted/50 rounded px-2 py-1.5">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
            <TrendingUp className="h-3 w-3" />
            Burn Rate
          </div>
          <div className="font-semibold">
            {formatCurrency(burnRatePerMonth, currency)}/mo
          </div>
        </div>

        {/* Runway */}
        <div className="bg-muted/50 rounded px-2 py-1.5">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
            <Clock className="h-3 w-3" />
            Budget Runway
          </div>
          <div className={`font-semibold ${monthsToExhaustion <= 2 ? 'text-destructive' : monthsToExhaustion <= 6 ? 'text-warning' : 'text-success'}`}>
            {currentBurn >= bmBudget 
              ? 'Exhausted' 
              : `${monthsToExhaustion.toFixed(1)}m left`}
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      {latestSnapshot && (
        <div className="border-t pt-2">
          <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">Latest Snapshot Breakdown</div>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <div className="bg-blue-500/10 rounded px-1.5 py-1">
              <div className="text-blue-600 dark:text-blue-400 font-medium">WIP</div>
              <div>{formatCurrency(latestSnapshot.wip_amount || 0, currency)}</div>
            </div>
            <div className="bg-amber-500/10 rounded px-1.5 py-1">
              <div className="text-amber-600 dark:text-amber-400 font-medium">A/R</div>
              <div>{formatCurrency(latestSnapshot.accounts_receivable || 0, currency)}</div>
            </div>
            <div className="bg-green-500/10 rounded px-1.5 py-1">
              <div className="text-green-600 dark:text-green-400 font-medium">Paid</div>
              <div>{formatCurrency(latestSnapshot.paid_amount || 0, currency)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Proposal info if active */}
      {hasActiveProposal && proposalWriteOff > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5 text-xs">
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
            <TrendingDown className="h-3 w-3" />
            Active Write-off Proposal
          </div>
          <div className="text-muted-foreground">
            {formatCurrency(proposalWriteOff, currency)} proposed write-off
          </div>
        </div>
      )}

      {/* Footer metadata */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {startDate ? format(parseISO(startDate), 'dd MMM yyyy') : 'No start date'}
        </div>
        <div>
          {realSnapshotCount} snapshot{realSnapshotCount !== 1 ? 's' : ''} • {activeMonths}m active
          {onHoldMonths > 0 && ` (${onHoldMonths}m hold)`}
        </div>
      </div>
    </div>
  );
}
