import { cn } from '@/lib/utils';

interface StickyTableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Simple wrapper that enables CSS-based sticky headers on tables.
 * The actual sticky behavior is handled via CSS on the thead element.
 */
export function StickyTableHeader({ children, className }: StickyTableHeaderProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
    </div>
  );
}