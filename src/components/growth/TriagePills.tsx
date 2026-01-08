import { cn } from '@/lib/utils';
import { type TaskImportance, type TaskUrgency, type TaskEffort } from '@/lib/hooks/useGrowthProjects';
import { Zap, Target, Clock, Flame, Feather } from 'lucide-react';

interface TriagePillsProps {
  urgency: TaskUrgency;
  importance: TaskImportance;
  effort: TaskEffort;
  onUrgencyChange: (value: TaskUrgency) => void;
  onImportanceChange: (value: TaskImportance) => void;
  onEffortChange: (value: TaskEffort) => void;
  triageMode?: boolean;
  disabled?: boolean;
  compact?: boolean;
  expandOnHover?: boolean;
  forceExpanded?: boolean; // Controlled expansion from parent
}

type PillVariant = 'urgent' | 'not_urgent' | 'important' | 'not_important' | 'quick_win' | 'deep_work';

const pillStyles: Record<PillVariant, { active: string; inactive: string }> = {
  urgent: {
    active: 'bg-red-500 text-white border-red-500',
    inactive: 'border-red-200 text-red-400 hover:bg-red-50 hover:border-red-300',
  },
  not_urgent: {
    active: 'bg-emerald-500 text-white border-emerald-500',
    inactive: 'border-emerald-200 text-emerald-400 hover:bg-emerald-50 hover:border-emerald-300',
  },
  important: {
    active: 'bg-amber-500 text-white border-amber-500',
    inactive: 'border-amber-200 text-amber-400 hover:bg-amber-50 hover:border-amber-300',
  },
  not_important: {
    active: 'bg-slate-400 text-white border-slate-400',
    inactive: 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300',
  },
  quick_win: {
    active: 'bg-sky-500 text-white border-sky-500',
    inactive: 'border-sky-200 text-sky-400 hover:bg-sky-50 hover:border-sky-300',
  },
  deep_work: {
    active: 'bg-purple-500 text-white border-purple-500',
    inactive: 'border-purple-200 text-purple-400 hover:bg-purple-50 hover:border-purple-300',
  },
};

interface SinglePillProps {
  label: string;
  icon?: React.ReactNode;
  variant: PillVariant;
  isActive: boolean;
  isUnset: boolean;
  onClick: () => void;
  triageMode?: boolean;
  disabled?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
}

const SinglePill = ({ label, icon, variant, isActive, isUnset, onClick, triageMode, disabled, compact, iconOnly }: SinglePillProps) => {
  const styles = pillStyles[variant];
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={iconOnly ? label : undefined}
      className={cn(
        "inline-flex items-center rounded-full border transition-all duration-150",
        iconOnly ? "p-1" : "gap-1",
        !iconOnly && (compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"),
        !iconOnly && triageMode && !compact && "px-3 py-1.5 text-sm",
        isActive ? styles.active : styles.inactive,
        isUnset && "opacity-50",
        disabled && "opacity-30 cursor-not-allowed",
        !disabled && "cursor-pointer active:scale-95"
      )}
    >
      {icon}
      {!iconOnly && label}
    </button>
  );
};

export const TriagePills = ({
  urgency,
  importance,
  effort,
  onUrgencyChange,
  onImportanceChange,
  onEffortChange,
  triageMode = false,
  disabled = false,
  compact = false,
  expandOnHover = false,
  forceExpanded = false,
}: TriagePillsProps) => {
  const handleUrgencyClick = (value: 'urgent' | 'not_urgent') => {
    if (disabled) return;
    // Toggle: if already set to this value, reset to unset
    onUrgencyChange(urgency === value ? 'unset' : value);
  };

  const handleImportanceClick = (value: 'important' | 'not_important') => {
    if (disabled) return;
    onImportanceChange(importance === value ? 'unset' : value);
  };

  const handleEffortClick = (value: 'quick_win' | 'deep_work') => {
    if (disabled) return;
    onEffortChange(effort === value ? 'unset' : value);
  };

  const iconSize = expandOnHover ? "h-3 w-3" : (compact ? "h-2.5 w-2.5" : "h-3 w-3");

  // Use forceExpanded when provided (controlled by parent)
  const isExpanded = forceExpanded;

  // When expandOnHover is true, wrap in a container that shows icons only, 
  // and on hover expands to show full labels (controlled by forceExpanded)
  if (expandOnHover) {
    return (
      <div className="relative">
        {/* Collapsed state - icons only */}
        <div className={cn(
          "flex gap-1 transition-all duration-200",
          isExpanded ? "opacity-0 absolute pointer-events-none scale-95" : "opacity-100"
        )}>
          <div className="flex gap-0.5">
            <SinglePill
              label="Urgent"
              icon={<Zap className={iconSize} />}
              variant="urgent"
              isActive={urgency === 'urgent'}
              isUnset={urgency === 'unset'}
              onClick={() => handleUrgencyClick('urgent')}
              disabled={disabled}
              iconOnly
            />
            <SinglePill
              label="Not urgent"
              icon={<Clock className={iconSize} />}
              variant="not_urgent"
              isActive={urgency === 'not_urgent'}
              isUnset={urgency === 'unset'}
              onClick={() => handleUrgencyClick('not_urgent')}
              disabled={disabled}
              iconOnly
            />
          </div>
          <div className="flex gap-0.5">
            <SinglePill
              label="Important"
              icon={<Target className={iconSize} />}
              variant="important"
              isActive={importance === 'important'}
              isUnset={importance === 'unset'}
              onClick={() => handleImportanceClick('important')}
              disabled={disabled}
              iconOnly
            />
            <SinglePill
              label="Not important"
              icon={<Target className={cn(iconSize, "opacity-50")} />}
              variant="not_important"
              isActive={importance === 'not_important'}
              isUnset={importance === 'unset'}
              onClick={() => handleImportanceClick('not_important')}
              disabled={disabled}
              iconOnly
            />
          </div>
          <div className="flex gap-0.5">
            <SinglePill
              label="Quick win"
              icon={<Feather className={iconSize} />}
              variant="quick_win"
              isActive={effort === 'quick_win'}
              isUnset={effort === 'unset'}
              onClick={() => handleEffortClick('quick_win')}
              disabled={disabled}
              iconOnly
            />
            <SinglePill
              label="Deep work"
              icon={<Flame className={iconSize} />}
              variant="deep_work"
              isActive={effort === 'deep_work'}
              isUnset={effort === 'unset'}
              onClick={() => handleEffortClick('deep_work')}
              disabled={disabled}
              iconOnly
            />
          </div>
        </div>
        
        {/* Expanded state - full labels */}
        <div className={cn(
          "flex flex-wrap gap-1 transition-all duration-200",
          isExpanded ? "opacity-100" : "opacity-0 absolute pointer-events-none scale-95"
        )}>
          <div className="flex gap-0.5">
            <SinglePill
              label="Urgent"
              icon={<Zap className={iconSize} />}
              variant="urgent"
              isActive={urgency === 'urgent'}
              isUnset={urgency === 'unset'}
              onClick={() => handleUrgencyClick('urgent')}
              disabled={disabled}
              compact
            />
            <SinglePill
              label="Not urgent"
              icon={<Clock className={iconSize} />}
              variant="not_urgent"
              isActive={urgency === 'not_urgent'}
              isUnset={urgency === 'unset'}
              onClick={() => handleUrgencyClick('not_urgent')}
              disabled={disabled}
              compact
            />
          </div>
          <div className="flex gap-0.5">
            <SinglePill
              label="Important"
              icon={<Target className={iconSize} />}
              variant="important"
              isActive={importance === 'important'}
              isUnset={importance === 'unset'}
              onClick={() => handleImportanceClick('important')}
              disabled={disabled}
              compact
            />
            <SinglePill
              label="Not important"
              variant="not_important"
              isActive={importance === 'not_important'}
              isUnset={importance === 'unset'}
              onClick={() => handleImportanceClick('not_important')}
              disabled={disabled}
              compact
            />
          </div>
          <div className="flex gap-0.5">
            <SinglePill
              label="Quick win"
              icon={<Feather className={iconSize} />}
              variant="quick_win"
              isActive={effort === 'quick_win'}
              isUnset={effort === 'unset'}
              onClick={() => handleEffortClick('quick_win')}
              disabled={disabled}
              compact
            />
            <SinglePill
              label="Deep work"
              icon={<Flame className={iconSize} />}
              variant="deep_work"
              isActive={effort === 'deep_work'}
              isUnset={effort === 'unset'}
              onClick={() => handleEffortClick('deep_work')}
              disabled={disabled}
              compact
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1", triageMode && "gap-2")}>
      {/* Urgency pills */}
      <div className="flex gap-0.5">
        <SinglePill
          label="Urgent"
          icon={<Zap className={iconSize} />}
          variant="urgent"
          isActive={urgency === 'urgent'}
          isUnset={urgency === 'unset'}
          onClick={() => handleUrgencyClick('urgent')}
          triageMode={triageMode}
          disabled={disabled}
          compact={compact}
        />
        <SinglePill
          label="Not urgent"
          icon={<Clock className={iconSize} />}
          variant="not_urgent"
          isActive={urgency === 'not_urgent'}
          isUnset={urgency === 'unset'}
          onClick={() => handleUrgencyClick('not_urgent')}
          triageMode={triageMode}
          disabled={disabled}
          compact={compact}
        />
      </div>

      {/* Importance pills */}
      <div className="flex gap-0.5">
        <SinglePill
          label="Important"
          icon={<Target className={iconSize} />}
          variant="important"
          isActive={importance === 'important'}
          isUnset={importance === 'unset'}
          onClick={() => handleImportanceClick('important')}
          triageMode={triageMode}
          disabled={disabled}
          compact={compact}
        />
        <SinglePill
          label="Not important"
          variant="not_important"
          isActive={importance === 'not_important'}
          isUnset={importance === 'unset'}
          onClick={() => handleImportanceClick('not_important')}
          triageMode={triageMode}
          disabled={disabled}
          compact={compact}
        />
      </div>

      {/* Effort pills */}
      <div className="flex gap-0.5">
        <SinglePill
          label="Quick win"
          icon={<Feather className={iconSize} />}
          variant="quick_win"
          isActive={effort === 'quick_win'}
          isUnset={effort === 'unset'}
          onClick={() => handleEffortClick('quick_win')}
          triageMode={triageMode}
          disabled={disabled}
          compact={compact}
        />
        <SinglePill
          label="Deep work"
          icon={<Flame className={iconSize} />}
          variant="deep_work"
          isActive={effort === 'deep_work'}
          isUnset={effort === 'unset'}
          onClick={() => handleEffortClick('deep_work')}
          triageMode={triageMode}
          disabled={disabled}
          compact={compact}
        />
      </div>
    </div>
  );
};

// Helper to check if a task is fully triaged
export const isFullyTriaged = (urgency: TaskUrgency, importance: TaskImportance, effort: TaskEffort): boolean => {
  return urgency !== 'unset' && importance !== 'unset' && effort !== 'unset';
};

// Helper to get Eisenhower quadrant
export type EisenhowerQuadrant = 'do_first' | 'schedule' | 'delegate' | 'eliminate' | 'untriaged';

export const getQuadrant = (urgency: TaskUrgency, importance: TaskImportance): EisenhowerQuadrant => {
  if (urgency === 'unset' || importance === 'unset') return 'untriaged';
  if (urgency === 'urgent' && importance === 'important') return 'do_first';
  if (urgency === 'not_urgent' && importance === 'important') return 'schedule';
  if (urgency === 'urgent' && importance === 'not_important') return 'delegate';
  return 'eliminate';
};

export const quadrantInfo: Record<EisenhowerQuadrant, { label: string; guidance: string; color: string }> = {
  do_first: { 
    label: 'Do First', 
    guidance: 'Crises & deadlines — do now', 
    color: 'bg-red-50 border-red-200' 
  },
  schedule: { 
    label: 'Schedule', 
    guidance: 'Strategic work — block time', 
    color: 'bg-amber-50 border-amber-200' 
  },
  delegate: { 
    label: 'Delegate', 
    guidance: 'Admin tasks — hand off if possible', 
    color: 'bg-sky-50 border-sky-200' 
  },
  eliminate: { 
    label: 'Defer / Drop', 
    guidance: 'Low value — defer or delete', 
    color: 'bg-slate-50 border-slate-200' 
  },
  untriaged: { 
    label: 'Untriaged', 
    guidance: 'Needs classification', 
    color: 'bg-white border-dashed' 
  },
};
