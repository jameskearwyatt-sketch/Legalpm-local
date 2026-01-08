import { useMemo, useState, useEffect, useRef } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, User, Check, ChevronDown, ChevronRight, Filter, Clock, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import {
  type GrowthTask, 
  type TaskImportance, 
  type TaskUrgency, 
  type TaskEffort,
  type TaskDeadlineType,
  calculateDueDate,
  getDeadlineLabel
} from '@/lib/hooks/useGrowthProjects';
import { getDeadlineBadgeColor } from '@/lib/deadlineColors';
import { 
  TriagePills, 
  getQuadrant, 
  quadrantInfo, 
  isFullyTriaged,
  type EisenhowerQuadrant 
} from './TriagePills';
import { useKnownAssignees } from '@/lib/hooks/useGrowthProjects';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface TaskListViewsProps {
  tasks: GrowthTask[];
  onUpdateTask: (id: string, updates: Partial<GrowthTask>) => void;
  onDeleteTask: (id: string) => void;
  onToggleComplete: (id: string, completionNotes?: string) => void;
  view: 'focus' | 'matrix';
}

interface TaskRowProps {
  task: GrowthTask;
  onUpdate: (updates: Partial<GrowthTask>) => void;
  onDelete: () => void;
  onToggleComplete: (notes?: string) => void;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  isFocused: boolean;
  triageMode: boolean;
  showDelegateHint?: boolean;
  compact?: boolean;
  onCompleteWithNotes?: () => void;
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

const TaskRow = ({ 
  task, 
  onUpdate, 
  onDelete, 
  onToggleComplete, 
  isSelected,
  onSelect,
  isFocused,
  triageMode,
  showDelegateHint = false,
  compact = false,
  onCompleteWithNotes,
}: TaskRowProps) => {
  const { assignees, addAssignee } = useKnownAssignees();
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(task.assignee || '');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isTriaged = isFullyTriaged(task.urgency, task.importance, task.effort);

  useEffect(() => {
    if (assigneeOpen) {
      setEditingAssignee(task.assignee || '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [assigneeOpen, task.assignee]);

  const handleAssigneeSelect = (name: string) => {
    onUpdate({ assignee: name || null });
    setAssigneeOpen(false);
    if (name && !assignees.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      addAssignee.mutate(name);
    }
  };

  const handleDeadlineSelect = (deadline: TaskDeadlineType) => {
    // When selecting a deadline, also update deadline_set_at to now if changing from no_deadline
    const updates: Partial<GrowthTask> = { deadline_type: deadline };
    if (deadline !== 'no_deadline' && !task.deadline_set_at) {
      updates.deadline_set_at = new Date().toISOString();
    }
    onUpdate(updates);
    setDeadlineOpen(false);
  };

  const getDeadlineColor = () => {
    if (!task.deadline_set_at || task.deadline_type === 'no_deadline') {
      return 'text-muted-foreground';
    }
    const dueDate = calculateDueDate(new Date(task.deadline_set_at), task.deadline_type);
    return getDeadlineBadgeColor(dueDate, task.is_completed);
  };

  return (
    <div 
      className={cn(
        "flex items-start gap-2 p-2 rounded-lg border transition-all",
        task.is_completed ? 'bg-muted/30 opacity-60' : 'bg-background',
        isFocused && 'ring-2 ring-primary ring-offset-1',
        isSelected && 'bg-primary/5'
      )}
    >
      {/* Multi-select checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelect(!!checked)}
        className="mt-1"
      />
      
      {/* Complete checkbox */}
      <Checkbox
        checked={task.is_completed}
        onCheckedChange={() => onToggleComplete()}
        className="mt-1"
      />
      
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium truncate",
            task.is_completed && 'line-through text-muted-foreground'
          )}>
            {task.title}
          </span>
          {isTriaged && !task.is_completed && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-green-50 text-green-600 border-green-200">
              <Check className="h-2.5 w-2.5 mr-0.5" />
              Triaged
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <TriagePills
            urgency={task.urgency}
            importance={task.importance}
            effort={task.effort}
            onUrgencyChange={(v) => onUpdate({ urgency: v })}
            onImportanceChange={(v) => onUpdate({ importance: v })}
            onEffortChange={(v) => onUpdate({ effort: v })}
            triageMode={triageMode}
            disabled={task.is_completed}
            compact={compact}
          />
          
          {/* Clickable Assignee */}
          <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <PopoverTrigger asChild>
              <button 
                type="button"
                className={cn(
                  "inline-flex items-center text-[10px] px-1.5 py-0.5 border rounded-full cursor-pointer hover:bg-accent transition-colors",
                  task.is_completed && "opacity-60",
                  !task.assignee && "border-dashed text-muted-foreground"
                )}
              >
                <User className="h-2.5 w-2.5 mr-1" />
                {task.assignee || 'Assign'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-2">
                <Input
                  ref={inputRef}
                  value={editingAssignee}
                  onChange={(e) => setEditingAssignee(e.target.value)}
                  placeholder="Type or select..."
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAssigneeSelect(editingAssignee);
                    }
                  }}
                />
                {assignees.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-0.5">
                    {assignees
                      .filter(a => a.name.toLowerCase().includes(editingAssignee.toLowerCase()))
                      .map((assignee) => (
                        <button
                          key={assignee.id}
                          className="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent"
                          onClick={() => handleAssigneeSelect(assignee.name)}
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
                    className="flex-1 h-6 text-[10px]"
                    onClick={() => handleAssigneeSelect('')}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-6 text-[10px]"
                    onClick={() => handleAssigneeSelect(editingAssignee)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Clickable Deadline */}
          <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
            <PopoverTrigger asChild>
              <button 
                type="button"
                className={cn(
                  "inline-flex items-center text-[10px] px-1.5 py-0.5 border rounded-full cursor-pointer hover:bg-accent transition-colors",
                  getDeadlineColor(),
                  task.deadline_type === 'no_deadline' && "border-dashed"
                )}
              >
                <Clock className="h-2.5 w-2.5 mr-1" />
                {getDeadlineLabel(task.deadline_type)}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="start">
              <div className="space-y-0.5">
                {deadlineOptions.map((opt) => (
                  <button
                    key={opt}
                    className={cn(
                      "w-full text-left px-2 py-1 text-xs rounded hover:bg-accent transition-colors flex items-center justify-between",
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
        </div>
      </div>
      
      <div className="flex items-center gap-0.5">
        {onCompleteWithNotes && !task.is_completed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onCompleteWithNotes();
            }}
            title="Complete with notes"
          >
            <MessageSquare className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

// Sort tasks within a quadrant
const sortTasksInQuadrant = (tasks: GrowthTask[]): GrowthTask[] => {
  return [...tasks].sort((a, b) => {
    // Quick wins first
    if (a.effort === 'quick_win' && b.effort !== 'quick_win') return -1;
    if (a.effort !== 'quick_win' && b.effort === 'quick_win') return 1;
    
    // Then by due date
    const aDate = a.deadline_set_at ? calculateDueDate(new Date(a.deadline_set_at), a.deadline_type) : new Date(9999, 11, 31);
    const bDate = b.deadline_set_at ? calculateDueDate(new Date(b.deadline_set_at), b.deadline_type) : new Date(9999, 11, 31);
    if (aDate.getTime() !== bDate.getTime()) return aDate.getTime() - bDate.getTime();
    
    // Then by created date
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
};

// Today's Focus View
export const TodaysFocusView = ({ 
  tasks, 
  onUpdateTask, 
  onDeleteTask, 
  onToggleComplete 
}: Omit<TaskListViewsProps, 'view'>) => {
  const [showUntriagedOnly, setShowUntriagedOnly] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [collapsedQuadrants, setCollapsedQuadrants] = useState<Set<EisenhowerQuadrant>>(new Set(['eliminate']));
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  
  // Completion notes dialog state
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<GrowthTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  
  const pendingTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed).sort((a, b) => 
    new Date(b.completed_at || b.updated_at).getTime() - new Date(a.completed_at || a.updated_at).getTime()
  );
  
  // Group tasks by quadrant
  const groupedTasks = useMemo(() => {
    let filtered = pendingTasks;
    if (showUntriagedOnly) {
      filtered = filtered.filter(t => !isFullyTriaged(t.urgency, t.importance, t.effort));
    }
    
    const groups: Record<EisenhowerQuadrant, GrowthTask[]> = {
      do_first: [],
      schedule: [],
      delegate: [],
      eliminate: [],
      untriaged: [],
    };
    
    filtered.forEach(task => {
      const quadrant = getQuadrant(task.urgency, task.importance);
      groups[quadrant].push(task);
    });
    
    // Sort within each quadrant
    Object.keys(groups).forEach(key => {
      groups[key as EisenhowerQuadrant] = sortTasksInQuadrant(groups[key as EisenhowerQuadrant]);
    });
    
    return groups;
  }, [pendingTasks, showUntriagedOnly]);
  
  const toggleQuadrant = (quadrant: EisenhowerQuadrant) => {
    setCollapsedQuadrants(prev => {
      const next = new Set(prev);
      if (next.has(quadrant)) {
        next.delete(quadrant);
      } else {
        next.add(quadrant);
      }
      return next;
    });
  };
  
  const handleSelectTask = (taskId: string, selected: boolean) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (selected) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };
  
  const handleBulkUpdate = (updates: Partial<GrowthTask>) => {
    selectedTasks.forEach(id => {
      onUpdateTask(id, updates);
    });
    setSelectedTasks(new Set());
  };
  
  // Handle completion with notes
  const handleCompleteWithNotes = (task: GrowthTask) => {
    setTaskToComplete(task);
    setCompletionNotes('');
    setShowCompleteDialog(true);
  };

  const handleConfirmComplete = () => {
    if (taskToComplete) {
      onToggleComplete(taskToComplete.id, completionNotes || undefined);
    }
    setShowCompleteDialog(false);
    setTaskToComplete(null);
    setCompletionNotes('');
  };
  
  const renderQuadrant = (quadrant: EisenhowerQuadrant) => {
    const tasksInQuadrant = groupedTasks[quadrant];
    if (tasksInQuadrant.length === 0) return null;
    
    const info = quadrantInfo[quadrant];
    const isCollapsed = collapsedQuadrants.has(quadrant);
    
    return (
      <div key={quadrant} className={cn("rounded-lg border p-3", info.color)}>
        <button
          type="button"
          className="flex items-center gap-2 w-full text-left mb-2"
          onClick={() => toggleQuadrant(quadrant)}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="font-medium text-sm">{info.label}</span>
          <Badge variant="secondary" className="text-xs">{tasksInQuadrant.length}</Badge>
          <span className="text-xs text-muted-foreground ml-auto">{info.guidance}</span>
        </button>
        
        {!isCollapsed && (
          <div className="space-y-1.5">
            {tasksInQuadrant.map((task) => (
              <div key={task.id} className="group">
                <TaskRow
                  task={task}
                  onUpdate={(updates) => onUpdateTask(task.id, updates)}
                  onDelete={() => onDeleteTask(task.id)}
                  onToggleComplete={() => onToggleComplete(task.id)}
                  isSelected={selectedTasks.has(task.id)}
                  onSelect={(s) => handleSelectTask(task.id, s)}
                  isFocused={false}
                  triageMode={false}
                  showDelegateHint={quadrant === 'delegate'}
                  onCompleteWithNotes={() => handleCompleteWithNotes(task)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* Completion Notes Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
            <DialogDescription>
              {taskToComplete?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Completion Notes (optional)</label>
              <Textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Add notes about what was done, outcomes, or follow-ups..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmComplete}>
              Complete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setShowUntriagedOnly(!showUntriagedOnly)}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors",
              showUntriagedOnly ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            <Filter className="h-3 w-3" />
            Untriaged only
          </button>
        </div>
      </div>
      
      {/* Bulk action bar */}
      {selectedTasks.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
          <span className="text-sm font-medium">{selectedTasks.size} selected</span>
          <div className="flex gap-1 ml-4">
            <Button size="sm" variant="outline" onClick={() => handleBulkUpdate({ urgency: 'urgent' })}>
              Urgent
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkUpdate({ urgency: 'not_urgent' })}>
              Not urgent
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkUpdate({ importance: 'important' })}>
              Important
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkUpdate({ importance: 'not_important' })}>
              Not important
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkUpdate({ effort: 'quick_win' })}>
              Quick win
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkUpdate({ effort: 'deep_work' })}>
              Deep work
            </Button>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setSelectedTasks(new Set())}
            className="ml-auto"
          >
            Clear selection
          </Button>
        </div>
      )}
      
      {/* Quadrants in priority order */}
      <div className="space-y-3">
        {renderQuadrant('do_first')}
        {renderQuadrant('schedule')}
        {renderQuadrant('delegate')}
        {renderQuadrant('eliminate')}
        {renderQuadrant('untriaged')}
      </div>
      
      {pendingTasks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No pending tasks
        </div>
      )}
      
      {/* Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <button
            type="button"
            className="flex items-center gap-2 w-full text-left mb-3"
            onClick={() => setShowCompletedTasks(!showCompletedTasks)}
          >
            {showCompletedTasks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-medium text-sm text-muted-foreground">Completed Tasks</span>
            <Badge variant="secondary" className="text-xs">{completedTasks.length}</Badge>
          </button>
          
          {showCompletedTasks && (
            <div className="space-y-2">
              {completedTasks.slice(0, 10).map(task => (
                <div 
                  key={task.id} 
                  className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 group"
                >
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={() => onToggleComplete(task.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-through text-muted-foreground">
                      {task.title}
                    </p>
                    {task.completion_notes && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                        <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                        {task.completion_notes}
                      </p>
                    )}
                    {task.completed_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Completed {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteTask(task.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {completedTasks.length > 10 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  + {completedTasks.length - 10} more completed tasks
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Matrix View (2x2 Eisenhower Grid)
export const MatrixView = ({ 
  tasks, 
  onUpdateTask, 
  onDeleteTask, 
  onToggleComplete 
}: Omit<TaskListViewsProps, 'view'>) => {
  const pendingTasks = tasks.filter(t => !t.is_completed);
  
  const groupedTasks = useMemo(() => {
    const groups: Record<EisenhowerQuadrant, GrowthTask[]> = {
      do_first: [],
      schedule: [],
      delegate: [],
      eliminate: [],
      untriaged: [],
    };
    
    pendingTasks.forEach(task => {
      const quadrant = getQuadrant(task.urgency, task.importance);
      groups[quadrant].push(task);
    });
    
    Object.keys(groups).forEach(key => {
      groups[key as EisenhowerQuadrant] = sortTasksInQuadrant(groups[key as EisenhowerQuadrant]);
    });
    
    return groups;
  }, [pendingTasks]);
  
  const renderQuadrantCell = (quadrant: EisenhowerQuadrant) => {
    const info = quadrantInfo[quadrant];
    const tasksInQuadrant = groupedTasks[quadrant];
    
    return (
      <div className={cn("rounded-lg border p-3 min-h-[200px]", info.color)}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm">{info.label}</span>
          <Badge variant="secondary" className="text-xs">{tasksInQuadrant.length}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">{info.guidance}</p>
        
        <div className="space-y-2">
          {tasksInQuadrant.map(task => (
            <div 
              key={task.id} 
              className="bg-white/80 rounded p-2 border shadow-sm space-y-1.5"
            >
              <div className="flex items-start gap-1.5">
                <Checkbox
                  checked={task.is_completed}
                  onCheckedChange={() => onToggleComplete(task.id)}
                  className="mt-0.5"
                />
                <span className="text-xs font-medium flex-1">{task.title}</span>
              </div>
              
              <div className="flex items-center gap-1 flex-wrap">
                <TriagePills
                  urgency={task.urgency}
                  importance={task.importance}
                  effort={task.effort}
                  onUrgencyChange={(v) => onUpdateTask(task.id, { urgency: v })}
                  onImportanceChange={(v) => onUpdateTask(task.id, { importance: v })}
                  onEffortChange={(v) => onUpdateTask(task.id, { effort: v })}
                  compact
                />
              </div>
              
              {task.assignee && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <User className="h-2.5 w-2.5" />
                  {task.assignee}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Row labels */}
        <div className="col-span-2 grid grid-cols-[auto_1fr_1fr] gap-3 items-end">
          <div className="w-20" />
          <div className="text-center text-xs font-medium text-muted-foreground">URGENT</div>
          <div className="text-center text-xs font-medium text-muted-foreground">NOT URGENT</div>
        </div>
        
        {/* Important row */}
        <div className="col-span-2 grid grid-cols-[auto_1fr_1fr] gap-3">
          <div className="w-20 flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground -rotate-90 whitespace-nowrap">IMPORTANT</span>
          </div>
          {renderQuadrantCell('do_first')}
          {renderQuadrantCell('schedule')}
        </div>
        
        {/* Not important row */}
        <div className="col-span-2 grid grid-cols-[auto_1fr_1fr] gap-3">
          <div className="w-20 flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground -rotate-90 whitespace-nowrap">NOT IMPORTANT</span>
          </div>
          {renderQuadrantCell('delegate')}
          {renderQuadrantCell('eliminate')}
        </div>
      </div>
      
      {/* Untriaged section */}
      {groupedTasks.untriaged.length > 0 && (
        <div className={cn("rounded-lg border p-3", quadrantInfo.untriaged.color)}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-sm">{quadrantInfo.untriaged.label}</span>
            <Badge variant="secondary" className="text-xs">{groupedTasks.untriaged.length}</Badge>
            <span className="text-xs text-muted-foreground ml-auto">{quadrantInfo.untriaged.guidance}</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {groupedTasks.untriaged.map(task => (
              <div 
                key={task.id} 
                className="bg-white/80 rounded p-2 border shadow-sm space-y-1.5"
              >
                <div className="flex items-start gap-1.5">
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={() => onToggleComplete(task.id)}
                    className="mt-0.5"
                  />
                  <span className="text-xs font-medium flex-1">{task.title}</span>
                </div>
                
                <TriagePills
                  urgency={task.urgency}
                  importance={task.importance}
                  effort={task.effort}
                  onUrgencyChange={(v) => onUpdateTask(task.id, { urgency: v })}
                  onImportanceChange={(v) => onUpdateTask(task.id, { importance: v })}
                  onEffortChange={(v) => onUpdateTask(task.id, { effort: v })}
                  compact
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const TaskListViews = (props: TaskListViewsProps) => {
  if (props.view === 'matrix') {
    return <MatrixView {...props} />;
  }
  return <TodaysFocusView {...props} />;
};
