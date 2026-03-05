import React, { useState, useRef, useCallback } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SummarySliderRowProps {
  memberKey: string;
  label: string;
  hours: number;
  rate: number;
  revenue: number;
  maxHours: number;
  formatCurrency: (v: number) => string;
  onHoursCommit: (key: string, hours: number) => void;
}

const SummarySliderRow = React.memo(function SummarySliderRow({
  memberKey,
  label,
  hours,
  rate,
  revenue,
  maxHours,
  formatCurrency,
  onHoursCommit,
}: SummarySliderRowProps) {
  const [localHours, setLocalHours] = useState<number | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const isDragging = useRef(false);
  const commitTimer = useRef<ReturnType<typeof setTimeout>>();

  const displayHours = localHours !== null ? localHours : hours;
  const displayRevenue = localHours !== null ? localHours * rate : revenue;
  const sliderMax = Math.max(Math.ceil(maxHours), 1);

  const commitValue = useCallback((val: number) => {
    isDragging.current = false;
    setLocalHours(null);
    onHoursCommit(memberKey, val);
  }, [memberKey, onHoursCommit]);

  // Debounced commit for number input (allows spinner arrows to work)
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, parseFloat(e.target.value) || 0);
    setLocalHours(val);
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      onHoursCommit(memberKey, val);
      setLocalHours(null);
    }, 300);
  }, [memberKey, onHoursCommit]);

  const handleInputBlur = useCallback(() => {
    setInputFocused(false);
    clearTimeout(commitTimer.current);
    if (localHours !== null) {
      onHoursCommit(memberKey, localHours);
      setLocalHours(null);
    }
  }, [memberKey, localHours, onHoursCommit]);

  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1">
          <Input
            type="number"
            step="0.5"
            min="0"
            max={maxHours}
            value={displayHours.toFixed(1)}
            onChange={handleInputChange}
            onFocus={() => setInputFocused(true)}
            onBlur={handleInputBlur}
            className="w-20 h-7 text-right text-sm ml-auto tabular-nums"
          />
          <input
            type="range"
            min="0"
            max={sliderMax}
            step="0.5"
            value={Math.min(displayHours, sliderMax)}
            onMouseDown={() => { isDragging.current = true; }}
            onTouchStart={() => { isDragging.current = true; }}
            onChange={(e) => setLocalHours(parseFloat(e.target.value) || 0)}
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
