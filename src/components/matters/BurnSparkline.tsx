import { useMemo } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { formatCurrency } from '@/lib/currencyUtils';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { BurnSparklineDetailedTooltip } from './BurnSparklineDetailedTooltip';
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

interface BurnSparklineProps {
  snapshots: SnapshotPoint[];
  bmBudget: number;
  currentBurn: number;
  currency: string;
  burnPercent: number;
  usdEquivalent?: number;
  startDate?: string | null;
  onHoldMonths?: number;
  /** Whether a WIP proposal is currently active for this matter */
  hasActiveProposal?: boolean;
  /** The proposal data with write-off amounts */
  proposalData?: ProposalData | null;
  /** The raw burn amount before proposal adjustments */
  rawBurn?: number;
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
  hasActiveProposal = false,
  proposalData,
  rawBurn,
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
      // For snapshots, wip_amount IS already NET (report already reduced it)
      // Write-off is tracked separately for realization only, not subtracted again
      const netWip = snap.wip_amount || 0;
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
  // Red only shows at 105%+ (marginally over budget is not alarming)
  const getColor = (percent: number) => {
    if (percent > 105) return { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444', stripeColor: '#ef4444' }; // red
    if (percent > 80) return { fill: 'rgba(245, 158, 11, 0.3)', stroke: '#f59e0b', stripeColor: '#f59e0b' }; // orange/warning
    return { fill: 'rgba(34, 197, 94, 0.3)', stroke: '#22c55e', stripeColor: '#22c55e' }; // green/success
  };

  // Calculate the adjusted burn percent based on proposal if active
  const adjustedBurnPercent = useMemo(() => {
    if (hasActiveProposal && bmBudget > 0) {
      return (currentBurn / bmBudget) * 100;
    }
    return burnPercent;
  }, [hasActiveProposal, currentBurn, bmBudget, burnPercent]);

  // Use adjusted colors when proposal is active
  const colors = hasActiveProposal ? getColor(adjustedBurnPercent) : getColor(burnPercent);
  
  // Generate unique ID for this sparkline's pattern
  const patternId = useMemo(() => `stripe-pattern-${Math.random().toString(36).substr(2, 9)}`, []);

  // Count real snapshots for tooltip
  const realSnapshotCount = dataPoints.filter(d => !d.isSynthetic).length;

  // Build SVG path with proposal drop support
  const { pathD, areaD, budgetLineY, dotPosition, dropSegment, proposalAreaD } = useMemo(() => {
    if (dataPoints.length === 0) {
      return { pathD: '', areaD: '', budgetLineY: 0, dotPosition: null, dropSegment: null, proposalAreaD: '' };
    }

    // Use rawBurn for the historical chart if we have a proposal, otherwise use currentBurn
    const chartEndValue = hasActiveProposal && rawBurn !== undefined ? rawBurn : currentBurn;

    // Determine Y scale - max of budget or highest burn value (use raw burn for scaling)
    const maxBurn = Math.max(...dataPoints.map(d => d.burn), chartEndValue, currentBurn);
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
      return { pathD: '', areaD: '', budgetLineY: budgetY, dotPosition: null, dropSegment: null, proposalAreaD: '' };
    }

    // For single point (after extrapolation), still try to show a line from zero
    if (points.length === 1) {
      return {
        pathD: '',
        areaD: '',
        budgetLineY: budgetY,
        dotPosition: { x: width / 2, y: scaleY(dataPoints[0].burn) },
        dropSegment: null,
        proposalAreaD: '',
      };
    }

    // Line path (historical data)
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      linePath += ` L ${points[i].x} ${points[i].y}`;
    }

    // Area path (fill under the historical line)
    const bottomY = padding.top + chartHeight;
    let areaPath = `M ${points[0].x} ${bottomY}`;
    areaPath += ` L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      areaPath += ` L ${points[i].x} ${points[i].y}`;
    }
    areaPath += ` L ${points[points.length - 1].x} ${bottomY} Z`;

    // Calculate drop segment and proposal area if we have an active proposal
    let drop = null;
    let proposalArea = '';
    
    // When proposal is active, calculate the write-off amount to show the drop
    if (hasActiveProposal && proposalData) {
      const totalWriteOff = (proposalData.wip_write_off_amount || 0) + (proposalData.ar_write_off_amount || 0);
      
      // If there's any write-off in the proposal, show the drop segment
      if (totalWriteOff > 0) {
        const lastPoint = points[points.length - 1];
        
        // Calculate raw burn from the last snapshot data point
        // (the dataPoints are built from snapshots which have raw values)
        const lastDataPoint = dataPoints[dataPoints.length - 1];
        const snapshotBurn = lastDataPoint?.burn || 0;
        
        // The adjusted burn is the snapshot burn minus the write-offs
        const adjustedBurn = snapshotBurn - totalWriteOff;
        
        const rawY = scaleY(snapshotBurn);
        const adjustedY = scaleY(Math.max(0, adjustedBurn));
        
        // Drop segment: from raw burn point down to adjusted value
        drop = {
          x1: lastPoint.x,
          y1: rawY,
          x2: lastPoint.x,
          y2: adjustedY,
        };
        
        // Create a "proposal area" that shows the adjusted fill region
        proposalArea = `M ${points[0].x} ${bottomY}`;
        proposalArea += ` L ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length - 1; i++) {
          proposalArea += ` L ${points[i].x} ${points[i].y}`;
        }
        // Connect to the adjusted endpoint
        proposalArea += ` L ${lastPoint.x} ${adjustedY}`;
        proposalArea += ` L ${lastPoint.x} ${bottomY} Z`;
      }
    }

    return {
      pathD: linePath,
      areaD: areaPath,
      budgetLineY: budgetY,
      dotPosition: null,
      dropSegment: drop,
      proposalAreaD: proposalArea,
    };
  }, [dataPoints, bmBudget, currentBurn, chartWidth, chartHeight, width, hasActiveProposal, proposalData]);

  // Calculate the total write-off from proposal for tooltip display
  const proposalWriteOff = proposalData 
    ? (proposalData.wip_write_off_amount || 0) + (proposalData.ar_write_off_amount || 0)
    : 0;
  
  // Tooltip content
  const tooltipContent = (
    <div className="flex flex-col gap-1 text-xs">
      <div className="font-medium text-foreground">
        {formatCurrency(currentBurn, currency)}
        {hasActiveProposal && proposalWriteOff > 0 && (
          <span className="text-muted-foreground font-normal ml-1">
            (adj.)
          </span>
        )}
      </div>
      {hasActiveProposal && proposalWriteOff > 0 && (
        <div className="text-muted-foreground text-[10px]">
          Write-off: {formatCurrency(proposalWriteOff, currency)}
        </div>
      )}
      {usdEquivalent !== undefined && currency !== 'USD' && (
        <div className="text-muted-foreground">
          ≈ {formatCurrency(usdEquivalent, 'USD')}
        </div>
      )}
      <div className={
        adjustedBurnPercent > 105 ? 'text-destructive' :
        adjustedBurnPercent > 80 ? 'text-warning' : 'text-success'
      }>
        {adjustedBurnPercent.toFixed(0)}% of budget
        {hasActiveProposal && (
          <span className="text-muted-foreground ml-1">(with proposal)</span>
        )}
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
        <BurnSparklineDetailedTooltip
          snapshots={snapshots}
          bmBudget={bmBudget}
          currentBurn={currentBurn}
          currency={currency}
          burnPercent={burnPercent}
          usdEquivalent={usdEquivalent}
          startDate={startDate}
          onHoldMonths={onHoldMonths}
          hasActiveProposal={hasActiveProposal}
          proposalData={proposalData}
          rawBurn={rawBurn}
          dataPoints={dataPoints}
        />
      </HoverCardContent>
    </HoverCard>
  );
  }

  return (
    <HoverCard openDelay={100} closeDelay={50}>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer flex flex-col items-end">
          <svg width={width} height={height} className="overflow-visible">
            {/* Define stripe pattern for proposal areas */}
            {/* Define stripe pattern for proposal areas - bold diagonal stripes */}
            <defs>
              <pattern
                id={patternId}
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill={colors.fill} />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke={colors.stripeColor}
                  strokeWidth="3"
                  strokeOpacity="0.7"
                />
              </pattern>
            </defs>
            
            {/* Area fill - use stripes when proposal is active */}
            {hasActiveProposal ? (
              <>
                {/* When we have a drop, show solid fill for adjusted area and stripes for the "written off" portion */}
                {proposalAreaD ? (
                  <>
                    {/* Solid fill for the adjusted (proposal) area */}
                    <path
                      d={proposalAreaD}
                      fill={colors.fill}
                    />
                    {/* Striped overlay for the entire historical area to show proposal is applied */}
                    <path
                      d={areaD}
                      fill={`url(#${patternId})`}
                    />
                  </>
                ) : (
                  /* No drop segment but proposal is active - show striped fill */
                  <path
                    d={areaD}
                    fill={`url(#${patternId})`}
                  />
                )}
              </>
            ) : (
              <path
                d={areaD}
                fill={colors.fill}
              />
            )}
            
            {/* Line */}
            <path
              d={pathD}
              fill="none"
              stroke={colors.stroke}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Drop segment - shows the proposal adjustment with prominent styling */}
            {dropSegment && (
              <>
                {/* Background glow for visibility */}
                <line
                  x1={dropSegment.x1}
                  y1={dropSegment.y1}
                  x2={dropSegment.x2}
                  y2={dropSegment.y2}
                  stroke="white"
                  strokeWidth={4}
                  strokeOpacity={0.8}
                />
                {/* Main drop line - thick dashed line */}
                <line
                  x1={dropSegment.x1}
                  y1={dropSegment.y1}
                  x2={dropSegment.x2}
                  y2={dropSegment.y2}
                  stroke={colors.stroke}
                  strokeWidth={2.5}
                  strokeDasharray="3,2"
                  strokeLinecap="round"
                />
                {/* Arrow head at the adjusted endpoint */}
                <circle
                  cx={dropSegment.x2}
                  cy={dropSegment.y2}
                  r={4}
                  fill={colors.stroke}
                  stroke="white"
                  strokeWidth={1.5}
                />
                {/* Small dot at the raw burn point */}
                <circle
                  cx={dropSegment.x1}
                  cy={dropSegment.y1}
                  r={2}
                  fill={colors.stroke}
                />
              </>
            )}
            
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
        <BurnSparklineDetailedTooltip
          snapshots={snapshots}
          bmBudget={bmBudget}
          currentBurn={currentBurn}
          currency={currency}
          burnPercent={burnPercent}
          usdEquivalent={usdEquivalent}
          startDate={startDate}
          onHoldMonths={onHoldMonths}
          hasActiveProposal={hasActiveProposal}
          proposalData={proposalData}
          rawBurn={rawBurn}
          dataPoints={dataPoints}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
