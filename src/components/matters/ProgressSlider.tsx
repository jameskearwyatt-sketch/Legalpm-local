import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';

interface ProgressSliderProps {
  matterId: string;
  initialProgress: number;
  currency: string;
  currentBurn: number; // BM burn only
  bmBudget: number; // BM budget (bm_fee_component)
  onSave: (matterId: string, progress: number) => Promise<void>;
  compact?: boolean;
}

export function ProgressSlider({
  matterId,
  initialProgress,
  currency,
  currentBurn,
  bmBudget,
  onSave,
  compact = true,
}: ProgressSliderProps) {
  // Local state for smooth dragging
  const [localProgress, setLocalProgress] = useState(initialProgress);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with external changes when not dragging
  useEffect(() => {
    if (!isDragging && !isSaving) {
      setLocalProgress(initialProgress);
    }
  }, [initialProgress, isDragging, isSaving]);

  // Calculate estimated budget to close
  const estimatedToClose = localProgress > 0 && localProgress < 100
    ? Math.round((currentBurn / localProgress) * (100 - localProgress))
    : 0;

  // Total budget required = current burn + estimated to close
  const totalBudgetRequired = currentBurn + estimatedToClose;

  // Budget shortfall = total required - BM budget (only if positive)
  const budgetShortfall = totalBudgetRequired > bmBudget ? totalBudgetRequired - bmBudget : 0;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalProgress(parseInt(e.target.value));
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(async () => {
    setIsDragging(false);
    
    // Only save if value actually changed
    if (localProgress !== initialProgress) {
      setIsSaving(true);
      try {
        await onSave(matterId, localProgress);
      } finally {
        setIsSaving(false);
      }
    }
  }, [matterId, localProgress, initialProgress, onSave]);

  if (compact) {
    return (
      <div className="space-y-1 min-w-[160px]">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            value={localProgress}
            onChange={handleChange}
            onMouseDown={handleDragStart}
            onMouseUp={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchEnd={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerUp={handleDragEnd}
            className="w-24 h-2 bg-secondary rounded-full appearance-none cursor-pointer transition-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
          />
          <span className="text-xs font-medium min-w-[32px] tabular-nums">{localProgress}%</span>
        </div>
        {localProgress > 0 && localProgress < 100 && (
          <>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Est. to close: {formatCurrency(estimatedToClose, currency)}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Total required: {formatCurrency(totalBudgetRequired, currency)}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Shortfall: <span className={budgetShortfall > 0 ? 'text-destructive font-medium' : ''}>{formatCurrency(budgetShortfall, currency)}</span>
            </p>
          </>
        )}
        {localProgress === 100 && (
          <p className="text-[10px] text-green-600 font-medium leading-tight">Complete</p>
        )}
      </div>
    );
  }

  // Full-size version for detail pages
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="0"
          max="100"
          value={localProgress}
          onChange={handleChange}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
          onPointerDown={handleDragStart}
          onPointerUp={handleDragEnd}
          className="flex-1 h-2 bg-secondary rounded-full appearance-none cursor-pointer transition-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
        />
        <span className="text-sm font-medium min-w-[40px] tabular-nums">{localProgress}%</span>
      </div>
      {localProgress > 0 && localProgress < 100 && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Estimated to close: <span className="font-medium text-foreground">{formatCurrency(estimatedToClose, currency)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Total budget required: <span className="font-medium text-foreground">{formatCurrency(totalBudgetRequired, currency)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Budget shortfall: <span className={budgetShortfall > 0 ? 'font-medium text-destructive' : 'text-foreground'}>{formatCurrency(budgetShortfall, currency)}</span>
          </p>
        </div>
      )}
      {localProgress === 100 && (
        <p className="text-sm text-green-600 font-medium">Deal complete</p>
      )}
      {localProgress === 0 && currentBurn > 0 && (
        <p className="text-sm text-muted-foreground">Set progress to estimate budget requirements</p>
      )}
    </div>
  );
}
