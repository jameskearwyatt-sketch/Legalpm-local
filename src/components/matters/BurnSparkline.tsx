import { useMemo } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { formatCurrency } from '@/lib/currencyUtils';
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
  onHoldMonths?: number;
}

interface DataPoint {
  date: string;
  burn: number;
  isSynthetic?: boolean;
}

export function BurnSparkline({
  snapshots,
  bmBudget,
  currentBurn,
  currency,
  burnPercent,
  usdEquivalent,
  startDate,
  onHoldMonths = 0,
}: BurnSparklineProps) {
  // Dimensions for the sparkline
  const width = 90;
  const height = 24;
  const padding = { top: 2, right: 2, bottom: 2, left: 2 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate burn rate per month for extrapolation
  const burnRatePerMonth = useMemo(() => {
    if (!startDate || currentBurn <= 0) return 0;
    
    const start = parseISO(startDate);
    const now = new Date();
    
    // Calculate months elapsed
    const yearDiff = now.getFullYear() - start.getFullYear();
    const monthDiff = now.getMonth() - start.getMonth();
    const dayDiff = now.getDate() - start.getDate();
    let totalMonths = yearDiff * 12 + monthDiff;
    const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    totalMonths += dayDiff / daysInCurrentMonth;
    
    // Subtract on-hold months
    const activeMonths = Math.max(totalMonths - onHoldMonths, 0.1);
    
    return currentBurn / activeMonths;
  }, [startDate, currentBurn, onHoldMonths]);

  // Calculate burn for each snapshot and add synthetic historical points
  const dataPoints = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    
    // Sort by date ascending
    const sorted = [...snapshots].sort((a, b) => 
      new Date(a.as_of_date).getTime() - new Date(b.as_of_date).getTime()
    );

    const realPoints: DataPoint[] = sorted.map(snap => {
      const netWip = (snap.wip_amount || 0) - (snap.wip_write_off_amount || 0);
      const burn = netWip + (snap.accounts_receivable || 0) + (snap.paid_amount || 0);
      return {
        date: snap.as_of_date,
        burn,
        isSynthetic: false,
      };
    });

    // If we have a start date and burn rate, extrapolate backwards to zero
    if (startDate && burnRatePerMonth > 0 && realPoints.length > 0) {
      const startDateParsed = parseISO(startDate);
      const firstRealPoint = realPoints[0];
      const firstRealDate = parseISO(firstRealPoint.date);
      
      // Only extrapolate if the first snapshot is after the start date
      if (firstRealDate > startDateParsed) {
        const syntheticPoints: DataPoint[] = [];
        
        // Always add a zero point at start date
        syntheticPoints.push({
          date: startDate,
          burn: 0,
          isSynthetic: true,
        });
        
        // Calculate how many months between start and first real snapshot
        const daysBetween = differenceInDays(firstRealDate, startDateParsed);
        const monthsBetween = daysBetween / 30.44; // Average days per month
        
        // Generate intermediate points using burn rate, walking forward from zero
        // We'll add points roughly monthly, stopping when we reach the first real snapshot
        if (monthsBetween > 1) {
          const numIntermediatePoints = Math.min(Math.floor(monthsBetween), 6); // Cap at 6 points
          
          for (let i = 1; i <= numIntermediatePoints; i++) {
            const fraction = i / (numIntermediatePoints + 1);
            const pointDate = new Date(startDateParsed.getTime() + fraction * daysBetween * 24 * 60 * 60 * 1000);
            const estimatedBurn = Math.min(fraction * firstRealPoint.burn, firstRealPoint.burn);
            
            syntheticPoints.push({
              date: pointDate.toISOString().split('T')[0],
              burn: Math.max(0, estimatedBurn),
              isSynthetic: true,
            });
          }
        }
        
        // Prepend synthetic points to real points
        return [...syntheticPoints, ...realPoints];
      }
    }

    return realPoints;
  }, [snapshots, startDate, burnRatePerMonth]);

  // Determine color based on burn percentage
  const getColor = (percent: number) => {
    if (percent > 100) return { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444' }; // red
    if (percent > 80) return { fill: 'rgba(245, 158, 11, 0.3)', stroke: '#f59e0b' }; // orange/warning
    return { fill: 'rgba(34, 197, 94, 0.3)', stroke: '#22c55e' }; // green/success
  };

  const colors = getColor(burnPercent);

  // Count real snapshots for tooltip
  const realSnapshotCount = dataPoints.filter(d => !d.isSynthetic).length;

  // Build SVG path
  const { pathD, areaD, budgetLineY, dotPosition } = useMemo(() => {
    if (dataPoints.length === 0) {
      return { pathD: '', areaD: '', budgetLineY: 0, dotPosition: null };
    }

    // Determine Y scale - max of budget or highest burn value
    const maxBurn = Math.max(...dataPoints.map(d => d.burn), currentBurn);
    const yMax = Math.max(bmBudget * 1.1, maxBurn * 1.1, 1); // At least show some range
    
    // X scale - time range (always start from startDate if available, otherwise first data point)
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

    // For single point (after extrapolation), still try to show a line from zero
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
      {realSnapshotCount > 0 && (
        <div className="text-muted-foreground text-[10px] mt-1 pt-1 border-t">
          {realSnapshotCount} snapshot{realSnapshotCount !== 1 ? 's' : ''} 
          {startDate && ` since ${format(parseISO(startDate), 'MMM yyyy')}`}
        </div>
      )}
    </div>
  );

  // Check if start date or budget is missing
  const missingStartDate = !startDate;
  const missingBudget = !bmBudget || bmBudget <= 0;

  // Render single dot for matters with only 1 real snapshot and no extrapolation possible
  if (dataPoints.length <= 1) {
    const dotX = width / 2;
    
    return (
      <HoverCard openDelay={100} closeDelay={50}>
        <HoverCardTrigger asChild>
          <div className="cursor-pointer flex flex-col items-end">
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
            {missingStartDate && (
              <span className="text-[8px] text-muted-foreground/70 italic leading-none">
                Start date required
              </span>
            )}
            {missingBudget && (
              <span className="text-[8px] text-muted-foreground/70 italic leading-none">
                Budget required
              </span>
            )}
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
        <div className="cursor-pointer flex flex-col items-end">
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
          {missingStartDate && (
            <span className="text-[8px] text-muted-foreground/70 italic leading-none">
              Start date required
            </span>
          )}
          {missingBudget && (
            <span className="text-[8px] text-muted-foreground/70 italic leading-none">
              Budget required
            </span>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="left" className="w-auto p-3">
        {tooltipContent}
      </HoverCardContent>
    </HoverCard>
  );
}
