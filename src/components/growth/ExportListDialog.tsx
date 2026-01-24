import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, ListChecks, Square, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import type { GrowthTask } from '@/lib/hooks/useGrowthProjects';
import { calculateDueDate, getDeadlineLabel } from '@/lib/hooks/useGrowthProjects';
import { format, isPast } from 'date-fns';

interface ExportListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: GrowthTask[];
  projectName?: string;
}

export function ExportListDialog({
  open,
  onOpenChange,
  tasks,
  projectName,
}: ExportListDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Reset selection when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSelectedIds(new Set(tasks.map(t => t.id)));
      setCopied(false);
    }
    onOpenChange(newOpen);
  };

  const toggleTask = (taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(tasks.map(t => t.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const selectedTasks = useMemo(() => {
    return tasks.filter(t => selectedIds.has(t.id));
  }, [tasks, selectedIds]);

  const generateHtmlContent = (): string => {
    if (selectedTasks.length === 0) return '';

    const pendingTasks = selectedTasks.filter(t => !t.is_completed);
    const completedTasks = selectedTasks.filter(t => t.is_completed);

    let html = '';
    
    if (projectName) {
      html += `<h2 style="margin: 0 0 16px 0; color: #1a1a1a;">${projectName}</h2>\n`;
    }

    if (pendingTasks.length > 0) {
      html += `<h3 style="margin: 16px 0 8px 0; color: #374151;">📋 Tasks (${pendingTasks.length})</h3>\n`;
      html += '<ul style="margin: 0; padding-left: 20px; list-style-type: disc;">\n';
      
      pendingTasks.forEach(task => {
        const assigneeText = task.assignee ? ` <span style="color: #6b7280;">[${task.assignee}]</span>` : '';
        let deadlineText = '';
        
        if (task.deadline_type && task.deadline_type !== 'no_deadline' && task.deadline_set_at) {
          const dueDate = calculateDueDate(new Date(task.deadline_set_at), task.deadline_type);
          const isOverdue = isPast(dueDate);
          const dateStr = format(dueDate, 'MMM d');
          const color = isOverdue ? '#ef4444' : '#6b7280';
          deadlineText = ` <span style="color: ${color};">(${dateStr})</span>`;
        }
        
        html += `  <li style="margin: 4px 0;"><strong>${task.title}</strong>${assigneeText}${deadlineText}</li>\n`;
      });
      
      html += '</ul>\n';
    }

    if (completedTasks.length > 0) {
      html += `<h3 style="margin: 16px 0 8px 0; color: #374151;">✅ Completed (${completedTasks.length})</h3>\n`;
      html += '<ul style="margin: 0; padding-left: 20px; list-style-type: disc;">\n';
      
      completedTasks.forEach(task => {
        let completedDate = '';
        if (task.completed_at) {
          completedDate = ` <span style="color: #6b7280;">(${format(new Date(task.completed_at), 'MMM d')})</span>`;
        }
        const notesText = task.completion_notes 
          ? `<br/><span style="color: #6b7280; font-size: 0.9em; margin-left: 8px;">↳ ${task.completion_notes}</span>` 
          : '';
        
        html += `  <li style="margin: 4px 0; text-decoration: line-through; color: #6b7280;">${task.title}${completedDate}${notesText}</li>\n`;
      });
      
      html += '</ul>\n';
    }

    return html;
  };

  const handleCopy = async () => {
    const html = generateHtmlContent();
    if (!html) {
      toast.error('No tasks selected');
      return;
    }

    try {
      // Copy as HTML to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([generatePlainTextContent()], { type: 'text/plain' }),
        }),
      ]);
      setCopied(true);
      toast.success(`Copied ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''} to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback to plain text if HTML clipboard fails
      try {
        await navigator.clipboard.writeText(generatePlainTextContent());
        setCopied(true);
        toast.success(`Copied ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''} to clipboard`);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        toast.error('Failed to copy to clipboard');
      }
    }
  };

  const generatePlainTextContent = (): string => {
    if (selectedTasks.length === 0) return '';

    const pendingTasks = selectedTasks.filter(t => !t.is_completed);
    const completedTasks = selectedTasks.filter(t => t.is_completed);

    let text = '';
    
    if (projectName) {
      text += `${projectName}\n${'='.repeat(projectName.length)}\n\n`;
    }

    if (pendingTasks.length > 0) {
      text += `📋 Tasks (${pendingTasks.length})\n`;
      text += '-'.repeat(20) + '\n';
      
      pendingTasks.forEach(task => {
        const assigneeText = task.assignee ? ` [${task.assignee}]` : '';
        let deadlineText = '';
        
        if (task.deadline_type && task.deadline_type !== 'no_deadline' && task.deadline_set_at) {
          const dueDate = calculateDueDate(new Date(task.deadline_set_at), task.deadline_type);
          const dateStr = format(dueDate, 'MMM d');
          deadlineText = ` (${dateStr})`;
        }
        
        text += `• ${task.title}${assigneeText}${deadlineText}\n`;
      });
      text += '\n';
    }

    if (completedTasks.length > 0) {
      text += `✅ Completed (${completedTasks.length})\n`;
      text += '-'.repeat(20) + '\n';
      
      completedTasks.forEach(task => {
        let completedDate = '';
        if (task.completed_at) {
          completedDate = ` (${format(new Date(task.completed_at), 'MMM d')})`;
        }
        text += `✓ ${task.title}${completedDate}\n`;
        if (task.completion_notes) {
          text += `  ↳ ${task.completion_notes}\n`;
        }
      });
    }

    return text;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Export Task List
          </DialogTitle>
          <DialogDescription>
            Select tasks to copy. Paste into an email with rich formatting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selection controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="gap-1.5"
            >
              <CheckSquare className="h-4 w-4" />
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={selectNone}
              className="gap-1.5"
            >
              <Square className="h-4 w-4" />
              Select None
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              {selectedIds.size} of {tasks.length} selected
            </span>
          </div>

          {/* Task list */}
          <ScrollArea className="h-[300px] border rounded-lg p-3">
            <div className="space-y-1">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No tasks to export
                </p>
              ) : (
                tasks.map(task => (
                  <label
                    key={task.id}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(task.id)}
                      onCheckedChange={() => toggleTask(task.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={task.is_completed ? 'line-through text-muted-foreground' : ''}>
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.assignee && (
                          <span className="text-xs text-muted-foreground">
                            {task.assignee}
                          </span>
                        )}
                        {task.deadline_type && task.deadline_type !== 'no_deadline' && task.deadline_set_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(calculateDueDate(new Date(task.deadline_set_at), task.deadline_type), 'MMM d')}
                          </span>
                        )}
                        {task.is_completed && (
                          <span className="text-xs text-success">✓ Done</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={selectedIds.size === 0}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy to Clipboard
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
