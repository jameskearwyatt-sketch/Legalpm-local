import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Clock, Trash2, User, CalendarClock } from 'lucide-react';
import { 
  type GrowthTask, 
  type TaskDeadlineType, 
  getDeadlineLabel, 
  calculateDueDate 
} from '@/lib/hooks/useGrowthProjects';
import { formatDistanceToNow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskItemProps {
  task: GrowthTask;
  onToggle: () => void;
  onUpdate: (updates: Partial<GrowthTask>) => void;
  onDelete: () => void;
  isOverdue?: boolean;
}

export const TaskItem = ({ task, onToggle, onUpdate, onDelete, isOverdue }: TaskItemProps) => {
  const deadlineOptions: TaskDeadlineType[] = [
    'this_week',
    'next_week',
    'this_month',
    'next_month',
    'in_3_months',
    'in_6_months',
    'no_deadline',
  ];

  const getDeadlineColor = () => {
    if (task.is_completed) return 'bg-muted text-muted-foreground';
    if (isOverdue) return 'bg-destructive/10 text-destructive border-destructive/30';
    
    switch (task.deadline_type) {
      case 'this_week':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
      case 'next_week':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      case 'this_month':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
      task.is_completed ? 'bg-muted/30' : 'bg-background',
      isOverdue && !task.is_completed && 'border-destructive/50'
    )}>
      <Checkbox
        checked={task.is_completed}
        onCheckedChange={onToggle}
        className="mt-1"
      />
      
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium",
          task.is_completed && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </p>
        
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {task.assignee && (
            <Badge variant="outline" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              {task.assignee}
            </Badge>
          )}
          
          {task.deadline_type !== 'no_deadline' && (
            <Badge variant="outline" className={cn("text-xs", getDeadlineColor())}>
              <Clock className="h-3 w-3 mr-1" />
              {getDeadlineLabel(task.deadline_type)}
            </Badge>
          )}
          
          {task.completed_at && (
            <span className="text-xs text-muted-foreground">
              Completed {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CalendarClock className="h-4 w-4 mr-2" />
              Change Deadline
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {deadlineOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  onClick={() => onUpdate({ deadline_type: opt })}
                >
                  {getDeadlineLabel(opt)}
                  {task.deadline_type === opt && ' ✓'}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
