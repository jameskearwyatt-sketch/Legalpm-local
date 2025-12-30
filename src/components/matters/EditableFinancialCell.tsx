import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, X, Loader2 } from 'lucide-react';

interface EditableFinancialCellProps {
  value: number;
  currency: string;
  onSave: (value: number) => Promise<void>;
  className?: string;
}

export function EditableFinancialCell({ value, currency, onSave, className }: EditableFinancialCellProps) {
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
            // Small delay to allow button clicks
            setTimeout(() => {
              if (!isSaving) handleCancel();
            }, 150);
          }}
          className="h-7 w-24 text-right text-sm"
          disabled={isSaving}
        />
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSave}
              className="p-1 hover:bg-success/20 rounded text-success"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCancel}
              className="p-1 hover:bg-destructive/20 rounded text-destructive"
            >
              <X className="h-3 w-3" />
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
        "text-right w-full hover:bg-muted/50 px-2 py-1 rounded transition-colors cursor-pointer",
        className
      )}
      title="Click to edit"
    >
      {formatCurrency(value)}
    </button>
  );
}
