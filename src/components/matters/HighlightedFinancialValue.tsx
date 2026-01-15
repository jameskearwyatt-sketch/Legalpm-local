import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface HighlightedFinancialValueProps {
  currentValue: string;
  previousValue?: number;
  previousDate?: string;
  isHighlighted: boolean;
  className?: string;
  formatFn: (value: number) => string;
}

export function HighlightedFinancialValue({
  currentValue,
  previousValue,
  previousDate,
  isHighlighted,
  className,
  formatFn,
}: HighlightedFinancialValueProps) {
  if (!isHighlighted || previousValue === undefined) {
    return <span className={className}>{currentValue}</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded cursor-help transition-colors',
              'bg-cyan-200 dark:bg-cyan-800/60',
              className
            )}
          >
            {currentValue}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-cyan-50 dark:bg-cyan-900/90 border-cyan-200 dark:border-cyan-700 text-foreground"
        >
          <div className="flex flex-col items-center gap-0.5 text-xs">
            {previousDate && (
              <span className="text-muted-foreground text-[10px]">
                {format(new Date(previousDate), 'dd MMM yyyy')}
              </span>
            )}
            <span className="font-medium">
              Previous: {formatFn(previousValue)}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
