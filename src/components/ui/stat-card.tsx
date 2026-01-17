import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
  infoTooltip?: string;
}

export function StatCard({ title, value, icon, trend, variant = 'default', className, infoTooltip }: StatCardProps) {
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
    <Card className={cn('shadow-card hover:shadow-card-hover transition-shadow', variantStyles[variant], className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {infoTooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      <p>{infoTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
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
            <div className={cn('p-3 rounded-lg', iconStyles[variant])}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
