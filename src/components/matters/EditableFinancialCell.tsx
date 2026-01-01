import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, X, Loader2, Pencil } from 'lucide-react';

interface EditableFinancialCellProps {
  value: number;
  currency: string;
  onSave: (value: number) => Promise<void>;
  className?: string;
  compact?: boolean;
}

export function EditableFinancialCell({ value, currency, onSave, className, compact }: EditableFinancialCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (val: number) => {
    const symbols: Record<string, string> = {
      GBP: '£',
      USD: '$',
      EUR: '€',
      Ringgit: 'RM ',
      CHF: 'CHF ',
      AUD: 'A$',
      CAD: 'C$',
      SGD: 'S$',
      SEK: 'kr ',
    };
    const symbol = symbols[currency] || currency + ' ';
    return symbol + new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  const handleSave = async () => {
    const numValue = parseFloat(editValue.replace(/,/g, '')) || 0;
    if (numValue === value) {
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(numValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setTimeout(() => {
              if (!isSaving) handleCancel();
            }, 150);
          }}
          className={cn(
            "text-right",
            compact ? "h-5 w-16 text-xs px-1" : "h-7 w-24 text-sm"
          )}
          disabled={isSaving}
        />
        {isSaving ? (
          <Loader2 className={cn("animate-spin text-muted-foreground", compact ? "h-3 w-3" : "h-4 w-4")} />
        ) : (
          <>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSave}
              className="p-0.5 hover:bg-success/20 rounded text-success"
            >
              <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCancel}
              className="p-0.5 hover:bg-destructive/20 rounded text-destructive"
            >
              <X className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        "text-right rounded transition-all cursor-pointer group",
        "border border-dashed border-primary/30 hover:border-primary hover:bg-primary/5",
        compact ? "px-1 py-0 text-xs" : "w-full px-2 py-1",
        className
      )}
      title="Click to edit"
    >
      <span className={cn("flex items-center justify-end", compact ? "gap-0.5" : "gap-1")}>
        {formatCurrency(value)}
        <Pencil className={cn(
          "text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity",
          compact ? "h-2 w-2" : "h-3 w-3"
        )} />
      </span>
    </button>
  );
}

