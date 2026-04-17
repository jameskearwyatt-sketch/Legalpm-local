import { Zap, Clock, Target, Feather, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedTask, QuickTask } from "./types";

interface TriagePillsProps {
  task: UnifiedTask | QuickTask;
  onUpdate: (updates: Partial<QuickTask>) => void;
  compact?: boolean;
  disabled?: boolean;
  expandOnHover?: boolean;
  forceExpanded?: boolean;
}

export const TriagePills = ({ task, onUpdate, compact = false, disabled = false, expandOnHover = false, forceExpanded = false }: TriagePillsProps) => {
  const iconSize = "h-3 w-3";

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
