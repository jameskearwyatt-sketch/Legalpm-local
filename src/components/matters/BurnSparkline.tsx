import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { formatCurrency, convertToUsd } from '@/lib/currencyUtils';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

interface SnapshotPoint {
  as_of_date: string;
  wip_amount: number;
  accounts_receivable: number;
  paid_amount: number;
  wip_write_off_amount?: number;
}

interface BurnSparklineProps {
  snapshots: SnapshotPoint[];
  bmBudget: number;
  currentBurn: number;
  currency: string;
  burnPercent: number;
  usdEquivalent?: number;
  startDate?: string | null;
}

export function BurnSparkline({
  snapshots,
  bmBudget,
  currentBurn,
  currency,
  burnPercent,
  usdEquivalent,
  startDate,
}: BurnSparklineProps) {
  // Dimensions for the sparkline
  const width = 90;
  const height = 24;
  const padding = { top: 2, right: 2, bottom: 2, left: 2 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate burn for each snapshot
  const dataPoints = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    
    // Sort by date ascending
    const sorted = [...snapshots].sort((a, b) => 
      new Date(a.as_of_date).getTime() - new Date(b.as_of_date).getTime()
    );

    return sorted.map(snap => {
      const netWip = (snap.wip_amount || 0) - (snap.wip_write_off_amount || 0);
      const burn = netWip + (snap.accounts_receivable || 0) + (snap.paid_amount || 0);
      return {
        date: snap.as_of_date,
        burn,
      };
    });
  }, [snapshots]);

  // Determine color based on burn percentage
  const getColor = (percent: number) => {
    if (percent > 100) return { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444' }; // red
    if (percent > 80) return { fill: 'rgba(245, 158, 11, 0.3)', stroke: '#f59e0b' }; // orange/warning
    return { fill: 'rgba(34, 197, 94, 0.3)', stroke: '#22c55e' }; // green/success
  };

  const colors = getColor(burnPercent);

  // Build SVG path
  const { pathD, areaD, budgetLineY, dotPosition } = useMemo(() => {
    if (dataPoints.length === 0) {
      return { pathD: '', areaD: '', budgetLineY: 0, dotPosition: null };
    }

    // Determine Y scale - max of budget or highest burn value
    const maxBurn = Math.max(...dataPoints.map(d => d.burn), currentBurn);
    const yMax = Math.max(bmBudget * 1.1, maxBurn * 1.1, 1); // At least show some range
    
    // X scale - time range
    const dates = dataPoints.map(d => new Date(d.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates, Date.now());
    const dateRange = maxDate - minDate || 1;

    // Scale functions
    const scaleX = (date: number) => {
      return padding.left + ((date - minDate) / dateRange) * chartWidth;
    };
    const scaleY = (value: number) => {
      return padding.top + chartHeight - (value / yMax) * chartHeight;
    };

    // Budget line Y position
    const budgetY = scaleY(bmBudget);

    // Build line path
    const points = dataPoints.map(d => ({
      x: scaleX(new Date(d.date).getTime()),
      y: scaleY(d.burn),
    }));

    if (points.length === 0) {
      return { pathD: '', areaD: '', budgetLineY: budgetY, dotPosition: null };
    }

    // For single point, just return dot position
    if (points.length === 1) {
      return {
        pathD: '',
        areaD: '',
        budgetLineY: budgetY,
        dotPosition: { x: width / 2, y: scaleY(dataPoints[0].burn) },
      };
    }

    // Line path
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      linePath += ` L ${points[i].x} ${points[i].y}`;
    }

    // Area path (fill under the line)
    const bottomY = padding.top + chartHeight;
    let areaPath = `M ${points[0].x} ${bottomY}`;
    areaPath += ` L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      areaPath += ` L ${points[i].x} ${points[i].y}`;
    }
    areaPath += ` L ${points[points.length - 1].x} ${bottomY} Z`;

    return {
      pathD: linePath,
      areaD: areaPath,
      budgetLineY: budgetY,
      dotPosition: null,
    };
  }, [dataPoints, bmBudget, currentBurn, chartWidth, chartHeight, width]);

  // Tooltip content
  const tooltipContent = (
    <div className="flex flex-col gap-1 text-xs">
      <div className="font-medium text-foreground">
        {formatCurrency(currentBurn, currency)}
      </div>
      {usdEquivalent !== undefined && currency !== 'USD' && (
        <div className="text-muted-foreground">
          ≈ {formatCurrency(usdEquivalent, 'USD')}
        </div>
      )}
      <div className={
        burnPercent > 100 ? 'text-destructive' :
        burnPercent > 80 ? 'text-warning' : 'text-success'
      }>
        {burnPercent.toFixed(0)}% of budget
      </div>
      {dataPoints.length > 0 && (
        <div className="text-muted-foreground text-[10px] mt-1 pt-1 border-t">
          {dataPoints.length} snapshot{dataPoints.length !== 1 ? 's' : ''} 
          {startDate && ` since ${format(parseISO(startDate), 'MMM yyyy')}`}
        </div>
      )}
    </div>
  );

  // Render single dot for matters with only 1 snapshot
  if (dataPoints.length <= 1) {
    const dotY = dotPosition?.y ?? height / 2;
    const dotX = width / 2;
    
    return (
      <HoverCard openDelay={100} closeDelay={50}>
        <HoverCardTrigger asChild>
          <div className="cursor-pointer flex items-center justify-end">
            <svg width={width} height={height} className="overflow-visible">
              {/* Budget line */}
              {bmBudget > 0 && (
                <line
                  x1={padding.left}
                  y1={budgetLineY}
                  x2={width - padding.right}
                  y2={budgetLineY}
                  stroke="#dc2626"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                  opacity={0.6}
                />
              )}
              {/* Single dot - larger and more visible */}
              <circle
                cx={dotX}
                cy={dotPosition?.y ?? (height / 2)}
                r={5}
                fill={colors.stroke}
                stroke={colors.stroke}
                strokeWidth={2}
              />
              {/* Outer ring for visibility */}
              <circle
                cx={dotX}
                cy={dotPosition?.y ?? (height / 2)}
                r={7}
                fill="none"
                stroke={colors.stroke}
                strokeWidth={1}
                opacity={0.4}
              />
            </svg>
          </div>
        </HoverCardTrigger>
        <HoverCardContent side="left" className="w-auto p-3">
          {tooltipContent}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return (
    <HoverCard openDelay={100} closeDelay={50}>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer flex items-center justify-end">
          <svg width={width} height={height} className="overflow-visible">
            {/* Area fill */}
            <path
              d={areaD}
              fill={colors.fill}
            />
            {/* Line */}
            <path
              d={pathD}
              fill="none"
              stroke={colors.stroke}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Budget threshold line */}
            {bmBudget > 0 && budgetLineY > padding.top && budgetLineY < height - padding.bottom && (
              <line
                x1={padding.left}
                y1={budgetLineY}
                x2={width - padding.right}
                y2={budgetLineY}
                stroke="#dc2626"
                strokeWidth={1}
                strokeDasharray="2,2"
                opacity={0.6}
              />
            )}
          </svg>
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="left" className="w-auto p-3">
        {tooltipContent}
      </HoverCardContent>
    </HoverCard>
  );
}
