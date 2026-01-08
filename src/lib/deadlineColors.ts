import { differenceInDays, isPast } from 'date-fns';

/**
 * Returns a Tailwind text color class based on how far away a due date is:
 * - Overdue or this week (≤7 days): red
 * - Next week (8-14 days): yellow/amber
 * - This month (15-30 days): light green
 * - Over a month (>30 days): green
 * 
 * @param dueDate - The calculated due date
 * @param isCompleted - Whether the task is completed (returns muted if true)
 * @returns Tailwind text color class
 */
export function getDeadlineTextColor(dueDate: Date | null, isCompleted?: boolean): string {
  if (isCompleted) {
    return 'text-muted-foreground';
  }
  
  if (!dueDate) {
    return ''; // No color for tasks without deadlines
  }
  
  const now = new Date();
  const daysUntilDue = differenceInDays(dueDate, now);
  
  // Overdue or this week (7 days or less)
  if (isPast(dueDate) || daysUntilDue <= 7) {
    return 'text-red-600 dark:text-red-500';
  }
  
  // Next week (8-14 days)
  if (daysUntilDue <= 14) {
    return 'text-amber-600 dark:text-amber-500';
  }
  
  // This month (15-30 days)
  if (daysUntilDue <= 30) {
    return 'text-lime-600 dark:text-lime-500';
  }
  
  // Over a month (>30 days)
  return 'text-emerald-600 dark:text-emerald-500';
}

/**
 * Helper to get deadline badge colors (background + text + border)
 * Uses same logic as text colors but returns full badge styling
 */
export function getDeadlineBadgeColor(dueDate: Date | null, isCompleted?: boolean): string {
  if (isCompleted) {
    return 'bg-muted text-muted-foreground';
  }
  
  if (!dueDate) {
    return 'bg-muted text-muted-foreground';
  }
  
  const now = new Date();
  const daysUntilDue = differenceInDays(dueDate, now);
  
  // Overdue or this week
  if (isPast(dueDate) || daysUntilDue <= 7) {
    return 'bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/30';
  }
  
  // Next week
  if (daysUntilDue <= 14) {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/30';
  }
  
  // This month
  if (daysUntilDue <= 30) {
    return 'bg-lime-500/10 text-lime-600 dark:text-lime-500 border-lime-500/30';
  }
  
  // Over a month
  return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/30';
}
