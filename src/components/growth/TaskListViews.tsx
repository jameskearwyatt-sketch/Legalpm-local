import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trash2, User, Check, ChevronDown, ChevronRight, Keyboard, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  type GrowthTask, 
  type TaskImportance, 
  type TaskUrgency, 
  type TaskEffort,
  calculateDueDate 
} from '@/lib/hooks/useGrowthProjects';
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
}

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
}: TaskRowProps) => {
  const { assignees, addAssignee } = useKnownAssignees();
  const [assigneeOpen, setAssigneeOpen] = useState(false);
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
          
          {/* Delegate hint */}
          {showDelegateHint && task.urgency === 'urgent' && task.importance === 'not_important' && !task.assignee && (
            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger asChild>
                <button 
                  type="button"
                  className="inline-flex items-center text-[10px] px-1.5 py-0.5 border border-dashed border-sky-300 rounded-full text-sky-500 hover:bg-sky-50 transition-colors"
                >
                  <User className="h-2.5 w-2.5 mr-1" />
                  Delegate?
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-2">
                  <Input
                    ref={inputRef}
                    value={editingAssignee}
                    onChange={(e) => setEditingAssignee(e.target.value)}
                    placeholder="Assign to..."
                    className="h-8 text-sm"
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
                </div>
              </PopoverContent>
            </Popover>
          )}
          
          {task.assignee && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <User className="h-2.5 w-2.5" />
              {task.assignee}
            </span>
          )}
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
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
  const [triageMode, setTriageMode] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [showUntriagedOnly, setShowUntriagedOnly] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [collapsedQuadrants, setCollapsedQuadrants] = useState<Set<EisenhowerQuadrant>>(new Set(['eliminate']));
  
  const pendingTasks = tasks.filter(t => !t.is_completed);
  
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
  
  // Flat list for keyboard navigation
  const flatTaskList = useMemo(() => {
    const order: EisenhowerQuadrant[] = ['do_first', 'schedule', 'delegate', 'eliminate', 'untriaged'];
    return order.flatMap(q => collapsedQuadrants.has(q) ? [] : groupedTasks[q]);
  }, [groupedTasks, collapsedQuadrants]);
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!triageMode) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const focusedTask = flatTaskList[focusedIndex];
      if (!focusedTask && !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      
      switch (e.key.toLowerCase()) {
        case 'u':
          e.preventDefault();
          onUpdateTask(focusedTask.id, { urgency: focusedTask.urgency === 'urgent' ? 'unset' : 'urgent' });
          if (autoAdvance) setFocusedIndex(i => Math.min(i + 1, flatTaskList.length - 1));
          break;
        case 'n':
          e.preventDefault();
          onUpdateTask(focusedTask.id, { urgency: focusedTask.urgency === 'not_urgent' ? 'unset' : 'not_urgent' });
          if (autoAdvance) setFocusedIndex(i => Math.min(i + 1, flatTaskList.length - 1));
          break;
        case 'i':
          e.preventDefault();
          onUpdateTask(focusedTask.id, { importance: focusedTask.importance === 'important' ? 'unset' : 'important' });
          if (autoAdvance) setFocusedIndex(i => Math.min(i + 1, flatTaskList.length - 1));
          break;
        case 'o':
          e.preventDefault();
          onUpdateTask(focusedTask.id, { importance: focusedTask.importance === 'not_important' ? 'unset' : 'not_important' });
          if (autoAdvance) setFocusedIndex(i => Math.min(i + 1, flatTaskList.length - 1));
          break;
        case 'q':
          e.preventDefault();
          onUpdateTask(focusedTask.id, { effort: focusedTask.effort === 'quick_win' ? 'unset' : 'quick_win' });
          if (autoAdvance) setFocusedIndex(i => Math.min(i + 1, flatTaskList.length - 1));
          break;
        case 'd':
          e.preventDefault();
          onUpdateTask(focusedTask.id, { effort: focusedTask.effort === 'deep_work' ? 'unset' : 'deep_work' });
          if (autoAdvance) setFocusedIndex(i => Math.min(i + 1, flatTaskList.length - 1));
          break;
        case ' ':
          e.preventDefault();
          onToggleComplete(focusedTask.id);
          break;
        case 'enter':
          e.preventDefault();
          setFocusedIndex(i => Math.min(i + 1, flatTaskList.length - 1));
          break;
        case 'arrowdown':
          e.preventDefault();
          setFocusedIndex(i => Math.min(i + 1, flatTaskList.length - 1));
          break;
        case 'arrowup':
          e.preventDefault();
          setFocusedIndex(i => Math.max(i - 1, 0));
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triageMode, focusedIndex, flatTaskList, onUpdateTask, onToggleComplete, autoAdvance]);
  
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
            {tasksInQuadrant.map((task) => {
              const idx = flatTaskList.findIndex(t => t.id === task.id);
              return (
                <div key={task.id} className="group">
                  <TaskRow
                    task={task}
                    onUpdate={(updates) => onUpdateTask(task.id, updates)}
                    onDelete={() => onDeleteTask(task.id)}
                    onToggleComplete={(notes) => onToggleComplete(task.id, notes)}
                    isSelected={selectedTasks.has(task.id)}
                    onSelect={(s) => handleSelectTask(task.id, s)}
                    isFocused={triageMode && idx === focusedIndex}
                    triageMode={triageMode}
                    showDelegateHint={quadrant === 'delegate'}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Switch
            id="triage-mode"
            checked={triageMode}
            onCheckedChange={(checked) => {
              setTriageMode(checked);
              if (checked && flatTaskList.length > 0) setFocusedIndex(0);
            }}
          />
          <Label htmlFor="triage-mode" className="flex items-center gap-1.5 cursor-pointer">
            <Keyboard className="h-4 w-4" />
            Triage Mode
          </Label>
        </div>
        
        {triageMode && (
          <>
            <div className="flex items-center gap-2">
              <Switch
                id="auto-advance"
                checked={autoAdvance}
                onCheckedChange={setAutoAdvance}
              />
              <Label htmlFor="auto-advance" className="text-sm cursor-pointer">Auto-advance</Label>
            </div>
            <div className="text-xs text-muted-foreground border-l pl-4">
              <span className="font-mono">U</span>/N urgency • 
              <span className="font-mono ml-1">I</span>/O importance • 
              <span className="font-mono ml-1">Q</span>/D effort • 
              <span className="font-mono ml-1">Space</span> complete • 
              <span className="font-mono ml-1">↑↓</span> navigate
            </div>
          </>
        )}
        
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
