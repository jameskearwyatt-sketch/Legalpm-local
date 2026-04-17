export type TaskImportance = 'important' | 'not_important' | 'unset';
export type TaskUrgency = 'urgent' | 'not_urgent' | 'unset';
export type TaskEffort = 'quick_win' | 'deep_work' | 'unset';
export type EisenhowerQuadrant = 'do_first' | 'schedule' | 'delegate' | 'eliminate' | 'untriaged';

export interface QuickTask {
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

export interface UnifiedTask {
  id: string;
  title: string;
  is_completed: boolean;
  importance: TaskImportance;
  urgency: TaskUrgency;
  effort: TaskEffort;
  created_at: string;
  completed_at?: string | null;
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
