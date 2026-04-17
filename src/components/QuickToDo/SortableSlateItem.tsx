import { Plus, GripVertical, ArrowUp, MessageSquare, ClipboardCheck } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { UnifiedTask } from "./types";

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

export const SortableSlateItem = ({
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
            aria-label="Move to top"
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
          aria-label="Add to main task list"
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
        aria-label="Remove from Slate"
      >
        <ClipboardCheck className="h-3.5 w-3.5 text-blue-500" />
      </Button>
    </div>
  );
};
