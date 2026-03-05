import { useMemo, useRef, useCallback } from 'react';
import { format, parseISO, differenceInMonths, differenceInDays } from 'date-fns';
import { formatCurrency } from '@/lib/currencyUtils';
import { TrendingUp, TrendingDown, Calendar, Target, Clock, AlertTriangle, CheckCircle, Download } from 'lucide-react';

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
  matterName?: string;
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
  matterName,
}: BurnSparklineDetailedTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  // Larger chart dimensions (1.5x scale)
  const width = 420;
  const height = 210;
  const padding = { top: 25, right: 30, bottom: 40, left: 60 };
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
      return { linePath: '', areaPath: '', budgetLineY: 0, gridLines: [], xLabels: [], yLabels: [], proposalDrop: null };
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
      return { linePath: '', areaPath: '', budgetLineY, gridLines, xLabels, yLabels, proposalDrop: null };
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

    // WIP proposal drop-off visualization
    let proposalDrop: { 
      startX: number; 
      startY: number; 
      endX: number; 
      endY: number;
      rawValue: number;
      adjustedValue: number;
    } | null = null;
    
    // Calculate drop based on proposal write-offs (same logic as main sparkline)
    if (hasActiveProposal && proposalWriteOff > 0 && points.length > 0) {
      const lastPoint = points[points.length - 1];
      const lastDataPoint = dataPoints[dataPoints.length - 1];
      
      // Get raw burn from last snapshot
      const snapshotBurn = lastDataPoint?.burn || 0;
      
      // Adjusted burn is snapshot burn minus write-offs
      const adjustedBurn = Math.max(0, snapshotBurn - proposalWriteOff);
      
      // Add offset to the right for the proposal point
      const proposalX = Math.min(lastPoint.x + 20, width - padding.right - 5);
      
      proposalDrop = {
        startX: lastPoint.x,
        startY: scaleY(snapshotBurn),
        endX: proposalX,
        endY: scaleY(adjustedBurn),
        rawValue: snapshotBurn,
        adjustedValue: adjustedBurn,
      };
    }

    return { linePath, areaPath, budgetLineY, gridLines, xLabels, yLabels, dots, proposalDrop };
  }, [dataPoints, bmBudget, currentBurn, chartWidth, chartHeight, hasActiveProposal, rawBurn, proposalWriteOff, width]);

  // Real (non-synthetic) data points for the history table
  const realDataPoints = useMemo(() => 
    dataPoints.filter(d => !d.isSynthetic), 
    [dataPoints]
  );

  // Canvas-based PNG export
  const handleDownload = useCallback(async () => {
    const svgEl = tooltipRef.current?.querySelector('svg');
    if (!svgEl) return;

    const svgWidth = width;
    const svgHeight = height;
    const tableRowHeight = 18;
    const tableHeaderHeight = 24;
    const tablePaddingTop = 20;
    const titleHeight = 40;
    const metricsHeight = 60;
    const tableHeight = tablePaddingTop + tableHeaderHeight + (realDataPoints.length * tableRowHeight) + 10;
    const canvasWidth = Math.max(svgWidth + 60, 500);
    const canvasHeight = titleHeight + svgHeight + metricsHeight + tableHeight + 30;

    const canvas = document.createElement('canvas');
    const scale = 2; // retina
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Title
    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(matterName ? `WIP Burn — ${matterName}` : 'WIP Burn Chart', 20, 26);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`${currency} • ${adjustedBurnPercent.toFixed(0)}% of budget used`, 20, 40);

    // Draw SVG chart onto canvas
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 20, titleHeight, svgWidth, svgHeight);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });

    const metricsY = titleHeight + svgHeight + 20;
    
    // Key metrics row
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(`Burn: ${formatCurrency(currentBurn, currency)}`, 20, metricsY);
    ctx.fillText(`Budget: ${formatCurrency(bmBudget, currency)}`, 180, metricsY);
    ctx.fillText(`Remaining: ${formatCurrency(Math.max(0, bmBudget - currentBurn), currency)}`, 340, metricsY);
    
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`Rate: ${formatCurrency(burnRatePerMonth, currency)}/mo`, 20, metricsY + 16);
    ctx.fillText(`Runway: ${currentBurn >= bmBudget ? 'Exhausted' : monthsToExhaustion.toFixed(1) + 'm'}`, 180, metricsY + 16);
    ctx.fillText(`Snapshots: ${realDataPoints.length}`, 340, metricsY + 16);

    // Data table
    const tableY = metricsY + metricsHeight;
    
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText('Budget Usage Build-Up', 20, tableY);

    // Table headers
    const headerY = tableY + tableHeaderHeight;
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(20, headerY - 14, canvasWidth - 40, 18);
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = '#374151';
    ctx.fillText('Date', 28, headerY);
    ctx.fillText('Cumulative Burn', 160, headerY);
    ctx.fillText('Budget Used %', 320, headerY);

    // Table rows
    ctx.font = '10px system-ui, sans-serif';
    realDataPoints.forEach((dp, i) => {
      const rowY = headerY + ((i + 1) * tableRowHeight);
      
      // Alternating row background
      if (i % 2 === 0) {
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(20, rowY - 12, canvasWidth - 40, tableRowHeight);
      }
      
      const pct = bmBudget > 0 ? ((dp.burn / bmBudget) * 100).toFixed(1) : '0.0';
      
      ctx.fillStyle = '#374151';
      ctx.fillText(format(parseISO(dp.date), 'dd MMM yyyy'), 28, rowY);
      ctx.fillText(formatCurrency(dp.burn, currency), 160, rowY);
      
      // Color-code percentage
      const pctNum = parseFloat(pct);
      ctx.fillStyle = pctNum > 105 ? '#ef4444' : pctNum > 80 ? '#f59e0b' : '#22c55e';
      ctx.fillText(`${pct}%`, 320, rowY);
    });

    // Trigger download
    const link = document.createElement('a');
    const safeName = (matterName || 'wip-chart').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-');
    link.download = `${safeName}-burn-report.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [width, height, realDataPoints, currency, currentBurn, bmBudget, burnRatePerMonth, monthsToExhaustion, adjustedBurnPercent, matterName]);

  // WIP/AR/Paid breakdown from latest snapshot
  const latestSnapshot = snapshots.length > 0 
    ? [...snapshots].sort((a, b) => new Date(b.as_of_date).getTime() - new Date(a.as_of_date).getTime())[0]
    : null;

  return (
    <div ref={tooltipRef} className="flex flex-col gap-4 min-w-[450px]">
      {/* Header with status */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-lg ${statusColors.bg}`}>
        <div className="flex items-center gap-3">
          {adjustedBurnPercent > 100 ? (
            <AlertTriangle className={`h-5 w-5 ${statusColors.text}`} />
          ) : (
            <CheckCircle className={`h-5 w-5 ${statusColors.text}`} />
          )}
          <span className={`text-base font-semibold ${statusColors.text}`}>
            {adjustedBurnPercent.toFixed(0)}% of Budget
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${statusColors.text}`}>
            {adjustedBurnPercent > 100 ? 'Over Budget' : adjustedBurnPercent > 80 ? 'Nearing Limit' : 'On Track'}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            className="p-1 rounded hover:bg-background/50 transition-colors"
            title="Download as PNG"
          >
            <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>

      {/* Large detailed chart */}
      <div className="bg-muted/30 rounded-lg p-3">
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

          {/* WIP Proposal drop-off visualization */}
          {chartData.proposalDrop && (
            <>
              {/* Dashed line from raw burn to adjusted burn */}
              <line
                x1={chartData.proposalDrop.startX}
                y1={chartData.proposalDrop.startY}
                x2={chartData.proposalDrop.endX}
                y2={chartData.proposalDrop.endY}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4,2"
                strokeLinecap="round"
              />
              {/* Raw burn point (hollow) */}
              <circle
                cx={chartData.proposalDrop.startX}
                cy={chartData.proposalDrop.startY}
                r={4}
                fill="white"
                stroke="#f59e0b"
                strokeWidth={2}
              />
              {/* Adjusted burn point (filled) */}
              <circle
                cx={chartData.proposalDrop.endX}
                cy={chartData.proposalDrop.endY}
                r={5}
                fill="#f59e0b"
                stroke="white"
                strokeWidth={2}
              />
              {/* Drop arrow indicator */}
              <path
                d={`M ${chartData.proposalDrop.endX - 3} ${chartData.proposalDrop.endY - 8} 
                    L ${chartData.proposalDrop.endX} ${chartData.proposalDrop.endY - 4} 
                    L ${chartData.proposalDrop.endX + 3} ${chartData.proposalDrop.endY - 8}`}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Label for proposal */}
              <text
                x={chartData.proposalDrop.endX}
                y={chartData.proposalDrop.endY + 16}
                fontSize={10}
                fill="#f59e0b"
                textAnchor="middle"
                fontWeight={500}
              >
                Proposed
              </text>
            </>
          )}

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
                x={width - padding.right + 5}
                y={chartData.budgetLineY + 4}
                fontSize={11}
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
              x={padding.left - 8}
              y={label.y + 4}
              fontSize={11}
              fill="currentColor"
              opacity={0.6}
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
              y={height - 8}
              fontSize={11}
              fill="currentColor"
              opacity={0.6}
              textAnchor="middle"
            >
              {label.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Current Burn */}
        <div className="bg-muted/50 rounded-lg px-3 py-2">
          <div className="text-muted-foreground text-xs mb-0.5">BM Burn</div>
          <div className="font-semibold text-base">
            {formatCurrency(currentBurn, currency)}
            {hasActiveProposal && proposalWriteOff > 0 && (
              <span className="text-muted-foreground font-normal text-sm ml-1">(adj.)</span>
            )}
          </div>
          {usdEquivalent !== undefined && currency !== 'USD' && (
            <div className="text-muted-foreground text-xs">
              ≈ {formatCurrency(usdEquivalent, 'USD')}
            </div>
          )}
        </div>

        {/* Budget */}
        <div className="bg-muted/50 rounded-lg px-3 py-2">
          <div className="text-muted-foreground text-xs mb-0.5">BM Budget</div>
          <div className="font-semibold text-base">{formatCurrency(bmBudget, currency)}</div>
          <div className="text-muted-foreground text-xs">
            Remaining: {formatCurrency(Math.max(0, bmBudget - currentBurn), currency)}
          </div>
        </div>

        {/* Burn Rate */}
        <div className="bg-muted/50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Burn Rate
          </div>
          <div className="font-semibold text-base">
            {formatCurrency(burnRatePerMonth, currency)}/mo
          </div>
        </div>

        {/* Runway */}
        <div className="bg-muted/50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
            <Clock className="h-3.5 w-3.5" />
            Budget Runway
          </div>
          <div className={`font-semibold text-base ${monthsToExhaustion <= 2 ? 'text-destructive' : monthsToExhaustion <= 6 ? 'text-warning' : 'text-success'}`}>
            {currentBurn >= bmBudget 
              ? 'Exhausted' 
              : `${monthsToExhaustion.toFixed(1)}m left`}
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      {latestSnapshot && (
        <div className="border-t pt-3">
          <div className="text-xs text-muted-foreground mb-2 font-medium">Latest Snapshot Breakdown</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-blue-500/10 rounded-lg px-2.5 py-1.5">
              <div className="text-blue-600 dark:text-blue-400 font-medium text-xs">WIP</div>
              <div className="font-semibold">{formatCurrency(latestSnapshot.wip_amount || 0, currency)}</div>
            </div>
            <div className="bg-amber-500/10 rounded-lg px-2.5 py-1.5">
              <div className="text-amber-600 dark:text-amber-400 font-medium text-xs">A/R</div>
              <div className="font-semibold">{formatCurrency(latestSnapshot.accounts_receivable || 0, currency)}</div>
            </div>
            <div className="bg-green-500/10 rounded-lg px-2.5 py-1.5">
              <div className="text-green-600 dark:text-green-400 font-medium text-xs">Paid</div>
              <div className="font-semibold">{formatCurrency(latestSnapshot.paid_amount || 0, currency)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Proposal info if active */}
      {hasActiveProposal && proposalWriteOff > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-sm">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
            <TrendingDown className="h-4 w-4" />
            Active Write-off Proposal
          </div>
          <div className="text-muted-foreground mt-0.5">
            {formatCurrency(proposalWriteOff, currency)} proposed write-off
          </div>
        </div>
      )}

      {/* Data-point history table */}
      {realDataPoints.length > 0 && (
        <div className="border-t pt-3">
          <div className="text-xs text-muted-foreground mb-2 font-medium">Budget Usage Build-Up</div>
          <div className="max-h-[140px] overflow-y-auto rounded border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/70">
                  <th className="text-left px-2 py-1 font-medium text-muted-foreground">Date</th>
                  <th className="text-right px-2 py-1 font-medium text-muted-foreground">Cumulative Burn</th>
                  <th className="text-right px-2 py-1 font-medium text-muted-foreground">Budget Used</th>
                </tr>
              </thead>
              <tbody>
                {realDataPoints.map((dp, i) => {
                  const pct = bmBudget > 0 ? ((dp.burn / bmBudget) * 100) : 0;
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                      <td className="px-2 py-0.5 text-muted-foreground">{format(parseISO(dp.date), 'dd MMM yyyy')}</td>
                      <td className="px-2 py-0.5 text-right font-medium">{formatCurrency(dp.burn, currency)}</td>
                      <td className={`px-2 py-0.5 text-right font-medium ${pct > 105 ? 'text-destructive' : pct > 80 ? 'text-warning' : 'text-success'}`}>
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer metadata */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
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
