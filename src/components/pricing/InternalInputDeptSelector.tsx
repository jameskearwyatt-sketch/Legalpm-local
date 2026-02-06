import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Define a palette of distinct highlight colors for departments
// These will be used both in UI and Excel export
export const DEPT_COLORS: { bg: string; text: string; excelBg: string }[] = [
  { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-200', excelBg: 'FFFFF9C4' }, // Yellow
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-200', excelBg: 'FFA5D6A7' }, // Green
  { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-800 dark:text-sky-200', excelBg: 'FF81D4FA' }, // Blue
  { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-800 dark:text-rose-200', excelBg: 'FFF48FB1' }, // Pink
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-800 dark:text-orange-200', excelBg: 'FFFFCC80' }, // Orange
  { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-800 dark:text-purple-200', excelBg: 'FFCE93D8' }, // Purple
  { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-800 dark:text-cyan-200', excelBg: 'FF80DEEA' }, // Cyan
  { bg: 'bg-lime-100 dark:bg-lime-900/40', text: 'text-lime-800 dark:text-lime-200', excelBg: 'FFE6EE9C' }, // Lime
];

// Get color index for a department based on its position in the unique departments list
export function getDeptColorIndex(dept: string, allDepts: string[]): number {
  const index = allDepts.indexOf(dept);
  return index >= 0 ? index % DEPT_COLORS.length : 0;
}

interface InternalInputDeptSelectorProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  existingDepts: string[];
  disabled?: boolean;
}

export function InternalInputDeptSelector({
  value,
  onChange,
  existingDepts,
  disabled = false,
}: InternalInputDeptSelectorProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelectDept = (dept: string) => {
    onChange(dept);
    setOpen(false);
    setInputValue('');
  };

  const handleAddNew = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onChange(trimmed);
      setOpen(false);
      setInputValue('');
    }
  };

  const handleClear = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange(null);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNew();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Filter existing depts based on input
  const filteredDepts = existingDepts.filter(
    dept => dept.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Check if input matches exactly an existing dept
  const exactMatch = existingDepts.some(
    dept => dept.toLowerCase() === inputValue.toLowerCase()
  );

  // Get color for current value
  const colorIndex = value ? getDeptColorIndex(value, existingDepts) : 0;
  const colorStyle = value ? DEPT_COLORS[colorIndex] : null;

  if (disabled) {
    return (
      <div className={cn(
        "h-8 w-full px-2 flex items-center justify-center rounded text-xs",
        value && colorStyle ? `${colorStyle.bg} ${colorStyle.text}` : "text-muted-foreground"
      )}>
        {value || '-'}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-full px-2 justify-between font-normal",
            value && colorStyle
              ? `${colorStyle.bg} ${colorStyle.text} hover:${colorStyle.bg}`
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="truncate text-xs">
            {value || (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>Input?</span>
              </span>
            )}
          </span>
          {value && (
            <X
              className="h-3 w-3 ml-1 hover:text-destructive shrink-0 cursor-pointer"
              onClick={handleClear}
              onPointerDown={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type dept name + Enter"
            className="h-8 text-xs"
          />
          
          {/* Existing departments */}
          {filteredDepts.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {filteredDepts.map((dept, idx) => {
                const deptColorIndex = getDeptColorIndex(dept, existingDepts);
                const deptColor = DEPT_COLORS[deptColorIndex];
                return (
                  <button
                    key={dept}
                    onClick={() => handleSelectDept(dept)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between",
                      deptColor.bg, deptColor.text,
                      "hover:opacity-80"
                    )}
                  >
                    <span className="truncate">{dept}</span>
                    {value === dept && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Add new option if not exact match */}
          {inputValue.trim() && !exactMatch && (
            <button
              onClick={handleAddNew}
              className="w-full text-left px-2 py-1.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
            >
              + Add "{inputValue.trim()}"
            </button>
          )}

          {/* Empty state */}
          {!inputValue && existingDepts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Type a department name and press Enter
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
