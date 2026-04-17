import { X, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface SortablePersonalTaskProps {
  task: { id: string; title: string; must_do_today?: boolean };
  index: number;
  onComplete: () => void;
  onDelete: () => void;
  onToggleMustDoToday?: () => void;
}

export const SortablePersonalTask = ({
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
        aria-label="Remove task"
      >
        <X className="h-3.5 w-3.5 text-rose-500" />
      </Button>
    </div>
  );
};
