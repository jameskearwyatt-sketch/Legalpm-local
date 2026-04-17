import type { TaskUrgency, TaskImportance, EisenhowerQuadrant, UnifiedTask, QuickTask } from "./types";
import type { TaskDeadlineType } from "@/lib/hooks/useGrowthProjects";

export const STORAGE_KEY = 'todo-button-position';
export const SLATE_POSITION_KEY = 'slate-panel-position';
export const PANEL_OPEN_KEY = 'todo-panel-open';
export const SLATE_OPEN_KEY = 'slate-panel-open';

export const deadlineOptions: TaskDeadlineType[] = [
  'this_week',
  'next_week',
  'this_month',
  'next_month',
  'in_3_months',
  'in_6_months',
  'no_deadline',
];

export const isFullyTriaged = (task: UnifiedTask | QuickTask): boolean => {
  return task.urgency !== 'unset' && task.importance !== 'unset' && task.effort !== 'unset';
};

export const getQuadrant = (urgency: TaskUrgency, importance: TaskImportance): EisenhowerQuadrant => {
  if (urgency === 'unset' || importance === 'unset') return 'untriaged';
  if (urgency === 'urgent' && importance === 'important') return 'do_first';
  if (urgency === 'not_urgent' && importance === 'important') return 'schedule';
  if (urgency === 'urgent' && importance === 'not_important') return 'delegate';
  return 'eliminate';
};

export const quadrantInfo: Record<EisenhowerQuadrant, { label: string; guidance: string; color: string }> = {
  do_first: { label: 'Do First', guidance: 'Crises & deadlines', color: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800' },
  schedule: { label: 'Schedule', guidance: 'Strategic work', color: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' },
  delegate: { label: 'Delegate', guidance: 'Admin tasks', color: 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800' },
  eliminate: { label: 'Defer/Drop', guidance: 'Low value', color: 'bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-700' },
  untriaged: { label: 'Untriaged', guidance: 'Needs classification', color: 'bg-white border-dashed dark:bg-slate-900 dark:border-slate-700' },
};
