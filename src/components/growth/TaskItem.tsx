import { useState, useRef, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Clock, Trash2, User, MessageSquare, Pencil, ListTodo } from 'lucide-react';
import { 
  type GrowthTask, 
  type TaskDeadlineType, 
  getDeadlineLabel,
  useKnownAssignees,
  calculateDueDate
} from '@/lib/hooks/useGrowthProjects';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getDeadlineTextColor, getDeadlineBadgeColor } from '@/lib/deadlineColors';

interface TaskItemProps {
  task: GrowthTask;
  onToggle: (completionNotes?: string) => void;
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(task.completion_notes || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  // Quick complete (no notes)
  const handleQuickComplete = () => {
    if (task.is_completed) {
      // Uncompleting - just toggle
      onToggle();
    } else {
      // Complete without notes
      onToggle();
    }
  };

  // Complete with notes
  const handleCompleteWithNotes = () => {
    setCompletionNotes('');
    setShowCompleteDialog(true);
  };

  const handleConfirmComplete = () => {
    onToggle(completionNotes || undefined);
    setShowCompleteDialog(false);
    setCompletionNotes('');
  };

  // Handle editing completion notes inline
  const handleNotesSave = () => {
    const trimmed = editedNotes.trim();
    if (trimmed !== (task.completion_notes || '')) {
      onUpdate({ completion_notes: trimmed || null });
    }
    setIsEditingNotes(false);
  };

  useEffect(() => {
    if (isEditingNotes) {
      setEditedNotes(task.completion_notes || '');
      setTimeout(() => notesInputRef.current?.focus(), 0);
    }
  }, [isEditingNotes, task.completion_notes]);

  // Sync editingAssignee when popover opens
  useEffect(() => {
    if (assigneeOpen) {
      setEditingAssignee(task.assignee || '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [assigneeOpen, task.assignee]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle) {
      setEditedTitle(task.title);
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 0);
    }
  }, [isEditingTitle, task.title]);

  const handleTitleSave = () => {
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate({ title: trimmed });
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditedTitle(task.title);
      setIsEditingTitle(false);
    }
  };

  // Calculate the due date for coloring
  const dueDate = task.deadline_set_at && task.deadline_type !== 'no_deadline'
    ? calculateDueDate(new Date(task.deadline_set_at), task.deadline_type)
    : null;

  const getDeadlineColor = () => {
    return getDeadlineBadgeColor(dueDate, task.is_completed);
  };

  // Get the text color for the task title
  const titleColor = getDeadlineTextColor(dueDate, task.is_completed);

  const handleAssigneeSelect = (name: string) => {
    onUpdate({ assignee: name || null });
    setAssigneeOpen(false);
    // Save new assignee if not already known
    if (name && !assignees.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      addAssignee.mutate(name);
    }
  };

  const handleDeadlineSelect = (deadline: TaskDeadlineType) => {
    onUpdate({ 
      deadline_type: deadline,
      // Pass current deadline_set_at so the hook knows whether to reset it
      ...(task.deadline_set_at ? { currentDeadlineSetAt: task.deadline_set_at } : {})
    } as Partial<GrowthTask>);
    setDeadlineOpen(false);
  };

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
      task.is_completed ? 'bg-muted/30' : 'bg-background',
      isOverdue && !task.is_completed && 'border-destructive/50'
    )}>
      {/* Two completion options for pending tasks, single checkbox for completed */}
      <div className="flex items-center gap-1 mt-1">
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={handleQuickComplete}
          title={task.is_completed ? "Mark incomplete" : "Quick complete"}
        />
        {!task.is_completed && (
          <button
            type="button"
            onClick={handleCompleteWithNotes}
            className="h-4 w-4 rounded border border-input flex items-center justify-center hover:bg-accent hover:border-primary transition-colors"
            title="Complete with notes"
          >
            <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        {isEditingTitle ? (
          <Input
            ref={titleInputRef}
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            className="h-7 text-sm font-medium"
          />
        ) : (
          <div className="flex items-center gap-2">
            <p 
              className={cn(
                "text-sm font-medium cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1",
                titleColor
              )}
              onClick={() => setIsEditingTitle(true)}
              title="Click to edit"
            >
              {task.title}
            </p>
            {task.is_completed && task.completed_at && (
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(task.completed_at), 'MMM d')}
              </span>
            )}
          </div>
        )}
        
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* Clickable Assignee */}
          <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <PopoverTrigger asChild>
              <button 
                type="button"
                className={cn(
                  "inline-flex items-center text-xs px-2 py-1 border rounded-full cursor-pointer hover:bg-accent transition-colors",
                  task.is_completed && "opacity-60"
                )}
              >
                <User className="h-3 w-3 mr-1" />
                {task.assignee || 'Unassigned'}
              </button>
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
              <button 
                type="button"
                className={cn(
                  "inline-flex items-center text-xs px-2 py-1 border rounded-full cursor-pointer hover:bg-accent transition-colors",
                  getDeadlineColor()
                )}
              >
                <Clock className="h-3 w-3 mr-1" />
                {getDeadlineLabel(task.deadline_type)}
              </button>
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

        {/* Completion notes for completed tasks */}
        {task.is_completed && (
          <div className="mt-2">
            {isEditingNotes ? (
              <Textarea
                ref={notesInputRef}
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                onBlur={handleNotesSave}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditedNotes(task.completion_notes || '');
                    setIsEditingNotes(false);
                  }
                }}
                placeholder="Add completion notes..."
                className="min-h-[60px] text-xs"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingNotes(true)}
                className={cn(
                  "text-xs w-full text-left px-2 py-1.5 rounded hover:bg-accent/50 transition-colors flex items-start gap-1.5",
                  task.completion_notes ? "text-muted-foreground" : "text-muted-foreground/50 italic"
                )}
              >
                <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                {task.completion_notes || 'Add completion notes...'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action buttons - separate from triage */}
      <div className="flex flex-col gap-1 shrink-0">
        {/* Pin to Task List button */}
        {!task.is_completed && (
          <Button
            variant={task.pinned_to_tasklist ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-8 px-2 text-xs",
              task.pinned_to_tasklist 
                ? "bg-primary text-primary-foreground" 
                : "border-dashed"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ pinned_to_tasklist: !task.pinned_to_tasklist });
            }}
            title={task.pinned_to_tasklist ? "Remove from Task List" : "Add to Task List"}
          >
            <ListTodo className="h-3.5 w-3.5 mr-1" />
            {task.pinned_to_tasklist ? 'On Tasks' : 'Add to Tasks'}
          </Button>
        )}
        
        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Complete task dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mark task complete</DialogTitle>
            <DialogDescription>
              Optionally add notes about how this task was completed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium mb-3">{task.title}</p>
            <Textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="e.g., Discussed in 1:1 meeting, sent report to client..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmComplete}>
              Complete with Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
