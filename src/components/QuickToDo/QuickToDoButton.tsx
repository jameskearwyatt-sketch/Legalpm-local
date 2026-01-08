import { useState, useEffect, useRef, useMemo } from "react";
import { 
  CheckSquare, X, Plus, Trash2, ArrowRight, Clock, User,
  Briefcase, GraduationCap, Lightbulb, Maximize2, Minimize2,
  ListTodo, LayoutGrid, Filter, Check, ChevronDown, ChevronRight,
  Zap, Target, CalendarClock, Feather, Flame
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { 
  useGrowthProjects, 
  type TaskDeadlineType, 
  getDeadlineLabel, 
  useKnownAssignees,
  useMyUpcomingGrowthTasks,
  calculateDueDate,
  type TaskWithProject,
} from "@/lib/hooks/useGrowthProjects";

// Types
type TaskImportance = 'important' | 'not_important' | 'unset';
type TaskUrgency = 'urgent' | 'not_urgent' | 'unset';
type TaskEffort = 'quick_win' | 'deep_work' | 'unset';
type EisenhowerQuadrant = 'do_first' | 'schedule' | 'delegate' | 'eliminate' | 'untriaged';

interface QuickTask {
  id: string;
  title: string;
  is_completed: boolean;
  is_urgent: boolean;
  importance: TaskImportance;
  urgency: TaskUrgency;
  effort: TaskEffort;
  created_at: string;
}

// Unified task type for display - can be a QuickTask or a Growth Task
interface UnifiedTask {
  id: string;
  title: string;
  is_completed: boolean;
  importance: TaskImportance;
  urgency: TaskUrgency;
  effort: TaskEffort;
  created_at: string;
  // Growth task specific
  source: 'quick' | 'growth';
  projectName?: string;
  projectId?: string;
  dueDate?: Date;
}

const STORAGE_KEY = 'todo-button-position';

const deadlineOptions: TaskDeadlineType[] = [
  'this_week',
  'next_week',
  'this_month',
  'next_month',
  'in_3_months',
  'in_6_months',
  'no_deadline',
];

// Helpers
const isFullyTriaged = (task: UnifiedTask | QuickTask): boolean => {
  return task.urgency !== 'unset' && task.importance !== 'unset' && task.effort !== 'unset';
};

const getQuadrant = (urgency: TaskUrgency, importance: TaskImportance): EisenhowerQuadrant => {
  if (urgency === 'unset' || importance === 'unset') return 'untriaged';
  if (urgency === 'urgent' && importance === 'important') return 'do_first';
  if (urgency === 'not_urgent' && importance === 'important') return 'schedule';
  if (urgency === 'urgent' && importance === 'not_important') return 'delegate';
  return 'eliminate';
};

const quadrantInfo: Record<EisenhowerQuadrant, { label: string; guidance: string; color: string }> = {
  do_first: { label: 'Do First', guidance: 'Crises & deadlines', color: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800' },
  schedule: { label: 'Schedule', guidance: 'Strategic work', color: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' },
  delegate: { label: 'Delegate', guidance: 'Admin tasks', color: 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800' },
  eliminate: { label: 'Defer/Drop', guidance: 'Low value', color: 'bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-700' },
  untriaged: { label: 'Untriaged', guidance: 'Needs classification', color: 'bg-white border-dashed dark:bg-slate-900 dark:border-slate-700' },
};

// Triage Pills Component
interface TriagePillsProps {
  task: UnifiedTask | QuickTask;
  onUpdate: (updates: Partial<QuickTask>) => void;
  compact?: boolean;
  disabled?: boolean;
}

const TriagePills = ({ task, onUpdate, compact = false, disabled = false }: TriagePillsProps) => {
  const iconSize = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  
  const handleUrgencyClick = (value: 'urgent' | 'not_urgent') => {
    if (disabled) return;
    onUpdate({ urgency: task.urgency === value ? 'unset' : value });
  };

  const handleImportanceClick = (value: 'important' | 'not_important') => {
    if (disabled) return;
    onUpdate({ importance: task.importance === value ? 'unset' : value });
  };

  const handleEffortClick = (value: 'quick_win' | 'deep_work') => {
    if (disabled) return;
    onUpdate({ effort: task.effort === value ? 'unset' : value });
  };

  const pillBase = cn(
    "inline-flex items-center gap-1 rounded-full border transition-all duration-150 cursor-pointer active:scale-95 font-medium whitespace-nowrap",
    compact ? "text-[11px] px-2 py-1" : "text-xs px-2.5 py-1",
    disabled && "opacity-50 cursor-not-allowed"
  );

  return (
    <div className="flex flex-wrap gap-1">
      {/* Urgency */}
      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => handleUrgencyClick('urgent')}
          disabled={disabled}
          className={cn(
            pillBase,
            task.urgency === 'urgent' 
              ? 'bg-red-500 text-white border-red-500 shadow-sm' 
              : 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/50',
            task.urgency === 'unset' && 'opacity-60'
          )}
          title="Urgent"
        >
          <Zap className={iconSize} />
          <span>Urgent</span>
        </button>
        <button
          type="button"
          onClick={() => handleUrgencyClick('not_urgent')}
          disabled={disabled}
          className={cn(
            pillBase,
            task.urgency === 'not_urgent'
              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
              : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/50',
            task.urgency === 'unset' && 'opacity-60'
          )}
          title="Not Urgent"
        >
          <Clock className={iconSize} />
          <span>Not Urgent</span>
        </button>
      </div>

      {/* Importance */}
      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => handleImportanceClick('important')}
          disabled={disabled}
          className={cn(
            pillBase,
            task.importance === 'important'
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/50',
            task.importance === 'unset' && 'opacity-60'
          )}
          title="Important"
        >
          <Target className={iconSize} />
          <span>Important</span>
        </button>
        <button
          type="button"
          onClick={() => handleImportanceClick('not_important')}
          disabled={disabled}
          className={cn(
            pillBase,
            task.importance === 'not_important'
              ? 'bg-slate-500 text-white border-slate-500 shadow-sm'
              : 'border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800/50',
            task.importance === 'unset' && 'opacity-60'
          )}
          title="Not Important"
        >
          <span>Not Imp.</span>
        </button>
      </div>

      {/* Effort */}
      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => handleEffortClick('quick_win')}
          disabled={disabled}
          className={cn(
            pillBase,
            task.effort === 'quick_win'
              ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
              : 'border-sky-300 text-sky-600 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/50',
            task.effort === 'unset' && 'opacity-60'
          )}
          title="Quick Win - Small task"
        >
          <Feather className={iconSize} />
          <span>Quick</span>
        </button>
        <button
          type="button"
          onClick={() => handleEffortClick('deep_work')}
          disabled={disabled}
          className={cn(
            pillBase,
            task.effort === 'deep_work'
              ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
              : 'border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/50',
            task.effort === 'unset' && 'opacity-60'
          )}
          title="Deep Work - Requires focus"
        >
          <Flame className={iconSize} />
          <span>Deep</span>
        </button>
      </div>
    </div>
  );
};

export function QuickToDoButton() {
  const { user } = useAuth();
  const { projects } = useGrowthProjects();
  const { assignees } = useKnownAssignees();
  const { upcomingTasks: upcomingGrowthTasks, refetch: refetchGrowthTasks } = useMyUpcomingGrowthTasks();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [tasks, setTasks] = useState<QuickTask[]>([]);
  const [newTask, setNewTask] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<'focus' | 'matrix'>('focus');
  const [showUntriagedOnly, setShowUntriagedOnly] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [collapsedQuadrants, setCollapsedQuadrants] = useState<Set<EisenhowerQuadrant>>(new Set(['eliminate']));

  // Move to Growth dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [taskToMove, setTaskToMove] = useState<QuickTask | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [selectedDeadline, setSelectedDeadline] = useState<TaskDeadlineType>("no_deadline");
  const [isMoving, setIsMoving] = useState(false);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load saved position on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const maxX = window.innerWidth - 56;
        const maxY = window.innerHeight - 56;
        setPosition({
          x: Math.min(Math.max(0, parsed.x), maxX),
          y: Math.min(Math.max(0, parsed.y), maxY),
        });
      } catch {
        // Invalid saved position, use default
      }
    }
  }, []);

  // Save position when it changes
  useEffect(() => {
    if (position) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }
  }, [position]);

  // Load tasks
  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('quick_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }

    // Map data with defaults for new columns
    const mappedTasks: QuickTask[] = (data || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      is_completed: t.is_completed,
      is_urgent: t.is_urgent,
      importance: t.importance || 'unset',
      urgency: t.urgency || 'unset',
      effort: t.effort || 'unset',
      created_at: t.created_at,
    }));

    setTasks(mappedTasks);
  };

  const addTask = async () => {
    if (!newTask.trim() || !user) return;

    setIsLoading(true);
    const { error } = await supabase
      .from('quick_tasks')
      .insert({
        title: newTask.trim(),
        user_id: user.id,
      });

    if (error) {
      toast.error('Failed to add task');
      console.error('Error adding task:', error);
    } else {
      setNewTask("");
      fetchTasks();
    }
    setIsLoading(false);
  };

  const toggleTask = async (task: UnifiedTask) => {
    if (task.source === 'growth') {
      // Toggle growth task
      const realId = task.id.replace('growth-', '');
      const { error } = await supabase
        .from('growth_tasks')
        .update({
          is_completed: !task.is_completed,
          completed_at: !task.is_completed ? new Date().toISOString() : null,
        })
        .eq('id', realId);

      if (error) {
        toast.error('Failed to update task');
      } else {
        refetchGrowthTasks();
      }
    } else {
      // Toggle quick task
      const { error } = await supabase
        .from('quick_tasks')
        .update({
          is_completed: !task.is_completed,
          completed_at: !task.is_completed ? new Date().toISOString() : null,
        })
        .eq('id', task.id);

      if (error) {
        toast.error('Failed to update task');
      } else {
        fetchTasks();
      }
    }
  };

  const updateTask = async (taskId: string, updates: Partial<QuickTask>) => {
    if (taskId.startsWith('growth-')) {
      // Update growth task
      const realId = taskId.replace('growth-', '');
      const { error } = await supabase
        .from('growth_tasks')
        .update(updates)
        .eq('id', realId);

      if (error) {
        toast.error('Failed to update task');
      } else {
        refetchGrowthTasks();
      }
    } else {
      // Update quick task (optimistic)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      
      const { error } = await supabase
        .from('quick_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) {
        toast.error('Failed to update task');
        fetchTasks(); // Revert on error
      }
    }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('quick_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      toast.error('Failed to delete task');
    } else {
      fetchTasks();
    }
  };

  const openMoveDialog = (task: UnifiedTask) => {
    if (task.source !== 'quick') return; // Only allow moving quick tasks
    // Convert back to QuickTask for the dialog
    const quickTask: QuickTask = {
      id: task.id,
      title: task.title,
      is_completed: task.is_completed,
      is_urgent: task.urgency === 'urgent',
      importance: task.importance,
      urgency: task.urgency,
      effort: task.effort,
      created_at: task.created_at,
    };
    setTaskToMove(quickTask);
    setSelectedProject("");
    setSelectedAssignee("__unassigned__");
    setSelectedDeadline("no_deadline");
    setMoveDialogOpen(true);
  };

  const handleMoveToGrowth = async () => {
    if (!taskToMove || !selectedProject || !user) return;

    setIsMoving(true);
    try {
      const { error: insertError } = await supabase
        .from('growth_tasks')
        .insert({
          title: taskToMove.title,
          project_id: selectedProject,
          user_id: user.id,
          assignee: selectedAssignee === '__unassigned__' ? null : selectedAssignee,
          deadline_type: selectedDeadline,
          deadline_set_at: selectedDeadline !== 'no_deadline' ? new Date().toISOString() : null,
          importance: taskToMove.importance,
          urgency: taskToMove.urgency,
          effort: taskToMove.effort,
        });

      if (insertError) throw insertError;

      const { error: deleteError } = await supabase
        .from('quick_tasks')
        .delete()
        .eq('id', taskToMove.id);

      if (deleteError) throw deleteError;

      toast.success('Task moved to Growth project');
      setMoveDialogOpen(false);
      setTaskToMove(null);
      fetchTasks();
    } catch (error) {
      console.error('Error moving task:', error);
      toast.error('Failed to move task');
    } finally {
      setIsMoving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  };

  // Convert Growth tasks to unified format
  const unifiedGrowthTasks: UnifiedTask[] = useMemo(() => {
    return upcomingGrowthTasks.map(gt => ({
      id: `growth-${gt.id}`,
      title: gt.title,
      is_completed: gt.is_completed,
      importance: gt.importance,
      urgency: gt.urgency,
      effort: gt.effort,
      created_at: gt.created_at,
      source: 'growth' as const,
      projectName: gt.growth_projects.name,
      projectId: gt.project_id,
      dueDate: gt.deadline_set_at 
        ? calculateDueDate(new Date(gt.deadline_set_at), gt.deadline_type)
        : undefined,
    }));
  }, [upcomingGrowthTasks]);

  // Convert Quick tasks to unified format
  const unifiedQuickTasks: UnifiedTask[] = useMemo(() => {
    return tasks.map(t => ({
      ...t,
      source: 'quick' as const,
    }));
  }, [tasks]);

  // All unified tasks
  const allUnifiedTasks = useMemo(() => {
    return [...unifiedQuickTasks, ...unifiedGrowthTasks];
  }, [unifiedQuickTasks, unifiedGrowthTasks]);

  // Grouped tasks for Focus view
  const pendingTasks = useMemo(() => allUnifiedTasks.filter(t => !t.is_completed), [allUnifiedTasks]);
  const completedTasks = useMemo(() => tasks.filter(t => t.is_completed), [tasks]);
  const incompleteTasks = pendingTasks; // alias for badge count
  const completedUnifiedTasks: UnifiedTask[] = useMemo(() => completedTasks.map(t => ({ ...t, source: 'quick' as const })), [completedTasks]);

  const groupedTasks = useMemo(() => {
    let filtered = pendingTasks;
    if (showUntriagedOnly) {
      filtered = filtered.filter(t => !isFullyTriaged(t));
    }

    const groups: Record<EisenhowerQuadrant, UnifiedTask[]> = {
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

    // Sort: quick wins first, then by due date (for growth tasks), then by created_at
    Object.keys(groups).forEach(key => {
      groups[key as EisenhowerQuadrant].sort((a, b) => {
        // Quick wins first
        if (a.effort === 'quick_win' && b.effort !== 'quick_win') return -1;
        if (a.effort !== 'quick_win' && b.effort === 'quick_win') return 1;
        // Growth tasks with due dates sort by due date
        if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    });

    return groups;
  }, [pendingTasks, showUntriagedOnly]);


  // Bulk actions
  const handleBulkUpdate = (updates: Partial<QuickTask>) => {
    selectedTasks.forEach(id => updateTask(id, updates));
    setSelectedTasks(new Set());
  };

  // Handle pointer events for dragging (works for both button and panel header)
  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = isOpen ? panelRef.current?.getBoundingClientRect() : buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position?.x ?? 24,
      startPosY: position?.y ?? (window.innerHeight - rect.height - 24),
    };

    setIsDragging(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      setIsDragging(true);
    }

    if (isDragging || Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      const elementSize = isOpen ? 400 : 56; // Panel width or button size
      const newX = Math.min(Math.max(0, dragRef.current.startPosX + deltaX), window.innerWidth - elementSize);
      const newY = Math.min(Math.max(0, dragRef.current.startPosY + deltaY), window.innerHeight - 100);
      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const wasDragging = isDragging;
    dragRef.current = null;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Only toggle open/close if not dragging AND clicking the button (not panel header)
    if (!wasDragging && !isOpen) {
      setIsOpen(true);
    }
  };

  // Panel header drag - only drags, doesn't toggle
  const handlePanelHeaderPointerDown = (e: React.PointerEvent) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position?.x ?? rect.left,
      startPosY: position?.y ?? rect.top,
    };

    setIsDragging(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePanelHeaderPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const getButtonStyle = (): React.CSSProperties => {
    if (position) {
      return {
        position: 'fixed',
        left: position.x,
        top: position.y,
        right: 'auto',
        bottom: 'auto',
      };
    }
    return {
      position: 'fixed',
      left: 24,
      bottom: 24,
    };
  };

  const getPanelStyle = (): React.CSSProperties => {
    const margin = isExpanded ? 24 : 12;
    // Get sidebar width (typically 256px when expanded, ~56px when collapsed)
    const sidebarWidth = 256;
    const panelWidth = isExpanded 
      ? Math.min(window.innerWidth - sidebarWidth - margin * 2, window.innerWidth - 48) 
      : Math.min(420, window.innerWidth - sidebarWidth - 24);
    const panelHeight = isExpanded 
      ? window.innerHeight - margin * 2 - 80
      : 560;

    if (isExpanded) {
      return {
        position: 'fixed',
        left: sidebarWidth + margin,
        top: margin,
        right: 'auto',
        bottom: 'auto',
        width: panelWidth,
        height: panelHeight,
      };
    }

    // Position panel adjacent to sidebar, in top third of screen
    return {
      position: 'fixed',
      left: sidebarWidth,
      top: 60,
      right: 'auto',
      bottom: 'auto',
      width: panelWidth,
      height: 'calc(100vh - 100px)',
    };
  };


  const activeProjects = projects?.filter(p => p.status === 'active') || [];

  // Task Row Component
  const TaskRow = ({ task }: { task: UnifiedTask }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.title);
    const editInputRef = useRef<HTMLInputElement>(null);
    const isTriaged = isFullyTriaged(task);

    useEffect(() => {
      if (isEditing) {
        setEditedTitle(task.title);
        setTimeout(() => {
          editInputRef.current?.focus();
          editInputRef.current?.select();
        }, 0);
      }
    }, [isEditing, task.title]);

    const handleSave = () => {
      if (editedTitle.trim() && editedTitle.trim() !== task.title) {
        updateTask(task.id, { title: editedTitle.trim() });
      }
      setIsEditing(false);
    };

    const handleKeyDownRow = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        setEditedTitle(task.title);
        setIsEditing(false);
      }
    };

    return (
      <div
        className={cn(
          "flex flex-col gap-2 p-3 rounded-lg group transition-all",
          "bg-muted/50 hover:bg-muted/80",
          selectedTasks.has(task.id) && "bg-primary/10"
        )}
      >
        <div className="flex items-center gap-2">
          <Checkbox
            checked={task.is_completed}
            onCheckedChange={() => toggleTask(task)}
            className="h-4 w-4"
          />
          
          {isEditing ? (
            <Input
              ref={editInputRef}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDownRow}
              className="flex-1 h-7 text-sm"
            />
          ) : (
            <span 
              className="flex-1 text-sm cursor-pointer hover:bg-background/50 rounded px-1 -mx-1"
              onClick={() => setIsEditing(true)}
              title="Click to edit"
              style={{ wordBreak: 'break-word' }}
            >
              {task.title}
            </span>
          )}
          
          {isTriaged && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-green-50 text-green-600 border-green-200 dark:bg-green-950/30 shrink-0">
              <Check className="h-2.5 w-2.5 mr-0.5" />
              Done
            </Badge>
          )}
          
          {/* Only show move/delete buttons for quick tasks */}
          {task.source === 'quick' && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => openMoveDialog(task)}
                title="Move to Growth"
              >
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => deleteTask(task.id)}
                title="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          )}
          
          {/* Show project badge and due date for growth tasks */}
          {task.source === 'growth' && (
            <div className="flex items-center gap-1.5 shrink-0">
              {task.dueDate && (
                <Badge variant="outline" className={cn(
                  "text-[10px] px-1.5 py-0.5 h-5",
                  task.dueDate < new Date() 
                    ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30" 
                    : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30"
                )}>
                  <CalendarClock className="h-2.5 w-2.5 mr-0.5" />
                  {formatDistanceToNow(task.dueDate, { addSuffix: true })}
                </Badge>
              )}
              {task.projectName && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30">
                  {task.projectName}
                </Badge>
              )}
            </div>
          )}
        </div>
        
        <TriagePills 
          task={task} 
          onUpdate={(updates) => updateTask(task.id, updates)}
          compact
        />
      </div>
    );
  };

  // Render quadrant section
  const renderQuadrant = (quadrant: EisenhowerQuadrant) => {
    const tasksInQuadrant = groupedTasks[quadrant];
    if (tasksInQuadrant.length === 0) return null;

    const info = quadrantInfo[quadrant];
    const isCollapsed = collapsedQuadrants.has(quadrant);

    return (
      <div key={quadrant} className={cn("rounded-lg border p-2", info.color)}>
        <button
          type="button"
          className="flex items-center gap-2 w-full text-left mb-1"
          onClick={() => {
            setCollapsedQuadrants(prev => {
              const next = new Set(prev);
              if (next.has(quadrant)) next.delete(quadrant);
              else next.add(quadrant);
              return next;
            });
          }}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span className="font-medium text-xs">{info.label}</span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1">{tasksInQuadrant.length}</Badge>
          <span className="text-[10px] text-muted-foreground ml-auto">{info.guidance}</span>
        </button>

        {!isCollapsed && (
          <div className="space-y-1">
            {tasksInQuadrant.map((task) => (
              <TaskRow 
                key={task.id} 
                task={task} 
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render Matrix View
  const renderMatrixView = () => {
    const renderMatrixCell = (quadrant: EisenhowerQuadrant) => {
      const info = quadrantInfo[quadrant];
      const tasksInQuadrant = groupedTasks[quadrant];
      
      return (
        <div className={cn("rounded-lg border p-2 min-h-[120px]", info.color)}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-[10px]">{info.label}</span>
            <Badge variant="secondary" className="text-[9px] h-3.5 px-1">{tasksInQuadrant.length}</Badge>
          </div>
          
          <div className="space-y-1">
            {tasksInQuadrant.slice(0, 5).map(task => (
              <div key={task.id} className="bg-white/80 dark:bg-slate-800/80 rounded p-1.5 border text-[10px] space-y-1">
                <div className="flex items-center gap-1">
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={() => toggleTask(task)}
                    className="h-3 w-3"
                  />
                  <span className="truncate flex-1">{task.title}</span>
                </div>
                <TriagePills task={task} onUpdate={(u) => updateTask(task.id, u)} compact />
              </div>
            ))}
            {tasksInQuadrant.length > 5 && (
              <p className="text-[9px] text-muted-foreground text-center">+{tasksInQuadrant.length - 5} more</p>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {renderMatrixCell('do_first')}
          {renderMatrixCell('schedule')}
          {renderMatrixCell('delegate')}
          {renderMatrixCell('eliminate')}
        </div>
        
        {groupedTasks.untriaged.length > 0 && (
          <div className={cn("rounded-lg border p-2", quadrantInfo.untriaged.color)}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-xs">{quadrantInfo.untriaged.label}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1">{groupedTasks.untriaged.length}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {groupedTasks.untriaged.map(task => (
                <div key={task.id} className="bg-white/80 dark:bg-slate-800/80 rounded p-1.5 border text-[10px] space-y-1">
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={task.is_completed}
                      onCheckedChange={() => toggleTask(task)}
                      className="h-3 w-3"
                    />
                    <span className="truncate flex-1">{task.title}</span>
                  </div>
                  <TriagePills task={task} onUpdate={(u) => updateTask(task.id, u)} compact />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };


  return (
    <>
      {/* Move to Growth Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move to Growth Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Task</label>
              <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                {taskToMove?.title}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Growth Project *</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {activeProjects.filter(p => p.project_type === 'business_development').length > 0 && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1.5 border-b mb-1">
                      <Briefcase className="h-3 w-3" />
                      Business Development
                    </div>
                  )}
                  {activeProjects.filter(p => p.project_type === 'business_development').map((project) => (
                    <SelectItem key={project.id} value={project.id} className="pl-6">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        {project.name}
                      </span>
                    </SelectItem>
                  ))}
                  
                  {activeProjects.filter(p => p.project_type === 'professional_development').length > 0 && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 border-b mb-1 mt-2">
                      <GraduationCap className="h-3 w-3" />
                      Career Development
                    </div>
                  )}
                  {activeProjects.filter(p => p.project_type === 'professional_development').map((project) => (
                    <SelectItem key={project.id} value={project.id} className="pl-6">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        {project.name}
                      </span>
                    </SelectItem>
                  ))}
                  
                  {activeProjects.filter(p => p.project_type === 'learning_development').length > 0 && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 border-b mb-1 mt-2">
                      <Lightbulb className="h-3 w-3" />
                      Learning & Development
                    </div>
                  )}
                  {activeProjects.filter(p => p.project_type === 'learning_development').map((project) => (
                    <SelectItem key={project.id} value={project.id} className="pl-6">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        {project.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Assignee
              </label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  <SelectItem value="Me">Me</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a.id} value={a.name}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Deadline
              </label>
              <Select value={selectedDeadline} onValueChange={(v) => setSelectedDeadline(v as TaskDeadlineType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {deadlineOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {getDeadlineLabel(opt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleMoveToGrowth} 
              disabled={!selectedProject || isMoving}
              className="bg-teal-500 hover:bg-teal-600"
            >
              {isMoving ? "Moving..." : "Move Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Draggable Button - Hidden when panel is open */}
      {!isOpen && (
        <div
          ref={buttonRef}
          className="z-50"
          style={getButtonStyle()}
        >
          <button
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={cn(
              "relative h-14 w-14 rounded-full shadow-xl transition-all duration-300 touch-none select-none",
              "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600",
              "hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-500",
              "hover:shadow-2xl hover:shadow-teal-500/30",
              !isDragging && "hover:scale-110",
              "flex items-center justify-center text-white",
              "ring-2 ring-white/20 ring-offset-2 ring-offset-background",
              isDragging && "cursor-grabbing scale-110 shadow-2xl shadow-teal-500/40",
              !isDragging && "cursor-grab"
            )}
          >
            <CheckSquare className="h-6 w-6" />
            {incompleteTasks.length > 0 && (
              <span className="absolute -top-1 -right-1 flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {incompleteTasks.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Task Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className={cn(
            "z-50 rounded-xl border-0 shadow-2xl shadow-teal-500/20 overflow-hidden animate-scale-in bg-background transition-all duration-300 flex flex-col"
          )}
          style={getPanelStyle()}
        >
          {/* Header - Draggable */}
          <div 
            className={cn(
              "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 px-4 py-3 touch-none select-none",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
            onPointerDown={handlePanelHeaderPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePanelHeaderPointerUp}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <CheckSquare className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Quick To-Do</h3>
                  <p className="text-[10px] text-white/80">
                    {incompleteTasks.length} pending
                    {groupedTasks.untriaged.length > 0 && ` • ${groupedTasks.untriaged.length} untriaged`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-7 w-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsExpanded(false);
                  }}
                  className="h-7 w-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* View Tabs & Toolbar */}
          <div className="p-2 border-b space-y-2">
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)} className="flex-1">
                <TabsList className="h-7 w-full">
                  <TabsTrigger value="focus" className="h-6 text-[10px] flex-1 gap-1">
                    <ListTodo className="h-3 w-3" />
                    Focus
                  </TabsTrigger>
                  <TabsTrigger value="matrix" className="h-6 text-[10px] flex-1 gap-1">
                    <LayoutGrid className="h-3 w-3" />
                    Matrix
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            {viewMode === 'focus' && (
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => setShowUntriagedOnly(!showUntriagedOnly)}
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]",
                    showUntriagedOnly ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  )}
                >
                  <Filter className="h-2.5 w-2.5" />
                  Untriaged
                </button>
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedTasks.size > 0 && (
            <div className="flex flex-wrap items-center gap-1 p-2 bg-primary/10 border-b text-[10px]">
              <span className="font-medium">{selectedTasks.size} selected</span>
              <Button size="sm" variant="outline" className="h-5 text-[10px] px-1.5" onClick={() => handleBulkUpdate({ urgency: 'urgent' })}>Urgent</Button>
              <Button size="sm" variant="outline" className="h-5 text-[10px] px-1.5" onClick={() => handleBulkUpdate({ urgency: 'not_urgent' })}>Not urgent</Button>
              <Button size="sm" variant="outline" className="h-5 text-[10px] px-1.5" onClick={() => handleBulkUpdate({ importance: 'important' })}>Important</Button>
              <Button size="sm" variant="outline" className="h-5 text-[10px] px-1.5" onClick={() => handleBulkUpdate({ importance: 'not_important' })}>Not important</Button>
              <Button size="sm" variant="ghost" className="h-5 text-[10px] ml-auto" onClick={() => setSelectedTasks(new Set())}>Clear</Button>
            </div>
          )}

          {/* Add Task Input */}
          <div className="p-2 border-b">
            <div className="flex gap-2">
              <Input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a quick task..."
                className="flex-1 h-8 text-sm"
                disabled={isLoading}
              />
              <Button
                size="icon"
                onClick={addTask}
                disabled={!newTask.trim() || isLoading}
                className="h-8 w-8 bg-teal-500 hover:bg-teal-600"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-2 space-y-1.5">
              {incompleteTasks.length === 0 && completedTasks.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No tasks yet. Add one above!
                </p>
              )}

              {viewMode === 'focus' && (
                <>
                  {renderQuadrant('do_first')}
                  {renderQuadrant('schedule')}
                  {renderQuadrant('delegate')}
                  {renderQuadrant('eliminate')}
                  {renderQuadrant('untriaged')}
                  
                  {completedTasks.length > 0 && (
                    <div className="pt-2">
                      <div className="text-xs text-muted-foreground pb-1 font-medium">
                        Completed ({completedTasks.length})
                      </div>
                      {completedUnifiedTasks.slice(0, 5).map(task => (
                        <div key={task.id} className="flex items-center gap-2 p-1.5 rounded bg-muted/30 group text-xs">
                          <Checkbox
                            checked={task.is_completed}
                            onCheckedChange={() => toggleTask(task)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="flex-1 text-muted-foreground truncate">{task.title}</span>
                          {task.completed_at && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {format(new Date(task.completed_at), 'MMM d')}
                            </span>
                          )}
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => deleteTask(task.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {viewMode === 'matrix' && renderMatrixView()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
