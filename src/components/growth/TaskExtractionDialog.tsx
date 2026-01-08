import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Sparkles, Trash2, User, Clock, Edit3, CheckCircle, Plus } from 'lucide-react';
import { type TaskDeadlineType, getDeadlineLabel, useKnownAssignees } from '@/lib/hooks/useGrowthProjects';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export interface ExtractedTask {
  title: string;
  assignee?: string;
  deadline_type: TaskDeadlineType;
  selected: boolean;
}

export interface TaskAmendment {
  original_task_title: string;
  original_task_id?: string;
  suggested_title?: string;
  suggested_assignee?: string;
  suggested_deadline_type?: TaskDeadlineType;
  reason: string;
  selected: boolean;
}

export interface CompletedTaskSuggestion {
  original_task_title: string;
  original_task_id?: string;
  evidence: string;
  completion_notes?: string;
  selected: boolean;
}

interface TaskExtractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: ExtractedTask[];
  amendments: TaskAmendment[];
  completedTasks: CompletedTaskSuggestion[];
  onTasksChange: (tasks: ExtractedTask[]) => void;
  onAmendmentsChange: (amendments: TaskAmendment[]) => void;
  onCompletedTasksChange: (completedTasks: CompletedTaskSuggestion[]) => void;
  onConfirm: (tasks: ExtractedTask[], amendments: TaskAmendment[], completedTasks: CompletedTaskSuggestion[]) => void;
  isLoading?: boolean;
  isAdding?: boolean;
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
  amendments,
  completedTasks,
  onTasksChange,
  onAmendmentsChange,
  onCompletedTasksChange,
  onConfirm,
  isLoading,
  isAdding,
}: TaskExtractionDialogProps) => {
  const { assignees } = useKnownAssignees();
  const [openAssigneeIndex, setOpenAssigneeIndex] = useState<number | null>(null);
  const [assigneeInputs, setAssigneeInputs] = useState<Record<number, string>>({});
  
  const selectedNewCount = tasks.filter(t => t.selected).length;
  const selectedAmendCount = amendments.filter(a => a.selected).length;
  const selectedCompleteCount = completedTasks.filter(c => c.selected).length;
  const totalSelected = selectedNewCount + selectedAmendCount + selectedCompleteCount;

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

  const toggleAmendment = (index: number) => {
    const updated = [...amendments];
    updated[index].selected = !updated[index].selected;
    onAmendmentsChange(updated);
  };

  const toggleCompleted = (index: number) => {
    const updated = [...completedTasks];
    updated[index].selected = !updated[index].selected;
    onCompletedTasksChange(updated);
  };

  const updateCompletedNotes = (index: number, notes: string) => {
    const updated = [...completedTasks];
    updated[index].completion_notes = notes;
    onCompletedTasksChange(updated);
  };

  const handleConfirm = () => {
    const selectedTasks = tasks.filter(t => t.selected);
    const selectedAmendments = amendments.filter(a => a.selected);
    const selectedComplete = completedTasks.filter(c => c.selected);
    onOpenChange(false);
    onConfirm(selectedTasks, selectedAmendments, selectedComplete);
  };

  const hasAnyContent = tasks.length > 0 || amendments.length > 0 || completedTasks.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <DialogTitle>AI Task Analysis</DialogTitle>
              <DialogDescription>
                AI has analyzed your latest entry. Review the suggestions below.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-3" />
            <p className="text-sm text-muted-foreground">Analyzing content for tasks...</p>
          </div>
        ) : !hasAnyContent ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No actionable items were identified in this content.</p>
          </div>
        ) : (
          <Tabs defaultValue="new" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="new" className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                New
                {tasks.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{tasks.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="amend" className="gap-1">
                <Edit3 className="h-3.5 w-3.5" />
                Amend
                {amendments.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{amendments.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="complete" className="gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Complete
                {completedTasks.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{completedTasks.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-4 min-h-0">
              {/* New Tasks Tab */}
              <TabsContent value="new" className="mt-0 space-y-3">
                {tasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No new tasks identified.</p>
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
                        <Popover 
                          open={openAssigneeIndex === index} 
                          onOpenChange={(isOpen) => {
                            if (isOpen) {
                              setOpenAssigneeIndex(index);
                              setAssigneeInputs(prev => ({ ...prev, [index]: task.assignee || '' }));
                            } else {
                              setOpenAssigneeIndex(null);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-1 h-7 px-2 text-xs border rounded hover:bg-accent transition-colors">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className={task.assignee ? '' : 'text-muted-foreground'}>
                                {task.assignee || 'Unassigned'}
                              </span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2" align="start">
                            <div className="space-y-2">
                              <Input
                                value={assigneeInputs[index] || ''}
                                onChange={(e) => setAssigneeInputs(prev => ({ ...prev, [index]: e.target.value }))}
                                placeholder="Type or select..."
                                className="h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateTask(index, { assignee: assigneeInputs[index] || '' });
                                    setOpenAssigneeIndex(null);
                                  }
                                }}
                              />
                              {assignees.length > 0 && (
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {assignees
                                    .filter(a => a.name.toLowerCase().includes((assigneeInputs[index] || '').toLowerCase()))
                                    .map((assignee) => (
                                      <button
                                        key={assignee.id}
                                        type="button"
                                        className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                                        onClick={() => {
                                          updateTask(index, { assignee: assignee.name });
                                          setOpenAssigneeIndex(null);
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
                                  type="button"
                                  onClick={() => {
                                    updateTask(index, { assignee: '' });
                                    setOpenAssigneeIndex(null);
                                  }}
                                >
                                  Clear
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1 h-7 text-xs"
                                  type="button"
                                  onClick={() => {
                                    updateTask(index, { assignee: assigneeInputs[index] || '' });
                                    setOpenAssigneeIndex(null);
                                  }}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>

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
              </TabsContent>

              {/* Amendments Tab */}
              <TabsContent value="amend" className="mt-0 space-y-3">
                {amendments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No task amendments suggested.</p>
                ) : (
                  amendments.map((amendment, index) => (
                    <div
                      key={index}
                      className={cn(
                        "border rounded-lg p-4 space-y-2 transition-colors",
                        amendment.selected ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/30"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={amendment.selected}
                          onCheckedChange={() => toggleAmendment(index)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Original: </span>
                            <span className="font-medium">{amendment.original_task_title}</span>
                          </div>
                          {amendment.suggested_title && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">→ New title: </span>
                              <span className="font-medium text-amber-600">{amendment.suggested_title}</span>
                            </div>
                          )}
                          {amendment.suggested_assignee && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">→ Assignee: </span>
                              <span className="font-medium text-amber-600">{amendment.suggested_assignee}</span>
                            </div>
                          )}
                          {amendment.suggested_deadline_type && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">→ Deadline: </span>
                              <span className="font-medium text-amber-600">{getDeadlineLabel(amendment.suggested_deadline_type)}</span>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground italic">{amendment.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Completed Tab */}
              <TabsContent value="complete" className="mt-0 space-y-3">
                {completedTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No tasks identified as completed.</p>
                ) : (
                  completedTasks.map((completed, index) => (
                    <div
                      key={index}
                      className={cn(
                        "border rounded-lg p-4 space-y-2 transition-colors",
                        completed.selected ? "bg-green-500/10 border-green-500/30" : "bg-muted/30"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={completed.selected}
                          onCheckedChange={() => toggleCompleted(index)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="font-medium flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            {completed.original_task_title}
                          </div>
                          <p className="text-xs text-muted-foreground italic">{completed.evidence}</p>
                          {completed.selected && (
                            <div className="pt-1">
                              <Input
                                value={completed.completion_notes || ''}
                                onChange={(e) => updateCompletedNotes(index, e.target.value)}
                                placeholder="How was this completed? (optional notes)"
                                className="h-8 text-sm bg-background"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
            Skip
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={totalSelected === 0 || isLoading || isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Apply ${totalSelected} ${totalSelected === 1 ? 'Change' : 'Changes'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
