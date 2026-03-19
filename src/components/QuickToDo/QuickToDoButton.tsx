import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  CheckSquare, X, Plus, Trash2, ArrowRight, Clock, User,
  Briefcase, GraduationCap, Lightbulb, Maximize2, Minimize2,
  ListTodo, LayoutGrid, Filter, Check, ChevronDown, ChevronRight,
  Zap, Target, CalendarClock, Feather, Flame, MessageSquare, Pin, PinOff,
  Clipboard, ClipboardCheck, GripHorizontal, GripVertical, Search, Home, ArrowUp, Mail
} from "lucide-react";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  useSortable, 
  verticalListSortingStrategy 
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGrowthProjects, 
  type TaskDeadlineType, 
  getDeadlineLabel, 
  useKnownAssignees,
  useMyUpcomingGrowthTasks,
  calculateDueDate,
  type TaskWithProject,
} from "@/lib/hooks/useGrowthProjects";
import { useSlateItems, useSlateOrder, type SlateItem } from "@/lib/hooks/useSlateItems";

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
  completed_at: string | null;
  on_slate: boolean;
  completion_notes?: string | null;
  slate_sort_order?: number;
  must_do_today?: boolean;
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
  completed_at?: string | null;
  // Growth task specific
  source: 'quick' | 'growth' | 'slate-only';
  projectName?: string;
  projectId?: string;
  dueDate?: Date;
  pinned_to_tasklist?: boolean;
  assignee?: string | null;
  on_slate?: boolean;
  completion_notes?: string | null;
  slate_sort_order?: number;
  must_do_today?: boolean;
}

// SlateOnlyItem type is now deprecated - we use SlateItem from useSlateItems hook
// Keeping for backwards compatibility during migration
interface SlateOnlyItem {
  id: string;
  title: string;
  created_at: string;
  is_personal?: boolean;
  sort_order?: number;
}

const STORAGE_KEY = 'todo-button-position';
const SLATE_POSITION_KEY = 'slate-panel-position';
const PANEL_OPEN_KEY = 'todo-panel-open';
const SLATE_OPEN_KEY = 'slate-panel-open';

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
  expandOnHover?: boolean;
  forceExpanded?: boolean; // Controlled expansion from parent
}

const TriagePills = ({ task, onUpdate, compact = false, disabled = false, expandOnHover = false, forceExpanded = false }: TriagePillsProps) => {
  const iconSize = "h-3 w-3";
  
  // Use forceExpanded when provided (controlled by parent), otherwise always collapsed for expandOnHover mode
  const isExpanded = forceExpanded;
  
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
    "inline-flex items-center rounded-full border cursor-pointer active:scale-95 font-medium whitespace-nowrap",
    disabled && "opacity-50 cursor-not-allowed"
  );

  const iconOnlyPill = cn(pillBase, "p-1 transition-all duration-200");
  const expandedPill = cn(pillBase, "gap-1 text-[11px] px-2 py-1 transition-all duration-200");

  // When expandOnHover is true, show icons only by default, expand when forceExpanded is true
  if (expandOnHover) {
    return (
      <div className="relative">
        {/* Collapsed state - icons only */}
        <div className={cn(
          "flex gap-1 transition-all duration-200",
          isExpanded ? "opacity-0 absolute pointer-events-none scale-95" : "opacity-100"
        )}>
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => handleUrgencyClick('urgent')}
              disabled={disabled}
              className={cn(
                iconOnlyPill,
                task.urgency === 'urgent' 
                  ? 'bg-red-500 text-white border-red-500 shadow-sm' 
                  : 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/50',
                task.urgency === 'unset' && 'opacity-60'
              )}
              title="Urgent"
            >
              <Zap className={iconSize} />
            </button>
            <button
              type="button"
              onClick={() => handleUrgencyClick('not_urgent')}
              disabled={disabled}
              className={cn(
                iconOnlyPill,
                task.urgency === 'not_urgent'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                  : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/50',
                task.urgency === 'unset' && 'opacity-60'
              )}
              title="Not Urgent"
            >
              <Clock className={iconSize} />
            </button>
          </div>
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => handleImportanceClick('important')}
              disabled={disabled}
              className={cn(
                iconOnlyPill,
                task.importance === 'important'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/50',
                task.importance === 'unset' && 'opacity-60'
              )}
              title="Important"
            >
              <Target className={iconSize} />
            </button>
            <button
              type="button"
              onClick={() => handleImportanceClick('not_important')}
              disabled={disabled}
              className={cn(
                iconOnlyPill,
                task.importance === 'not_important'
                  ? 'bg-slate-500 text-white border-slate-500 shadow-sm'
                  : 'border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800/50',
                task.importance === 'unset' && 'opacity-60'
              )}
              title="Not Important"
            >
              <Target className={cn(iconSize, "opacity-50")} />
            </button>
          </div>
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => handleEffortClick('quick_win')}
              disabled={disabled}
              className={cn(
                iconOnlyPill,
                task.effort === 'quick_win'
                  ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                  : 'border-sky-300 text-sky-600 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/50',
                task.effort === 'unset' && 'opacity-60'
              )}
              title="Quick Win - Small task"
            >
              <Feather className={iconSize} />
            </button>
            <button
              type="button"
              onClick={() => handleEffortClick('deep_work')}
              disabled={disabled}
              className={cn(
                iconOnlyPill,
                task.effort === 'deep_work'
                  ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                  : 'border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/50',
                task.effort === 'unset' && 'opacity-60'
              )}
              title="Deep Work - Requires focus"
            >
              <Flame className={iconSize} />
            </button>
          </div>
        </div>
        
        {/* Expanded state - full labels after delay */}
        <div className={cn(
          "flex flex-wrap gap-1 transition-all duration-200",
          isExpanded ? "opacity-100" : "opacity-0 absolute pointer-events-none scale-95"
        )}>
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => handleUrgencyClick('urgent')}
              disabled={disabled}
              className={cn(
                expandedPill,
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
                expandedPill,
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
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => handleImportanceClick('important')}
              disabled={disabled}
              className={cn(
                expandedPill,
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
                expandedPill,
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
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => handleEffortClick('quick_win')}
              disabled={disabled}
              className={cn(
                expandedPill,
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
                expandedPill,
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
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {/* Urgency */}
      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => handleUrgencyClick('urgent')}
          disabled={disabled}
          className={cn(
            expandedPill,
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
            expandedPill,
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
            expandedPill,
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
            expandedPill,
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
            expandedPill,
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
            expandedPill,
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

// Sortable Slate Item Component
interface SortableSlateItemProps {
  task: UnifiedTask;
  index: number;
  onCompleteWithNotes: () => void;
  onQuickComplete: () => void;
  onRemoveFromSlate: () => void;
  onPromoteToTaskList?: () => void;
  onSnapToTop: () => void;
  onToggleMustDoToday?: () => void;
}

const SortableSlateItem = ({ 
  task, 
  index, 
  onCompleteWithNotes, 
  onQuickComplete, 
  onRemoveFromSlate,
  onPromoteToTaskList,
  onSnapToTop,
  onToggleMustDoToday,
}: SortableSlateItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  const isSlateOnly = task.source === 'slate-only';

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "flex items-start gap-2 p-2 rounded-lg group min-w-0",
        isDragging && "shadow-lg ring-2 ring-primary/20",
        task.must_do_today && "ring-2 ring-orange-400/50 bg-orange-50/30 dark:bg-orange-950/20",
        isSlateOnly && !task.must_do_today
          ? "bg-amber-50/50 dark:bg-amber-950/20 border border-dashed border-amber-300/50 dark:border-amber-700/30" 
          : !task.must_do_today && "bg-muted/50"
      )}
    >
      {/* Drag handle with number and snap to top */}
      <div className="flex items-center gap-0.5 shrink-0">
        <div 
          {...attributes} 
          {...listeners}
          className="flex items-center gap-1 cursor-grab active:cursor-grabbing touch-none"
        >
          <div className={cn(
            "flex items-center justify-center w-5 h-5 rounded text-xs font-bold",
            task.must_do_today 
              ? "bg-orange-200 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
              : isSlateOnly 
                ? "bg-amber-200/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-primary/10 text-primary"
          )}>
            {index + 1}
          </div>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
        {index > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 opacity-60 hover:opacity-100 hover:bg-primary/10"
            onClick={onSnapToTop}
            title="Move to top"
          >
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
          </Button>
        )}
      </div>
      
      {/* Must do today checkbox */}
      {onToggleMustDoToday && (
        <button
          type="button"
          onClick={onToggleMustDoToday}
          className={cn(
            "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors text-[10px] font-bold",
            task.must_do_today 
              ? "bg-orange-500 border-orange-500 text-white" 
              : "border-orange-300 hover:border-orange-400 hover:bg-orange-50 dark:border-orange-700 dark:hover:bg-orange-950/30 text-orange-400"
          )}
          title={task.must_do_today ? "Remove from today's must-do" : "Mark as must-do today"}
        >
          !
        </button>
      )}
      
      {/* Dual checkbox */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onCompleteWithNotes}
          className="h-4 w-4 rounded border border-input flex items-center justify-center hover:bg-accent hover:border-primary transition-colors"
          title="Complete with notes"
        >
          <MessageSquare className="h-2.5 w-2.5 text-muted-foreground" />
        </button>
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={onQuickComplete}
          className="h-4 w-4"
          title="Quick complete"
        />
      </div>
      <span className={cn(
        "flex-1 text-sm min-w-0 break-words",
        isSlateOnly && "italic text-muted-foreground",
        task.must_do_today && "font-medium text-orange-700 dark:text-orange-300"
      )}>
        {task.title}
      </span>
      
      {/* Slate-only indicator and promote button */}
      {isSlateOnly && onPromoteToTaskList && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-60 group-hover:opacity-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
          onClick={onPromoteToTaskList}
          title="Add to main task list"
        >
          <Plus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        </Button>
      )}
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
        onClick={onRemoveFromSlate}
        title="Remove from Slate"
      >
        <ClipboardCheck className="h-3.5 w-3.5 text-blue-500" />
      </Button>
    </div>
  );
};

// Sortable wrapper for personal tasks
interface SortablePersonalTaskProps {
  task: { id: string; title: string; must_do_today?: boolean };
  index: number;
  onComplete: () => void;
  onDelete: () => void;
  onToggleMustDoToday?: () => void;
}

const SortablePersonalTask = ({ 
  task, 
  index, 
  onComplete, 
  onDelete,
  onToggleMustDoToday,
}: SortablePersonalTaskProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "flex items-start gap-2 p-2 rounded-lg group min-w-0 border border-dashed",
        isDragging && "shadow-lg ring-2 ring-rose-300/50",
        task.must_do_today 
          ? "ring-2 ring-orange-400/50 bg-orange-50/30 dark:bg-orange-950/20 border-orange-300/50 dark:border-orange-700/30"
          : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-300/50 dark:border-rose-700/30"
      )}
    >
      {/* Drag handle with number */}
      <div 
        {...attributes} 
        {...listeners}
        className="flex items-center gap-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <div className={cn(
          "flex items-center justify-center w-5 h-5 rounded text-xs font-bold",
          task.must_do_today 
            ? "bg-orange-200 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
            : "bg-rose-200/50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
        )}>
          {index + 1}
        </div>
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
      
      {/* Must do today checkbox */}
      {onToggleMustDoToday && (
        <button
          type="button"
          onClick={onToggleMustDoToday}
          className={cn(
            "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors text-[10px] font-bold",
            task.must_do_today 
              ? "bg-orange-500 border-orange-500 text-white" 
              : "border-orange-300 hover:border-orange-400 hover:bg-orange-50 dark:border-orange-700 dark:hover:bg-orange-950/30 text-orange-400"
          )}
          title={task.must_do_today ? "Remove from today's must-do" : "Mark as must-do today"}
        >
          !
        </button>
      )}
      
      {/* Checkbox */}
      <Checkbox
        checked={false}
        onCheckedChange={onComplete}
        className="h-4 w-4 shrink-0"
        title="Complete"
      />
      
      <span className={cn(
        "flex-1 text-sm min-w-0 break-words italic",
        task.must_do_today 
          ? "font-medium text-orange-700 dark:text-orange-300"
          : "text-muted-foreground"
      )}>
        {task.title}
      </span>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
        onClick={onDelete}
        title="Remove"
      >
        <X className="h-3.5 w-3.5 text-rose-500" />
      </Button>
    </div>
  );
};

export function QuickToDoButton() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { projects } = useGrowthProjects();
  const { assignees } = useKnownAssignees();
  const { upcomingTasks: upcomingGrowthTasks, refetch: refetchGrowthTasks } = useMyUpcomingGrowthTasks();
  
  // Use database-backed slate items hook
  const { 
    workSlateItems, 
    personalSlateItems, 
    addSlateItem, 
    deleteSlateItem, 
    completeSlateItem,
    reorderSlateItems,
    promoteToQuickTask,
    toggleMustDoToday,
  } = useSlateItems();
  const { batchUpdateSlateOrder } = useSlateOrder();
  
  // FORCE RESET: Clear any potentially stuck state on mount
  const [isOpen, setIsOpen] = useState(() => {
    try {
      // Force close on mount to ensure button is visible
      localStorage.removeItem(PANEL_OPEN_KEY);
      return false;
    } catch {
      return false;
    }
  });
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
  
  // Complete with notes dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<UnifiedTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  
  // Completed tasks section state
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [completedSearchQuery, setCompletedSearchQuery] = useState("");
  const [viewingNotesTask, setViewingNotesTask] = useState<UnifiedTask | null>(null);
  
  // Slate panel state - FORCE RESET to ensure button is visible
  const [isSlateOpen, setIsSlateOpen] = useState(() => {
    try {
      // Force close on mount to ensure button is visible
      localStorage.removeItem(SLATE_OPEN_KEY);
      return false;
    } catch {
      return false;
    }
  });
  const [slatePosition, setSlatePosition] = useState<{ x: number; y: number } | null>(null);
  const [slateSize, setSlateSize] = useState<{ width: number; height: number }>(() => {
    try {
      const saved = localStorage.getItem('slate_size');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { width: 544, height: window.innerHeight * 0.8 }; // 34rem = 544px, 80vh
  });
  const [isDraggingSlate, setIsDraggingSlate] = useState(false);
  const [isResizingSlate, setIsResizingSlate] = useState(false);
  const slateDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const slateResizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number; startPosY: number } | null>(null);
  const slateRef = useRef<HTMLDivElement>(null);
  
  const [newSlateItem, setNewSlateItem] = useState("");
  const [newPersonalItem, setNewPersonalItem] = useState("");
  
  // Email dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  // Triage debouncing - track tasks being actively triaged
  // Key: taskId, Value: { lastTriageTime, previousQuadrant }
  const [tasksBeingTriaged, setTasksBeingTriaged] = useState<Map<string, { lastTriageTime: number; previousQuadrant: EisenhowerQuadrant }>>(new Map());
  const triageTimeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load saved position on mount - restore from localStorage or use default
  useEffect(() => {
    const savedPosition = localStorage.getItem(STORAGE_KEY);
    
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        // Validate that the saved position is still within viewport
        const maxX = window.innerWidth - 80;
        const maxY = window.innerHeight - 80;
        
        if (parsed.x >= 0 && parsed.x <= maxX && parsed.y >= 0 && parsed.y <= maxY) {
          setPosition(parsed);
          return;
        }
      } catch (e) {
        // Invalid JSON, fall through to default
      }
    }
    
    // Default position if no valid saved position
    const safeX = 280; // Right of sidebar
    const safeY = window.innerHeight - 120; // Near bottom
    setPosition({ x: safeX, y: safeY });
  }, []);

  // Save position when it changes
  useEffect(() => {
    if (position) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }
  }, [position]);

  // Ensure button stays visible on window resize
  useEffect(() => {
    const handleResize = () => {
      if (position) {
        const maxX = window.innerWidth - 80;
        const maxY = window.innerHeight - 80;
        
        // If button is now off-screen, move it back
        if (position.x > maxX || position.y > maxY) {
          setPosition({
            x: Math.min(position.x, maxX),
            y: Math.min(position.y, maxY),
          });
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  // Persist panel open state
  useEffect(() => {
    localStorage.setItem(PANEL_OPEN_KEY, isOpen ? 'true' : 'false');
  }, [isOpen]);

  // Persist slate open state
  useEffect(() => {
    localStorage.setItem(SLATE_OPEN_KEY, isSlateOpen ? 'true' : 'false');
  }, [isSlateOpen]);

  // Load saved slate position on mount
  useEffect(() => {
    const saved = localStorage.getItem(SLATE_POSITION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSlatePosition(parsed);
      } catch {
        // Invalid saved position
      }
    }
  }, []);

  // Save slate position when it changes
  useEffect(() => {
    if (slatePosition) {
      localStorage.setItem(SLATE_POSITION_KEY, JSON.stringify(slatePosition));
    }
  }, [slatePosition]);

  // Note: Slate items and order are now persisted to database via useSlateItems hook
  // No need for localStorage persistence

  // Slate drag handlers
  const handleSlateMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const slate = slateRef.current;
    if (!slate) return;

    const rect = slate.getBoundingClientRect();
    slateDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: rect.left,
      startPosY: rect.top,
    };
    setIsDraggingSlate(true);
  }, []);

  useEffect(() => {
    if (!isDraggingSlate) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!slateDragRef.current) return;

      const deltaX = e.clientX - slateDragRef.current.startX;
      const deltaY = e.clientY - slateDragRef.current.startY;

      const newX = slateDragRef.current.startPosX + deltaX;
      const newY = slateDragRef.current.startPosY + deltaY;

      // Constrain to viewport
      const maxX = window.innerWidth - slateSize.width;
      const maxY = window.innerHeight - 100;
      
      setSlatePosition({
        x: Math.min(Math.max(0, newX), maxX),
        y: Math.min(Math.max(0, newY), maxY),
      });
    };

    const handleMouseUp = () => {
      setIsDraggingSlate(false);
      slateDragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSlate, slateSize.width]);

  // Slate resize handlers
  const handleSlateResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentY = slatePosition?.y ?? (window.innerHeight / 2 - slateSize.height / 2);
    
    slateResizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: slateSize.width,
      startHeight: slateSize.height,
      startPosY: currentY,
    };
    setIsResizingSlate(true);
  }, [slateSize, slatePosition]);

  useEffect(() => {
    if (!isResizingSlate) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!slateResizeRef.current) return;

      const { startX, startY, startWidth, startHeight, startPosY } = slateResizeRef.current;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Calculate new dimensions (resize from top-right corner)
      const newWidth = Math.max(320, Math.min(window.innerWidth - 50, startWidth + deltaX));
      const newHeight = Math.max(200, Math.min(window.innerHeight, startHeight - deltaY));

      setSlateSize(size => {
        // Save to localStorage on each update
        const newSize = { width: newWidth, height: newHeight };
        try {
          localStorage.setItem('slate_size', JSON.stringify(newSize));
        } catch {}
        return newSize;
      });
      
      // Adjust position to keep bottom edge in place when height changes
      const heightDiff = newHeight - startHeight;
      setSlatePosition(prev => prev ? {
        ...prev,
        y: startPosY - heightDiff
      } : prev);
    };

    const handleMouseUp = () => {
      setIsResizingSlate(false);
      slateResizeRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSlate]);

  // Cleanup triage timeouts on unmount
  useEffect(() => {
    return () => {
      triageTimeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Load tasks
  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = useCallback(async () => {
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
      completed_at: t.completed_at || null,
      on_slate: t.on_slate || false,
      completion_notes: t.completion_notes || null,
      slate_sort_order: t.slate_sort_order || 0,
      must_do_today: t.must_do_today || false,
    }));

    setTasks(mappedTasks);
  }, []);

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
    // Check if this is a triage update (urgency, importance, or effort)
    const isTriageUpdate = 'urgency' in updates || 'importance' in updates || 'effort' in updates;
    
    if (isTriageUpdate) {
      // Get current task state to determine its current quadrant
      const currentTask = allUnifiedTasks.find(t => t.id === taskId);
      if (currentTask) {
        const currentQuadrant = getQuadrant(currentTask.urgency, currentTask.importance);
        
        // Start or extend the triage debounce timer
        setTasksBeingTriaged(prev => {
          const next = new Map(prev);
          const existing = next.get(taskId);
          next.set(taskId, {
            lastTriageTime: Date.now(),
            // Keep original quadrant from when triage started
            previousQuadrant: existing?.previousQuadrant ?? currentQuadrant,
          });
          return next;
        });
        
        // Clear existing timeout for this task
        const existingTimeout = triageTimeoutRefs.current.get(taskId);
        if (existingTimeout) clearTimeout(existingTimeout);
        
        // Set new timeout to release the task after 5 seconds
        const timeout = setTimeout(() => {
          setTasksBeingTriaged(prev => {
            const next = new Map(prev);
            next.delete(taskId);
            return next;
          });
          triageTimeoutRefs.current.delete(taskId);
        }, 5000);
        triageTimeoutRefs.current.set(taskId, timeout);
        
        // Check if task will be fully triaged after this update
        const updatedTask = { ...currentTask, ...updates };
        if (isFullyTriaged(updatedTask)) {
          // Immediately release the task since all three are set
          setTimeout(() => {
            setTasksBeingTriaged(prev => {
              const next = new Map(prev);
              next.delete(taskId);
              return next;
            });
            const t = triageTimeoutRefs.current.get(taskId);
            if (t) clearTimeout(t);
            triageTimeoutRefs.current.delete(taskId);
          }, 100); // Small delay so user sees the final state briefly
        }
      }
    }
    
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
      completed_at: task.completed_at || null,
      on_slate: task.on_slate || false,
    };
    setTaskToMove(quickTask);
    setSelectedProject("");
    setSelectedAssignee("__unassigned__");
    setSelectedDeadline("no_deadline");
    setMoveDialogOpen(true);
  };

  const openCompleteDialog = (task: UnifiedTask) => {
    setTaskToComplete(task);
    setCompletionNotes("");
    setCompleteDialogOpen(true);
  };

  const handleCompleteWithNotes = async () => {
    if (!taskToComplete) return;
    
    if (taskToComplete.source === 'growth') {
      const realId = taskToComplete.id.replace('growth-', '');
      const { error } = await supabase
        .from('growth_tasks')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          completion_notes: completionNotes || null,
        })
        .eq('id', realId);
      
      if (error) {
        toast.error('Failed to complete task');
      } else {
        refetchGrowthTasks();
      }
    } else {
      const { error } = await supabase
        .from('quick_tasks')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          completion_notes: completionNotes || null,
        })
        .eq('id', taskToComplete.id);
      
      if (error) {
        toast.error('Failed to complete task');
      } else {
        fetchTasks();
      }
    }
    
    setCompleteDialogOpen(false);
    setTaskToComplete(null);
    setCompletionNotes("");
  };

  const toggleGrowthTaskPin = async (taskId: string, currentlyPinned: boolean) => {
    const realId = taskId.replace('growth-', '');
    const newPinnedValue = !currentlyPinned;
    
    // Optimistic update - immediately update local state
    queryClient.setQueryData(['my-upcoming-growth-tasks'], (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.map((task: { id: string; pinned_to_tasklist?: boolean }) => 
        task.id === realId ? { ...task, pinned_to_tasklist: newPinnedValue } : task
      );
    });
    
    const { error } = await supabase
      .from('growth_tasks')
      .update({ pinned_to_tasklist: newPinnedValue })
      .eq('id', realId);
    
    if (error) {
      toast.error('Failed to update task');
      // Rollback on error
      queryClient.setQueryData(['my-upcoming-growth-tasks'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((task: { id: string; pinned_to_tasklist?: boolean }) => 
          task.id === realId ? { ...task, pinned_to_tasklist: currentlyPinned } : task
        );
      });
    } else {
      // Refetch all growth task queries to sync with Growth section
      await refetchGrowthTasks();
      await queryClient.refetchQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && (
            key[0] === 'growth-tasks' ||
            key[0] === 'all-growth-tasks' ||
            key[0] === 'overdue-tasks'
          );
        }
      });
    }
  };

  const toggleSlate = async (taskId: string, currentlyOnSlate: boolean, source: 'quick' | 'growth' | 'slate-only') => {
    if (source === 'slate-only') {
      // Remove slate-only item from database
      deleteSlateItem.mutate(taskId);
      return;
    }
    
    if (source === 'growth') {
      const realId = taskId.replace('growth-', '');
      const { error } = await supabase
        .from('growth_tasks')
        .update({ on_slate: !currentlyOnSlate })
        .eq('id', realId);
      
      if (error) {
        toast.error('Failed to update slate status');
      } else {
        refetchGrowthTasks();
      }
    } else {
      // Optimistic update for quick tasks
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, on_slate: !currentlyOnSlate } : t));
      
      const { error } = await supabase
        .from('quick_tasks')
        .update({ on_slate: !currentlyOnSlate })
        .eq('id', taskId);
      
      if (error) {
        toast.error('Failed to update slate status');
        fetchTasks(); // Revert on error
      }
    }
  };

  // Add slate-only item (work or personal) - now uses database
  const addSlateOnlyItem = (title: string, isPersonal: boolean = false) => {
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > 200) return;
    
    addSlateItem.mutate({ title: trimmed, isPersonal });
    if (isPersonal) {
      setNewPersonalItem("");
    } else {
      setNewSlateItem("");
    }
  };

  // Promote slate-only item to main task list - now uses database
  const promoteSlateOnlyToTaskList = async (item: SlateItem | SlateOnlyItem) => {
    if (!user) return;
    
    // Use the database-backed hook if it's a SlateItem
    if ('user_id' in item) {
      promoteToQuickTask.mutate(item as SlateItem, {
        onSuccess: () => {
          // Refetch tasks since QuickToDoButton uses local state instead of react-query
          fetchTasks();
        }
      });
    } else {
      // Legacy SlateOnlyItem support (shouldn't happen anymore)
      const { data, error } = await supabase
        .from('quick_tasks')
        .insert({
          title: item.title,
          user_id: user.id,
          on_slate: true,
          is_completed: false,
          is_urgent: false,
          importance: 'unset',
          urgency: 'unset',
          effort: 'unset',
        })
        .select()
        .single();
      
      if (error) {
        toast.error('Failed to add to task list');
      } else {
        fetchTasks();
        toast.success('Added to task list');
      }
    }
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
      completed_at: gt.completed_at,
      source: 'growth' as const,
      projectName: gt.growth_projects.name,
      projectId: gt.project_id,
      dueDate: gt.deadline_set_at 
        ? calculateDueDate(new Date(gt.deadline_set_at), gt.deadline_type)
        : undefined,
      pinned_to_tasklist: gt.pinned_to_tasklist,
      assignee: gt.assignee,
      on_slate: gt.on_slate || false,
      slate_sort_order: gt.slate_sort_order || 0,
      must_do_today: (gt as any).must_do_today || false,
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
  
  // Completed tasks - sorted by completion date (newest first), searchable
  const completedUnifiedTasks: UnifiedTask[] = useMemo(() => {
    const quickCompleted: UnifiedTask[] = tasks.filter(t => t.is_completed).map(t => ({ 
      ...t, 
      source: 'quick' as const,
      projectName: undefined,
    }));
    const growthCompleted = unifiedGrowthTasks.filter(t => t.is_completed);
    const allCompleted = [...quickCompleted, ...growthCompleted];
    
    // Sort by completion date (newest first)
    allCompleted.sort((a, b) => {
      const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return dateB - dateA;
    });
    
    // Filter by search query
    if (completedSearchQuery.trim()) {
      const query = completedSearchQuery.toLowerCase();
      return allCompleted.filter(t => 
        t.title.toLowerCase().includes(query) ||
        (t.completion_notes && t.completion_notes.toLowerCase().includes(query)) ||
        (t.projectName && t.projectName.toLowerCase().includes(query))
      );
    }
    
    return allCompleted;
  }, [tasks, unifiedGrowthTasks, completedSearchQuery]);
  
  const incompleteTasks = pendingTasks; // alias for badge count
  
  // Untriaged count for blue badge
  const untriagedCount = useMemo(() => pendingTasks.filter(t => !isFullyTriaged(t)).length, [pendingTasks]);
  
  // Slate tasks (both quick and growth tasks can be on slate) - ordered by slate_sort_order
  // Work slate items from database (is_personal = false)
  // Personal slate items from database (is_personal = true)

  const slateOnlyAsUnified: UnifiedTask[] = useMemo(() => {
    return workSlateItems.map(item => ({
      id: item.id,
      title: item.title,
      is_completed: item.is_completed,
      importance: 'unset' as TaskImportance,
      urgency: 'unset' as TaskUrgency,
      effort: 'unset' as TaskEffort,
      created_at: item.created_at,
      source: 'slate-only' as const,
      on_slate: true,
      slate_sort_order: item.sort_order,
      must_do_today: item.must_do_today,
    }));
  }, [workSlateItems]);

  const personalSlateAsUnified: UnifiedTask[] = useMemo(() => {
    return personalSlateItems.map(item => ({
      id: item.id,
      title: item.title,
      is_completed: item.is_completed,
      importance: 'unset' as TaskImportance,
      urgency: 'unset' as TaskUrgency,
      effort: 'unset' as TaskEffort,
      created_at: item.created_at,
      source: 'slate-only' as const,
      on_slate: true,
      slate_sort_order: item.sort_order,
      must_do_today: item.must_do_today,
    }));
  }, [personalSlateItems]);

  const rawSlateTasks = useMemo(() => {
    const fromTasks = allUnifiedTasks.filter(t => t.on_slate && !t.is_completed);
    return [...fromTasks, ...slateOnlyAsUnified];
  }, [allUnifiedTasks, slateOnlyAsUnified]);
  
  // Personal tasks are separate and ordered separately
  const rawPersonalTasks = useMemo(() => personalSlateAsUnified, [personalSlateAsUnified]);
  
  // Local state for optimistic reordering - stores the task IDs in order
  const [optimisticSlateOrder, setOptimisticSlateOrder] = useState<string[] | null>(null);
  const [optimisticPersonalOrder, setOptimisticPersonalOrder] = useState<string[] | null>(null);

  // Order slate tasks based on optimistic order (if any) or slate_sort_order from database
  const orderedSlateTasks = useMemo(() => {
    const sorted = [...rawSlateTasks].sort((a, b) => {
      const aOrder = a.slate_sort_order ?? 0;
      const bOrder = b.slate_sort_order ?? 0;
      // Primary sort by slate_sort_order
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Secondary sort by created_at for stable ordering when sort_order is the same
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    // If we have an optimistic order, use it
    if (optimisticSlateOrder) {
      return optimisticSlateOrder
        .map(id => sorted.find(t => t.id === id))
        .filter((t): t is UnifiedTask => t !== undefined);
    }
    
    return sorted;
  }, [rawSlateTasks, optimisticSlateOrder]);

  // Order personal tasks based on optimistic order (if any) or sort_order from database
  const orderedPersonalTasks = useMemo(() => {
    const sorted = [...rawPersonalTasks].sort((a, b) => {
      const aOrder = a.slate_sort_order ?? 0;
      const bOrder = b.slate_sort_order ?? 0;
      // Primary sort by slate_sort_order
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Secondary sort by created_at for stable ordering when sort_order is the same
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    // If we have an optimistic order, use it
    if (optimisticPersonalOrder) {
      return optimisticPersonalOrder
        .map(id => sorted.find(t => t.id === id))
        .filter((t): t is UnifiedTask => t !== undefined);
    }
    
    return sorted;
  }, [rawPersonalTasks, optimisticPersonalOrder]);

  // Filter out must-do-today tasks for the "Today" section
  const todayWorkTasks = useMemo(() => 
    orderedSlateTasks.filter(t => t.must_do_today),
    [orderedSlateTasks]
  );

  const todayPersonalTasks = useMemo(() => 
    orderedPersonalTasks.filter(t => t.must_do_today),
    [orderedPersonalTasks]
  );

  const hasTodayTasks = todayWorkTasks.length > 0 || todayPersonalTasks.length > 0;

  // Remaining tasks (not marked as must-do-today)
  const remainingWorkTasks = useMemo(() => 
    orderedSlateTasks.filter(t => !t.must_do_today), 
    [orderedSlateTasks]
  );

  const remainingPersonalTasks = useMemo(() => 
    orderedPersonalTasks.filter(t => !t.must_do_today), 
    [orderedPersonalTasks]
  );

  // Open email dialog
  const handleEmailSlate = useCallback(() => {
    setRecipientEmail("");
    setEmailDialogOpen(true);
  }, []);

  // Generate and send email content for the slate
  const sendSlateEmail = useCallback(() => {
    const today = format(new Date(), 'EEEE, MMMM d, yyyy');
    const totalTasks = orderedSlateTasks.length + orderedPersonalTasks.length;
    
    let emailBody = `📋 MY TASK SLATE\n`;
    emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emailBody += `📅 ${today}\n`;
    emailBody += `📊 ${totalTasks} task${totalTasks !== 1 ? 's' : ''} total\n\n`;
    
    // Today section
    if (hasTodayTasks) {
      emailBody += `🔥 MUST DO TODAY\n`;
      emailBody += `─────────────────────────────────────\n\n`;
      
      if (todayWorkTasks.length > 0) {
        emailBody += `💼 Work (${todayWorkTasks.length})\n`;
        todayWorkTasks.forEach((task, idx) => {
          const projectInfo = task.projectName ? ` → ${task.projectName}` : '';
          emailBody += `   ☐ ${task.title}${projectInfo}\n`;
        });
        emailBody += '\n';
      }
      
      if (todayPersonalTasks.length > 0) {
        emailBody += `🏠 Personal (${todayPersonalTasks.length})\n`;
        todayPersonalTasks.forEach((task) => {
          emailBody += `   ☐ ${task.title}\n`;
        });
        emailBody += '\n';
      }
    }
    
    // Remaining section
    const hasRemainingTasks = remainingWorkTasks.length > 0 || remainingPersonalTasks.length > 0;
    if (hasRemainingTasks) {
      emailBody += `📌 OTHER TASKS\n`;
      emailBody += `─────────────────────────────────────\n\n`;
      
      if (remainingWorkTasks.length > 0) {
        emailBody += `💼 Work (${remainingWorkTasks.length})\n`;
        remainingWorkTasks.forEach((task) => {
          const projectInfo = task.projectName ? ` → ${task.projectName}` : '';
          emailBody += `   ☐ ${task.title}${projectInfo}\n`;
        });
        emailBody += '\n';
      }
      
      if (remainingPersonalTasks.length > 0) {
        emailBody += `🏠 Personal (${remainingPersonalTasks.length})\n`;
        remainingPersonalTasks.forEach((task) => {
          emailBody += `   ☐ ${task.title}\n`;
        });
        emailBody += '\n';
      }
    }
    
    emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emailBody += `✨ Sent from my Task Slate`;
    
    const subject = `📋 Task Slate - ${today}`;
    const toEmail = recipientEmail.trim() || '';
    const mailtoUrl = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    window.open(mailtoUrl, '_blank');
    setEmailDialogOpen(false);
  }, [hasTodayTasks, todayWorkTasks, todayPersonalTasks, remainingWorkTasks, remainingPersonalTasks, orderedSlateTasks, orderedPersonalTasks, recipientEmail]);

  // Clear optimistic order when raw data changes (after refetch)
  useEffect(() => {
    setOptimisticSlateOrder(null);
  }, [rawSlateTasks]);
  
  useEffect(() => {
    setOptimisticPersonalOrder(null);
  }, [rawPersonalTasks]);

  // Sensors for dnd-kit (for slate reordering)
  const slateSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handle slate task reorder - optimistic update + save to database
  const handleSlateDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentOrder = optimisticSlateOrder || orderedSlateTasks.map(t => t.id);
    const oldIndex = currentOrder.indexOf(String(active.id));
    const newIndex = currentOrder.indexOf(String(over.id));

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      
      // Optimistically update the UI immediately
      setOptimisticSlateOrder(newOrder);
      
      // Get the full task objects for the update
      const tasksInNewOrder = newOrder.map(id => orderedSlateTasks.find(t => t.id === id)).filter(Boolean) as UnifiedTask[];
      
      // Save new order to database
      const updates = tasksInNewOrder.map((task, idx) => ({
        id: task.id,
        source: task.source === 'slate-only' ? 'slate-item' as const : task.source as 'quick' | 'growth',
        sortOrder: idx,
      }));
      
      batchUpdateSlateOrder.mutate(updates, {
        onSuccess: () => {
          // Refetch to get fresh data from database
          fetchTasks();
          refetchGrowthTasks();
        },
        onError: () => {
          // Rollback optimistic update on error
          setOptimisticSlateOrder(null);
        }
      });
    }
  }, [orderedSlateTasks, optimisticSlateOrder, batchUpdateSlateOrder, fetchTasks, refetchGrowthTasks]);

  // Handle personal task reorder - optimistic update + save to database
  const handlePersonalDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentOrder = optimisticPersonalOrder || orderedPersonalTasks.map(t => t.id);
    const oldIndex = currentOrder.indexOf(String(active.id));
    const newIndex = currentOrder.indexOf(String(over.id));

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      
      // Optimistically update the UI immediately
      setOptimisticPersonalOrder(newOrder);
      
      // Save order to database (personal items are all slate-items)
      const updates = newOrder.map((id, idx) => ({ id, sort_order: idx }));
      
      reorderSlateItems.mutate(updates, {
        onError: () => {
          // Rollback optimistic update on error
          setOptimisticPersonalOrder(null);
        }
      });
    }
  }, [orderedPersonalTasks, optimisticPersonalOrder, reorderSlateItems]);

  // Handle snap to top - move task to position 0
  const handleSnapToTop = useCallback((taskId: string) => {
    const currentOrder = optimisticSlateOrder || orderedSlateTasks.map(t => t.id);
    const oldIndex = currentOrder.indexOf(taskId);
    
    if (oldIndex > 0) {
      const newOrder = arrayMove(currentOrder, oldIndex, 0);
      
      // Optimistically update the UI immediately
      setOptimisticSlateOrder(newOrder);
      
      // Get the full task objects for the update
      const tasksInNewOrder = newOrder.map(id => orderedSlateTasks.find(t => t.id === id)).filter(Boolean) as UnifiedTask[];
      
      // Save new order to database
      const updates = tasksInNewOrder.map((task, idx) => ({
        id: task.id,
        source: task.source === 'slate-only' ? 'slate-item' as const : task.source as 'quick' | 'growth',
        sortOrder: idx,
      }));
      
      batchUpdateSlateOrder.mutate(updates, {
        onSuccess: () => {
          fetchTasks();
          refetchGrowthTasks();
        },
        onError: () => {
          setOptimisticSlateOrder(null);
        }
      });
    }
  }, [orderedSlateTasks, optimisticSlateOrder, batchUpdateSlateOrder, fetchTasks, refetchGrowthTasks]);

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
      // Check if this task is being actively triaged
      const triageState = tasksBeingTriaged.get(task.id);
      
      // If task is being triaged, keep it in its original quadrant
      const quadrant = triageState 
        ? triageState.previousQuadrant 
        : getQuadrant(task.urgency, task.importance);
      
      groups[quadrant].push(task);
    });

    // Sort: quick wins first, then by due date (for growth tasks), then by created_at
    Object.keys(groups).forEach(key => {
      groups[key as EisenhowerQuadrant].sort((a, b) => {
        // Tasks being triaged stay at their original position (sort by when triage started)
        const aTriaging = tasksBeingTriaged.has(a.id);
        const bTriaging = tasksBeingTriaged.has(b.id);
        
        // Keep triaging tasks in place relative to each other
        if (aTriaging && !bTriaging) return 0; // Keep in place
        if (!aTriaging && bTriaging) return 0; // Keep in place
        
        // Slate items first - snap to top of each category
        const aOnSlate = a.on_slate === true;
        const bOnSlate = b.on_slate === true;
        if (aOnSlate && !bOnSlate) return -1;
        if (!aOnSlate && bOnSlate) return 1;
        
        // Quick wins first (only for non-triaging tasks)
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
  }, [pendingTasks, showUntriagedOnly, tasksBeingTriaged]);


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
    // ALWAYS ensure the button is within visible viewport bounds
    const maxX = window.innerWidth - 80;
    const maxY = window.innerHeight - 80;
    
    if (position) {
      // Clamp position to ensure visibility
      const clampedX = Math.min(Math.max(20, position.x), maxX);
      const clampedY = Math.min(Math.max(20, position.y), maxY);
      
      return {
        position: 'fixed',
        left: clampedX,
        top: clampedY,
        right: 'auto',
        bottom: 'auto',
        zIndex: 9999,
      };
    }
    
    // Default: guaranteed visible position - bottom-left area, right of sidebar
    return {
      position: 'fixed',
      left: 280,
      bottom: 100,
      zIndex: 9999,
    };
  };

  const getPanelStyle = (): React.CSSProperties => {
    const isMobile = window.innerWidth < 768;
    
    // Mobile: full screen with small margins
    if (isMobile) {
      return {
        position: 'fixed',
        left: 8,
        right: 8,
        top: 8,
        bottom: 8,
        width: 'auto',
        height: 'auto',
      };
    }
    
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
    const [triageExpanded, setTriageExpanded] = useState(false);
    const editInputRef = useRef<HTMLInputElement>(null);
    const triageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const isTriaged = isFullyTriaged(task);

    const handleRowMouseMove = (e: React.MouseEvent) => {
      if (!rowRef.current || triageExpanded) return; // Don't start new timer if already expanded
      const rect = rowRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const isLeftHalf = mouseX < rect.width / 2;
      
      if (isLeftHalf && !triageTimeoutRef.current) {
        triageTimeoutRef.current = setTimeout(() => {
          setTriageExpanded(true);
        }, 500); // 0.5 second delay
      } else if (!isLeftHalf && triageTimeoutRef.current) {
        // Only cancel pending timer if moving to right half before expansion
        clearTimeout(triageTimeoutRef.current);
        triageTimeoutRef.current = null;
      }
    };

    const handleRowMouseLeave = () => {
      if (triageTimeoutRef.current) {
        clearTimeout(triageTimeoutRef.current);
        triageTimeoutRef.current = null;
      }
      setTriageExpanded(false);
    };

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
        ref={rowRef}
        onMouseMove={handleRowMouseMove}
        onMouseLeave={handleRowMouseLeave}
        className={cn(
          "flex flex-col gap-2 p-3 rounded-lg group transition-all",
          "bg-muted/50 hover:bg-muted/80",
          selectedTasks.has(task.id) && "bg-primary/10"
        )}
      >
        {/* Title row */}
        <div className="flex items-start gap-2">
          {/* Dual checkbox: complete with notes + quick complete */}
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <button
              type="button"
              onClick={() => openCompleteDialog(task)}
              className="h-4 w-4 rounded border border-input flex items-center justify-center hover:bg-accent hover:border-primary transition-colors"
              title="Complete with notes"
            >
              <MessageSquare className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
            <Checkbox
              checked={task.is_completed}
              onCheckedChange={() => toggleTask(task)}
              className="h-4 w-4"
              title="Quick complete"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                ref={editInputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDownRow}
                className="w-full h-7 text-sm"
              />
            ) : (
              <span 
                className="block text-sm cursor-pointer hover:bg-background/50 rounded px-1 -mx-1"
                onClick={() => setIsEditing(true)}
                title="Click to edit"
              >
                {task.title}
              </span>
            )}
          </div>
          
          {/* Slate button - for all tasks */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6",
                task.on_slate && "bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => toggleSlate(task.id, task.on_slate || false, task.source)}
              title={task.on_slate ? "Remove from Slate" : "Add to Slate"}
            >
              {task.on_slate ? (
                <ClipboardCheck className="h-3.5 w-3.5" />
              ) : (
                <Clipboard className="h-3.5 w-3.5 text-blue-500" />
              )}
            </Button>
            
            {/* Only show move/delete buttons for quick tasks */}
            {task.source === 'quick' && (
              <>
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
              </>
            )}
          </div>
        </div>
        
        {/* Growth task metadata row - separate line for badges */}
        {task.source === 'growth' && (
          <div className="flex items-center gap-1.5 flex-wrap ml-9">
            {task.assignee && task.assignee !== 'Me' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30">
                <User className="h-2.5 w-2.5 mr-0.5" />
                {task.assignee}
              </Badge>
            )}
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
            {/* Unpin button for pinned growth tasks */}
            {task.pinned_to_tasklist && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => toggleGrowthTaskPin(task.id, true)}
                title="Remove from Task List"
              >
                <PinOff className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
          </div>
        )}
        
        <TriagePills 
          task={task} 
          onUpdate={(updates) => updateTask(task.id, updates)}
          expandOnHover
          forceExpanded={triageExpanded}
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

      {/* Complete with Notes Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Task</label>
              <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                {taskToComplete?.title}
              </p>
            </div>
            
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
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteWithNotes}>
              Complete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Completion Notes Dialog */}
      <Dialog open={!!viewingNotesTask} onOpenChange={(open) => !open && setViewingNotesTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Completion Notes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Task</label>
              <p className="text-sm font-medium">
                {viewingNotesTask?.title}
              </p>
            </div>
            
            {viewingNotesTask?.projectName && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <p className="text-sm text-muted-foreground">{viewingNotesTask.projectName}</p>
              </div>
            )}
            
            {viewingNotesTask?.completed_at && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Completed</label>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(viewingNotesTask.completed_at), 'MMMM d, yyyy \'at\' h:mm a')}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">
                {viewingNotesTask?.completion_notes || 'No notes added'}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setViewingNotesTask(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Draggable Button with Slate Circle - Hidden when panel is open */}
      {!isOpen && !isSlateOpen && (
        <div
          ref={buttonRef}
          className="flex items-center gap-1.5 group"
          style={getButtonStyle()}
          data-testid="quick-todo-button"
        >
          {/* Slate Circle - 1/4 surface area of main button */}
          <div className="relative">
            <button
              onClick={() => setIsSlateOpen(true)}
              className={cn(
                "relative h-7 w-7 rounded-full transition-all duration-300 touch-none select-none",
                "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600",
                "hover:from-blue-400 hover:via-blue-500 hover:to-indigo-500",
                "hover:shadow-lg hover:shadow-blue-500/30",
                "group-hover:scale-110",
                "flex items-center justify-center text-white",
                "shadow-md",
                orderedSlateTasks.length === 0 && "opacity-60 group-hover:opacity-80"
              )}
              title={`Slate (${orderedSlateTasks.length} tasks)`}
            >
              <Clipboard className="h-3.5 w-3.5" />
            </button>
            {/* Slate count badge */}
            {orderedSlateTasks.length > 0 && (
              <span className="absolute -top-1 -right-1 flex min-w-4 h-4 px-0.5 items-center justify-center rounded-full bg-blue-400 text-[10px] font-bold text-white">
                {orderedSlateTasks.length}
              </span>
            )}
          </div>
          
          {/* Main Quick Task Button */}
          <button
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={cn(
              "relative h-14 w-14 rounded-full shadow-xl transition-all duration-300 touch-none select-none",
              "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600",
              "hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-500",
              "hover:shadow-2xl hover:shadow-teal-500/30",
              "group-hover:scale-110",
              "flex items-center justify-center text-white",
              "ring-2 ring-white/20 ring-offset-2 ring-offset-background",
              isDragging && "cursor-grabbing scale-110 shadow-2xl shadow-teal-500/40",
              !isDragging && "cursor-grab"
            )}
          >
            <CheckSquare className="h-6 w-6" />
            {/* Badges container - top right corner */}
            <div className="absolute -top-1 -right-1 flex items-center gap-0.5">
              {/* Purple badge - untriaged tasks */}
              {untriagedCount > 0 && (
                <span className="flex min-w-4 h-4 px-0.5 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
                  {untriagedCount}
                </span>
              )}
              {/* Red badge - total incomplete tasks */}
              {incompleteTasks.length > 0 && (
                <span className="flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {incompleteTasks.length}
                </span>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Slate Panel */}
      {isSlateOpen && (
        <div
          ref={slateRef}
          data-compact-panel
          className={cn(
            "fixed z-50 rounded-xl border-0 overflow-hidden bg-background flex flex-col animate-[slate-glow_3s_ease-in-out_infinite]",
            (isDraggingSlate || isResizingSlate) && "select-none"
          )}
          style={{
            width: slateSize.width,
            height: slateSize.height,
            ...(slatePosition ? {
              left: slatePosition.x,
              top: slatePosition.y,
            } : {
              left: '17rem',
              top: '50%',
              transform: 'translateY(-50%)',
            }),
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(99, 102, 241, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* Resize Handle - Top Right Corner */}
          <div
            className="absolute top-0 right-0 w-6 h-6 z-10 cursor-ne-resize"
            onMouseDown={handleSlateResizeMouseDown}
          />
          {/* Slate Header - Draggable */}
          <div 
            className={cn(
              "bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-4 py-3",
              isDraggingSlate ? "cursor-grabbing" : "cursor-grab"
            )}
            onMouseDown={handleSlateMouseDown}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <GripHorizontal className="h-4 w-4 text-white/70" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Slate</h3>
                  <p className="text-[10px] text-white/80">
                    {orderedSlateTasks.length + orderedPersonalTasks.length} {(orderedSlateTasks.length + orderedPersonalTasks.length) === 1 ? 'item' : 'items'} today
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEmailSlate();
                }}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
                title="Email Slate"
              >
                <Mail className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSlateOpen(false);
                }}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Slate Tasks - scrollable area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full [&>[data-radix-scroll-area-viewport]]:max-h-full">
              <div className="p-3 pb-4 space-y-4">
                {/* Empty state */}
                {orderedSlateTasks.length === 0 && orderedPersonalTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No tasks on your Slate yet.<br />
                    Add tasks from your triaged list.
                  </p>
                ) : (
                  <>
                    {/* TODAY Section - Must Do Today tasks */}
                    {hasTodayTasks && (
                      <div className="bg-orange-50 dark:bg-orange-950/30 -mx-3 px-3 py-2 border-b border-orange-200 dark:border-orange-800/50">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span className="text-orange-600 dark:text-orange-400 font-bold text-[10px]">!</span>
                          <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">Today</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-orange-200 text-orange-700 dark:bg-orange-900 dark:text-orange-300">{todayWorkTasks.length + todayPersonalTasks.length}</Badge>
                        </div>
                        
                        {/* Today - Work Items */}
                        {todayWorkTasks.length > 0 && (
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center gap-1.5 px-1">
                              <Briefcase className="h-3 w-3 text-orange-600/70 dark:text-orange-400/70" />
                              <span className="text-[10px] font-medium text-orange-600/70 dark:text-orange-400/70">Work</span>
                            </div>
                            <DndContext
                              sensors={slateSensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleSlateDragEnd}
                            >
                              <SortableContext 
                                items={todayWorkTasks.map(t => t.id)} 
                                strategy={verticalListSortingStrategy}
                              >
                                {todayWorkTasks.map((task, index) => (
                                  <SortableSlateItem
                                    key={task.id}
                                    task={task}
                                    index={index}
                                    onCompleteWithNotes={() => {
                                      if (task.source === 'slate-only') {
                                        completeSlateItem.mutate({ id: task.id, isCompleted: true });
                                        return;
                                      }
                                      const unified: UnifiedTask = { ...task, source: task.source };
                                      setTaskToComplete(unified);
                                      setCompletionNotes("");
                                      setCompleteDialogOpen(true);
                                    }}
                                    onQuickComplete={async () => {
                                      if (task.source === 'slate-only') {
                                        completeSlateItem.mutate({ id: task.id, isCompleted: true });
                                        return;
                                      }
                                      if (task.source === 'growth') {
                                        const realId = task.id.replace('growth-', '');
                                        const { error } = await supabase
                                          .from('growth_tasks')
                                          .update({
                                            is_completed: true,
                                            completed_at: new Date().toISOString(),
                                          })
                                          .eq('id', realId);
                                        if (error) {
                                          toast.error('Failed to complete task');
                                        } else {
                                          refetchGrowthTasks();
                                        }
                                      } else {
                                        const { error } = await supabase
                                          .from('quick_tasks')
                                          .update({
                                            is_completed: true,
                                            completed_at: new Date().toISOString(),
                                          })
                                          .eq('id', task.id);
                                        if (error) {
                                          toast.error('Failed to complete task');
                                        } else {
                                          fetchTasks();
                                        }
                                      }
                                    }}
                                    onRemoveFromSlate={() => toggleSlate(task.id, true, task.source)}
                                    onPromoteToTaskList={task.source === 'slate-only' ? () => {
                                      const slateItem = workSlateItems.find(i => i.id === task.id);
                                      if (slateItem) promoteSlateOnlyToTaskList(slateItem);
                                    } : undefined}
                                    onSnapToTop={() => handleSnapToTop(task.id)}
                                    onToggleMustDoToday={async () => {
                                      if (task.source === 'slate-only') {
                                        toggleMustDoToday.mutate({ id: task.id, mustDoToday: false });
                                      } else if (task.source === 'growth') {
                                        const realId = task.id.replace('growth-', '');
                                        const { error } = await supabase
                                          .from('growth_tasks')
                                          .update({ must_do_today: false })
                                          .eq('id', realId);
                                        if (!error) refetchGrowthTasks();
                                      } else {
                                        const { error } = await supabase
                                          .from('quick_tasks')
                                          .update({ must_do_today: false })
                                          .eq('id', task.id);
                                        if (!error) fetchTasks();
                                      }
                                    }}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                          </div>
                        )}

                        {/* Today - Personal Items */}
                        {todayPersonalTasks.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 px-1">
                              <Home className="h-3 w-3 text-orange-600/70 dark:text-orange-400/70" />
                              <span className="text-[10px] font-medium text-orange-600/70 dark:text-orange-400/70">Personal</span>
                            </div>
                            <DndContext
                              sensors={slateSensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handlePersonalDragEnd}
                            >
                              <SortableContext 
                                items={todayPersonalTasks.map(t => t.id)} 
                                strategy={verticalListSortingStrategy}
                              >
                                {todayPersonalTasks.map((task, index) => (
                                  <SortablePersonalTask
                                    key={task.id}
                                    task={task}
                                    index={index}
                                    onComplete={() => completeSlateItem.mutate({ id: task.id, isCompleted: true })}
                                    onDelete={() => deleteSlateItem.mutate(task.id)}
                                    onToggleMustDoToday={() => {
                                      toggleMustDoToday.mutate({ id: task.id, mustDoToday: false });
                                    }}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Work Tasks */}
                    {remainingWorkTasks.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <Briefcase className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-xs font-medium text-muted-foreground">Work Tasks</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{remainingWorkTasks.length}</Badge>
                        </div>
                        <DndContext
                          sensors={slateSensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleSlateDragEnd}
                        >
                          <SortableContext 
                            items={remainingWorkTasks.map(t => t.id)} 
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {remainingWorkTasks.map((task, index) => (
                                <SortableSlateItem
                                  key={task.id}
                                  task={task}
                                  index={index}
                                  onCompleteWithNotes={() => {
                                    if (task.source === 'slate-only') {
                                      completeSlateItem.mutate({ id: task.id, isCompleted: true });
                                      return;
                                    }
                                    const unified: UnifiedTask = { ...task, source: task.source };
                                    setTaskToComplete(unified);
                                    setCompletionNotes("");
                                    setCompleteDialogOpen(true);
                                  }}
                                  onQuickComplete={async () => {
                                    if (task.source === 'slate-only') {
                                      completeSlateItem.mutate({ id: task.id, isCompleted: true });
                                      return;
                                    }
                                    if (task.source === 'growth') {
                                      const realId = task.id.replace('growth-', '');
                                      const { error } = await supabase
                                        .from('growth_tasks')
                                        .update({
                                          is_completed: true,
                                          completed_at: new Date().toISOString(),
                                        })
                                        .eq('id', realId);
                                      if (error) {
                                        toast.error('Failed to complete task');
                                      } else {
                                        refetchGrowthTasks();
                                      }
                                    } else {
                                      const { error } = await supabase
                                        .from('quick_tasks')
                                        .update({
                                          is_completed: true,
                                          completed_at: new Date().toISOString(),
                                        })
                                        .eq('id', task.id);
                                      if (error) {
                                        toast.error('Failed to complete task');
                                      } else {
                                        fetchTasks();
                                      }
                                    }
                                  }}
                                  onRemoveFromSlate={() => toggleSlate(task.id, true, task.source)}
                                  onPromoteToTaskList={task.source === 'slate-only' ? () => {
                                    const slateItem = workSlateItems.find(i => i.id === task.id);
                                    if (slateItem) promoteSlateOnlyToTaskList(slateItem);
                                  } : undefined}
                                  onSnapToTop={() => handleSnapToTop(task.id)}
                                  onToggleMustDoToday={async () => {
                                    const newValue = !task.must_do_today;
                                    if (task.source === 'slate-only') {
                                      toggleMustDoToday.mutate({ id: task.id, mustDoToday: newValue });
                                    } else if (task.source === 'growth') {
                                      const realId = task.id.replace('growth-', '');
                                      const { error } = await supabase
                                        .from('growth_tasks')
                                        .update({ must_do_today: newValue })
                                        .eq('id', realId);
                                      if (error) {
                                        toast.error('Failed to update task');
                                      } else {
                                        refetchGrowthTasks();
                                      }
                                    } else {
                                      const { error } = await supabase
                                        .from('quick_tasks')
                                        .update({ must_do_today: newValue })
                                        .eq('id', task.id);
                                      if (error) {
                                        toast.error('Failed to update task');
                                      } else {
                                        fetchTasks();
                                      }
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}

                    {/* Personal Tasks Section */}
                    {remainingPersonalTasks.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <Home className="h-3.5 w-3.5 text-rose-500" />
                          <span className="text-xs font-medium text-muted-foreground">Personal</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">{remainingPersonalTasks.length}</Badge>
                        </div>
                        <DndContext
                          sensors={slateSensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handlePersonalDragEnd}
                        >
                          <SortableContext 
                            items={remainingPersonalTasks.map(t => t.id)} 
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {remainingPersonalTasks.map((task, index) => {
                                return (
                                  <SortablePersonalTask
                                    key={task.id}
                                    task={task}
                                    index={index}
                                    onComplete={() => completeSlateItem.mutate({ id: task.id, isCompleted: true })}
                                    onDelete={() => deleteSlateItem.mutate(task.id)}
                                    onToggleMustDoToday={() => {
                                      toggleMustDoToday.mutate({ id: task.id, mustDoToday: !task.must_do_today });
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Footer - fixed at bottom */}
          <div className="shrink-0 border-t bg-background">
            {/* Add new work item */}
            <div className="p-2 pb-1">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  addSlateOnlyItem(newSlateItem, false);
                }}
                className="flex gap-2"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <Briefcase className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <Input
                  value={newSlateItem}
                  onChange={(e) => setNewSlateItem(e.target.value)}
                  placeholder="Add work item..."
                  className="h-8 text-sm flex-1"
                  maxLength={200}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 shrink-0"
                  disabled={!newSlateItem.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </div>
            
            {/* Add new personal item */}
            <div className="px-2 pb-2">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  addSlateOnlyItem(newPersonalItem, true);
                }}
                className="flex gap-2"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <Home className="h-3.5 w-3.5 text-rose-500" />
                </div>
                <Input
                  value={newPersonalItem}
                  onChange={(e) => setNewPersonalItem(e.target.value)}
                  placeholder="Add personal reminder..."
                  className="h-8 text-sm flex-1 border-rose-200 focus-visible:ring-rose-500/20 dark:border-rose-800"
                  maxLength={200}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 shrink-0"
                  disabled={!newPersonalItem.trim()}
                >
                  <Plus className="h-4 w-4 text-rose-500" />
                </Button>
              </form>
            </div>
            
            {/* Open full task list button */}
            <div className="p-2 pt-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setIsSlateOpen(false);
                  setIsOpen(true);
                }}
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                Open Full Task List
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Task Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          data-compact-panel
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
                  <h3 className="font-bold text-white text-sm">To Do List</h3>
                  <p className="text-[10px] text-white/80">
                    {incompleteTasks.length} pending
                    {groupedTasks.untriaged.length > 0 && ` • ${groupedTasks.untriaged.length} untriaged`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                {/* Open Slate button */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsSlateOpen(true);
                  }}
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded-full transition-colors text-white",
                    orderedSlateTasks.length > 0 
                      ? "bg-blue-500/50 hover:bg-blue-500/70" 
                      : "bg-white/20 hover:bg-white/30"
                  )}
                  title={`Open Slate (${orderedSlateTasks.length} tasks)`}
                >
                  <Clipboard className="h-3.5 w-3.5" />
                </button>
                {/* Hide expand button on mobile - already full screen */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
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
                  {untriagedCount > 0 && (
                    <span className="flex min-w-4 h-4 px-0.5 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
                      {untriagedCount}
                    </span>
                  )}
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
              {incompleteTasks.length === 0 && completedUnifiedTasks.length === 0 && (
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
                  
                  {/* Completed Tasks Section - Collapsible */}
                  <div className="border-t pt-3 mt-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full text-left mb-2"
                      onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                    >
                      {showCompletedTasks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="text-xs text-muted-foreground font-medium">
                        Completed Tasks
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {completedUnifiedTasks.length}
                      </Badge>
                    </button>
                    
                    {showCompletedTasks && (
                      <div className="space-y-2">
                        {/* Search box */}
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input
                            value={completedSearchQuery}
                            onChange={(e) => setCompletedSearchQuery(e.target.value)}
                            placeholder="Search completed tasks..."
                            className="h-7 text-xs pl-7"
                          />
                        </div>
                        
                        {/* Completed tasks list */}
                        <ScrollArea className="max-h-48">
                          <div className="space-y-1">
                            {completedUnifiedTasks.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                {completedSearchQuery ? 'No matching completed tasks' : 'No completed tasks yet'}
                              </p>
                            ) : (
                              completedUnifiedTasks.map(task => (
                                <div 
                                  key={task.id} 
                                  className="flex items-start gap-2 p-1.5 rounded bg-muted/30 group text-xs"
                                >
                                  <Checkbox
                                    checked={task.is_completed}
                                    onCheckedChange={() => toggleTask(task)}
                                    className="h-3.5 w-3.5 mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-muted-foreground block truncate">{task.title}</span>
                                    {task.projectName && (
                                      <span className="text-[10px] text-muted-foreground/70 block">
                                        {task.projectName}
                                      </span>
                                    )}
                                    {task.completion_notes && (
                                      <button
                                        type="button"
                                        onClick={() => setViewingNotesTask(task)}
                                        className="text-[10px] text-primary/80 hover:text-primary flex items-center gap-0.5 mt-0.5"
                                      >
                                        <MessageSquare className="h-2.5 w-2.5" />
                                        View notes
                                      </button>
                                    )}
                                  </div>
                                  {task.completed_at && (
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                      {format(new Date(task.completed_at), 'MMM d')}
                                    </span>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0" 
                                    onClick={() => {
                                      if (task.source === 'growth') {
                                        // Delete growth task
                                        const realId = task.id.replace('growth-', '');
                                        supabase
                                          .from('growth_tasks')
                                          .delete()
                                          .eq('id', realId)
                                          .then(({ error }) => {
                                            if (error) toast.error('Failed to delete task');
                                            else refetchGrowthTasks();
                                          });
                                      } else {
                                        deleteTask(task.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </>
              )}

              {viewMode === 'matrix' && renderMatrixView()}
            </div>
          </div>
        </div>
      )}

      {/* Email Slate Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Your Slate
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="recipient-email" className="text-sm font-medium">
                Send to (optional)
              </label>
              <Input
                id="recipient-email"
                type="email"
                placeholder="recipient@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to choose the recipient in your email client
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">Email will include:</p>
              <div className="text-muted-foreground space-y-0.5">
                {hasTodayTasks && (
                  <p>🔥 {todayWorkTasks.length + todayPersonalTasks.length} must-do-today task(s)</p>
                )}
                {(remainingWorkTasks.length > 0 || remainingPersonalTasks.length > 0) && (
                  <p>📌 {remainingWorkTasks.length + remainingPersonalTasks.length} other task(s)</p>
                )}
                <p>📊 {orderedSlateTasks.length + orderedPersonalTasks.length} total items</p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendSlateEmail} className="gap-2">
              <Mail className="h-4 w-4" />
              Open in Email Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
