import { cn } from '@/lib/utils';

interface StickyTableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Stable wrapper for sticky table headers.
 *
 * The actual sticky behavior is handled by thead classes in the table primitives.
 * Keeping this component lightweight avoids runtime layout/observer loops.
 */
export function StickyTableHeader({ children, className }: StickyTableHeaderProps) {
  return <div className={cn('relative', className)}>{children}</div>;
}
