import React, { useState, useRef, useCallback } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummarySliderRowProps {
  memberKey: string;
  label: string;
  hours: number;
  rate: number;
  revenue: number;
  isLocked: boolean;
  formatCurrency: (v: number) => string;
  onHoursCommit: (key: string, hours: number) => void;
  onToggleLock: (key: string) => void;
}

const SummarySliderRow = React.memo(function SummarySliderRow({
  memberKey,
  label,
  hours,
  rate,
  revenue,
  isLocked,
  formatCurrency,
  onHoursCommit,
  onToggleLock,
}: SummarySliderRowProps) {
  // Local state for slider dragging — only commits on release
  const [localHours, setLocalHours] = useState<number | null>(null);
  const isDragging = useRef(false);

  const displayHours = localHours !== null ? localHours : hours;
  const displayRevenue = localHours !== null ? localHours * rate : revenue;

  const commitValue = useCallback((val: number) => {
    isDragging.current = false;
    setLocalHours(null);
    onHoursCommit(memberKey, val);
  }, [memberKey, onHoursCommit]);

  return (
    <TableRow>
      <TableCell className="pr-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => onToggleLock(memberKey)}
          title={isLocked ? 'Unlock hours' : 'Lock hours'}
        >
          {isLocked ? (
            <Lock className="h-3.5 w-3.5 text-amber-600" />
          ) : (
            <Unlock className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
        </Button>
      </TableCell>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1">
          <Input
            type="number"
            step="0.5"
            min="0"
            value={displayHours.toFixed(1)}
            onChange={(e) => {
              const val = Math.max(0, parseFloat(e.target.value) || 0);
              onHoursCommit(memberKey, val);
            }}
            className={cn(
              "w-20 h-7 text-right text-sm ml-auto tabular-nums",
              isLocked && "bg-amber-50 dark:bg-amber-950/20 border-amber-300"
            )}
          />
          <input
            type="range"
            min="0"
            max="500"
            step="0.5"
            value={Math.min(displayHours, 500)}
            onMouseDown={() => { isDragging.current = true; }}
            onTouchStart={() => { isDragging.current = true; }}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              if (isDragging.current) {
                setLocalHours(val);
              } else {
                commitValue(val);
              }
            }}
            onMouseUp={(e) => commitValue(parseFloat((e.target as HTMLInputElement).value) || 0)}
            onTouchEnd={(e) => commitValue(parseFloat((e.target as HTMLInputElement).value) || 0)}
            className="w-20 h-2 accent-primary cursor-pointer"
          />
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(rate)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(displayRevenue)}</TableCell>
    </TableRow>
  );
});

export default SummarySliderRow;
