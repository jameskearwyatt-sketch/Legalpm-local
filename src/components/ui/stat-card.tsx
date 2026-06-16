import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, HelpCircle, ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface StatCardProps {
  title: string;
  value?: string | number;
  valueSlot?: ReactNode;
  icon?: ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
  infoTooltip?: string;
  note?: string;
  noteVariant?: 'default' | 'amber' | 'info';
  onClick?: () => void;
  isExpanded?: boolean;
}

export function StatCard({ title, value, valueSlot, icon, trend, variant = 'default', className, infoTooltip, note, noteVariant = 'default', onClick, isExpanded }: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-success/5 border-success/20',
    warning: 'bg-warning/5 border-warning/20',
    danger: 'bg-danger/5 border-danger/20',
  };

  const iconStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  };

  return (
    <Card className={cn('relative shadow-card hover:shadow-card-hover transition-shadow', variantStyles[variant], onClick && 'cursor-pointer ring-offset-background hover:ring-2 hover:ring-primary/20', isExpanded && 'ring-2 ring-primary/40', className)} onClick={onClick}>
      {onClick && (
        <div className={cn(
          'absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/80 transition-transform',
          isExpanded && 'rotate-180'
        )}>
          <ChevronDown className="h-3 w-3" />
        </div>
      )}
      <CardContent className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight line-clamp-2">{title}</p>
              {infoTooltip && (
                <Popover>
                  <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="shrink-0 mt-0.5 rounded-full p-0.5 hover:bg-muted transition-colors"
                      aria-label="More info"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    className="max-w-xs text-xs leading-relaxed"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {infoTooltip}
                  </PopoverContent>
                </Popover>
              )}
            </div>
            {valueSlot ? (
              valueSlot
            ) : (
              <p className="text-sm sm:text-base lg:text-lg font-mono font-semibold text-foreground tabular-nums break-words leading-tight">{value}</p>
            )}
            {note && (
              <p className={cn(
                'text-xs mt-0.5',
                noteVariant === 'amber' ? 'text-amber-600 dark:text-amber-500' : 
                noteVariant === 'info' ? 'text-blue-600 dark:text-blue-500' : 
                'text-muted-foreground'
              )}>
                {note}
              </p>
            )}
            {trend && (
              <div className="flex items-center gap-1 text-sm">
                {trend.value > 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : trend.value < 0 ? (
                  <TrendingDown className="h-4 w-4 text-danger" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  'font-medium',
                  trend.value > 0 ? 'text-success' : trend.value < 0 ? 'text-danger' : 'text-muted-foreground'
                )}>
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                </span>
                {trend.label && (
                  <span className="text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className={cn('p-2 lg:p-3 rounded-lg shrink-0', iconStyles[variant])}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
