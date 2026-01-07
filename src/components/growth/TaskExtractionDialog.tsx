import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Trash2, User, Clock } from 'lucide-react';
import { type TaskDeadlineType, getDeadlineLabel } from '@/lib/hooks/useGrowthProjects';
import { cn } from '@/lib/utils';

export interface ExtractedTask {
  title: string;
  assignee?: string;
  deadline_type: TaskDeadlineType;
  selected: boolean;
}

interface TaskExtractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: ExtractedTask[];
  onTasksChange: (tasks: ExtractedTask[]) => void;
  onConfirm: (tasks: ExtractedTask[]) => void;
  isLoading?: boolean;
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

export const TaskExtractionDialog = ({
  open,
  onOpenChange,
  tasks,
  onTasksChange,
  onConfirm,
  isLoading,
}: TaskExtractionDialogProps) => {
  const selectedCount = tasks.filter(t => t.selected).length;

  const toggleTask = (index: number) => {
    const updated = [...tasks];
    updated[index].selected = !updated[index].selected;
    onTasksChange(updated);
  };

  const updateTask = (index: number, updates: Partial<ExtractedTask>) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], ...updates };
    onTasksChange(updated);
  };

  const removeTask = (index: number) => {
    onTasksChange(tasks.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    onConfirm(tasks.filter(t => t.selected));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <DialogTitle>Tasks Identified</DialogTitle>
              <DialogDescription>
                AI has extracted {tasks.length} potential tasks. Review and add them to your project.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-3" />
              <p className="text-sm text-muted-foreground">Analyzing content for tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No actionable tasks were identified in this content.</p>
            </div>
          ) : (
            tasks.map((task, index) => (
              <div
                key={index}
                className={cn(
                  "border rounded-lg p-4 space-y-3 transition-colors",
                  task.selected ? "bg-accent/30 border-primary/30" : "bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={task.selected}
                    onCheckedChange={() => toggleTask(index)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <Input
                      value={task.title}
                      onChange={(e) => updateTask(index, { title: e.target.value })}
                      className="font-medium"
                      placeholder="Task title"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeTask(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 pl-7">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <Input
                      value={task.assignee || ''}
                      onChange={(e) => updateTask(index, { assignee: e.target.value })}
                      placeholder="Assignee"
                      className="h-7 w-32 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <select
                      value={task.deadline_type}
                      onChange={(e) => updateTask(index, { deadline_type: e.target.value as TaskDeadlineType })}
                      className="h-7 text-xs rounded border bg-background px-2"
                    >
                      {deadlineOptions.map(opt => (
                        <option key={opt} value={opt}>{getDeadlineLabel(opt)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={selectedCount === 0 || isLoading}
          >
            Add {selectedCount} {selectedCount === 1 ? 'Task' : 'Tasks'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
