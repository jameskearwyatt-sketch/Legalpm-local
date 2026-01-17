import { useState, useEffect, useCallback, useRef } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';
import { ChevronUp, ChevronDown } from 'lucide-react';

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
  // Local state for smooth interaction
  const [localProgress, setLocalProgress] = useState(initialProgress);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef(initialProgress);

  // Sync with external changes only when props catch up to our saved value
  // This prevents the "bounce back" when query refreshes with stale data
  useEffect(() => {
    if (!isDragging && !isSaving && saveTimeoutRef.current === null) {
      // Only sync if the incoming value matches what we last saved
      // OR if we haven't made any local changes yet
      if (initialProgress === lastSavedValueRef.current) {
        setLocalProgress(initialProgress);
      }
    }
  }, [initialProgress, isDragging, isSaving]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Calculate estimated budget to close
  const estimatedToClose = localProgress > 0 && localProgress < 100
    ? Math.round((currentBurn / localProgress) * (100 - localProgress))
    : 0;

  // Total budget required = current burn + estimated to close
  const totalBudgetRequired = currentBurn + estimatedToClose;

  // Budget shortfall = total required - BM budget (only if positive)
  const budgetShortfall = totalBudgetRequired > bmBudget ? totalBudgetRequired - bmBudget : 0;

  // Debounced save function
  const scheduleSave = useCallback((newProgress: number) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      saveTimeoutRef.current = null;
      if (newProgress !== lastSavedValueRef.current) {
        setIsSaving(true);
        try {
          await onSave(matterId, newProgress);
          lastSavedValueRef.current = newProgress;
        } finally {
          setIsSaving(false);
        }
      }
    }, 500);
  }, [matterId, onSave]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalProgress(parseInt(e.target.value));
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const handleDragEnd = useCallback(async () => {
    setIsDragging(false);
    
    // Only save if value actually changed
    if (localProgress !== lastSavedValueRef.current) {
      setIsSaving(true);
      try {
        await onSave(matterId, localProgress);
        lastSavedValueRef.current = localProgress;
      } finally {
        setIsSaving(false);
      }
    }
  }, [matterId, localProgress, onSave]);

  const handleIncrement = useCallback(() => {
    if (localProgress >= 100) return;
    const newProgress = Math.min(100, localProgress + 1);
    setLocalProgress(newProgress);
    scheduleSave(newProgress);
  }, [localProgress, scheduleSave]);

  const handleDecrement = useCallback(() => {
    if (localProgress <= 0) return;
    const newProgress = Math.max(0, localProgress - 1);
    setLocalProgress(newProgress);
    scheduleSave(newProgress);
  }, [localProgress, scheduleSave]);

  if (compact) {
    return (
      <div className="space-y-1 min-w-[160px]">
        <div className="flex items-center gap-1.5">
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
          <div className="flex flex-col">
            <button
              type="button"
              onClick={handleIncrement}
              disabled={localProgress >= 100}
              className="p-0 h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Increase progress"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={handleDecrement}
              disabled={localProgress <= 0}
              className="p-0 h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Decrease progress"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
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
      <div className="flex items-center gap-3">
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
        <div className="flex flex-col">
          <button
            type="button"
            onClick={handleIncrement}
            disabled={localProgress >= 100}
            className="p-0 h-4 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Increase progress"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDecrement}
            disabled={localProgress <= 0}
            className="p-0 h-4 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Decrease progress"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
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
