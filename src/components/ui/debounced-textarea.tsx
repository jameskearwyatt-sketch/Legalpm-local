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
 * Maintains focus even when parent components re-render.
 */
export const DebouncedTextarea = React.forwardRef<HTMLTextAreaElement, DebouncedTextareaProps>(
  ({ value, onChange, debounceMs = 300, className, ...props }, forwardedRef) => {
    const [localValue, setLocalValue] = useState(value);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstMount = useRef(true);
    const internalRef = useRef<HTMLTextAreaElement | null>(null);
    const hadFocusRef = useRef(false);
    const selectionRef = useRef<{ start: number; end: number } | null>(null);
    
    // Merge refs
    const setRefs = useCallback((element: HTMLTextAreaElement | null) => {
      internalRef.current = element;
      if (typeof forwardedRef === 'function') {
        forwardedRef(element);
      } else if (forwardedRef) {
        forwardedRef.current = element;
      }
    }, [forwardedRef]);
    
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
      
      // Save cursor position before state update
      selectionRef.current = {
        start: e.target.selectionStart,
        end: e.target.selectionEnd,
      };
      
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
    
    // Restore cursor position after state update
    useEffect(() => {
      if (selectionRef.current && internalRef.current && document.activeElement === internalRef.current) {
        const { start, end } = selectionRef.current;
        internalRef.current.setSelectionRange(start, end);
      }
    }, [localValue]);
    
    const handleFocus = useCallback(() => {
      hadFocusRef.current = true;
    }, []);
    
    const handleBlur = useCallback(() => {
      hadFocusRef.current = false;
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
        ref={setRefs}
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(className)}
        {...props}
      />
    );
  }
);

DebouncedTextarea.displayName = 'DebouncedTextarea';
