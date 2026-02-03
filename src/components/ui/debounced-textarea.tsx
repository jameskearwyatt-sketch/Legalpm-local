import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Textarea } from './textarea';
import { cn } from '@/lib/utils';

interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

/**
 * A textarea that debounces onChange events to improve performance
 * when used in lists or tables with many items.
 * Uses local state for immediate UI feedback, syncs to parent after debounce.
 */
export const DebouncedTextarea = React.forwardRef<HTMLTextAreaElement, DebouncedTextareaProps>(
  ({ value, onChange, debounceMs = 300, className, ...props }, ref) => {
    const [localValue, setLocalValue] = useState(value);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstMount = useRef(true);
    
    // Track the last value we sent to parent to detect external changes
    const lastSentValueRef = useRef<string>(value);
    
    // Sync local state when value prop changes from parent
    // (e.g., after save/load, or when item is replaced)
    useEffect(() => {
      // Skip syncing on mount - localValue is already initialized
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      
      // Only sync if the value changed externally (not from our own update)
      // Compare against the last value we sent to parent
      if (value !== lastSentValueRef.current) {
        setLocalValue(value);
        lastSentValueRef.current = value;
      }
    }, [value]);
    
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      
      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        lastSentValueRef.current = newValue; // Track what we're sending
        onChange(newValue);
      }, debounceMs);
    }, [onChange, debounceMs]);
    
    const handleBlur = useCallback(() => {
      // Immediately sync on blur to ensure data is saved
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (localValue !== value) {
        lastSentValueRef.current = localValue; // Track what we're sending
        onChange(localValue);
      }
    }, [localValue, value, onChange]);
    
    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);
    
    return (
      <Textarea
        ref={ref}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(className)}
        {...props}
      />
    );
  }
);

DebouncedTextarea.displayName = 'DebouncedTextarea';
