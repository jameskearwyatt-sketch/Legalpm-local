import { useState, useRef, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Clock, Trash2, User } from 'lucide-react';
import { 
  type GrowthTask, 
  type TaskDeadlineType, 
  getDeadlineLabel,
  useKnownAssignees
} from '@/lib/hooks/useGrowthProjects';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskItemProps {
  task: GrowthTask;
  onToggle: () => void;
  onUpdate: (updates: Partial<GrowthTask>) => void;
  onDelete: () => void;
  isOverdue?: boolean;
}

const deadlineOptions: TaskDeadlineType[] = [
  'this_week',
  'next_week',
  'this_month',
  'next_month',
  'in_3_months',
  'in_6_months',
  'no_deadline',
];

export const TaskItem = ({ task, onToggle, onUpdate, onDelete, isOverdue }: TaskItemProps) => {
  const { assignees, addAssignee } = useKnownAssignees();
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(task.assignee || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (assigneeOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [assigneeOpen]);

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

  const handleAssigneeSelect = (name: string) => {
    onUpdate({ assignee: name || null });
    setAssigneeOpen(false);
    // Save new assignee if not already known
    if (name && !assignees.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      addAssignee.mutate(name);
    }
  };

  const handleDeadlineSelect = (deadline: TaskDeadlineType) => {
    onUpdate({ deadline_type: deadline });
    setDeadlineOpen(false);
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
          task.is_completed && 'text-muted-foreground'
        )}>
          {task.title}
        </p>
        
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* Clickable Assignee */}
          <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <PopoverTrigger asChild>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs cursor-pointer hover:bg-accent transition-colors",
                  task.is_completed && "opacity-60"
                )}
              >
                <User className="h-3 w-3 mr-1" />
                {task.assignee || 'Unassigned'}
              </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-2">
                <Input
                  ref={inputRef}
                  value={editingAssignee}
                  onChange={(e) => setEditingAssignee(e.target.value)}
                  placeholder="Type or select..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAssigneeSelect(editingAssignee);
                    }
                  }}
                />
                {assignees.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {assignees
                      .filter(a => a.name.toLowerCase().includes(editingAssignee.toLowerCase()))
                      .map((assignee) => (
                        <button
                          key={assignee.id}
                          className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                          onClick={() => {
                            setEditingAssignee(assignee.name);
                            handleAssigneeSelect(assignee.name);
                          }}
                        >
                          {assignee.name}
                        </button>
                      ))}
                  </div>
                )}
                <div className="flex gap-1 pt-1 border-t">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-7 text-xs"
                    onClick={() => handleAssigneeSelect('')}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => handleAssigneeSelect(editingAssignee)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Clickable Deadline - Always shown */}
          <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
            <PopoverTrigger asChild>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs cursor-pointer hover:bg-accent transition-colors",
                  getDeadlineColor()
                )}
              >
                <Clock className="h-3 w-3 mr-1" />
                {getDeadlineLabel(task.deadline_type)}
              </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="start">
              <div className="space-y-0.5">
                {deadlineOptions.map((opt) => (
                  <button
                    key={opt}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors flex items-center justify-between",
                      task.deadline_type === opt && "bg-accent"
                    )}
                    onClick={() => handleDeadlineSelect(opt)}
                  >
                    {getDeadlineLabel(opt)}
                    {task.deadline_type === opt && <span>✓</span>}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          {task.completed_at && (
            <span className="text-xs text-muted-foreground">
              Completed {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Delete button directly on task */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
