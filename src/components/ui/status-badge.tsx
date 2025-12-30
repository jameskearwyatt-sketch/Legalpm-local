import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'danger' | 'neutral'; label?: string }> = {
  // Matter status
  'Open': { variant: 'success' },
  'ATTN': { variant: 'warning', label: 'ATTN' },
  'On Hold': { variant: 'warning' }, // Legacy support
  'Closed': { variant: 'neutral' },
  
  // Invoice status
  'Draft': { variant: 'neutral' },
  'Sent': { variant: 'warning' },
  'Part Paid': { variant: 'warning' },
  'Paid': { variant: 'success' },
  'Overdue': { variant: 'danger' },
  
  // Alert types
  'Over Budget': { variant: 'danger' },
  'Near Budget': { variant: 'warning' },
  'High WIP': { variant: 'warning' },
  'Poor Collection': { variant: 'danger' },
  'Overdue Invoice': { variant: 'danger' },
};

const variantStyles = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  neutral: 'badge-neutral',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { variant: 'neutral' as const };
  
  return (
    <Badge 
      variant="outline" 
      className={cn(variantStyles[config.variant], 'font-medium', className)}
    >
      {config.label || status}
    </Badge>
  );
}
