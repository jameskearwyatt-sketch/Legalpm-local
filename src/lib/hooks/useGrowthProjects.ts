import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export type GrowthProjectType = 'business_development' | 'professional_development' | 'learning_development';
export type TaskDeadlineType = 'this_week' | 'next_week' | 'this_month' | 'next_month' | 'in_3_months' | 'in_6_months' | 'no_deadline';

export interface GrowthProject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  project_type: GrowthProjectType;
  status: string;
  ai_summary: string | null;
  mentee_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowthProjectEntry {
  id: string;
  project_id: string;
  user_id: string;
  entry_type: string;
  title: string | null;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskImportance = 'important' | 'not_important' | 'unset';
export type TaskUrgency = 'urgent' | 'not_urgent' | 'unset';
export type TaskEffort = 'quick_win' | 'deep_work' | 'unset';

export interface GrowthTask {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  deadline_type: TaskDeadlineType;
  deadline_set_at: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completion_notes: string | null;
  sort_order: number;
  importance: TaskImportance;
  urgency: TaskUrgency;
  effort: TaskEffort;
  pinned_to_tasklist: boolean;
  on_slate: boolean;
  slate_sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GrowthDocument {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  ai_summary: string | null;
  summary_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnownAssignee {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export function useGrowthProjects(projectType?: GrowthProjectType) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['growth-projects', projectType],
    queryFn: async () => {
      let query = supabase
        .from('growth_projects')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (projectType) {
        query = query.eq('project_type', projectType);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as GrowthProject[];
    },
    enabled: !!user,
  });

  const createProject = useMutation({
    mutationFn: async (project: { name: string; project_type: GrowthProjectType; description?: string | null; mentee_name?: string | null }) => {
      const { data, error } = await supabase
        .from('growth_projects')
        .insert([{ 
          name: project.name,
          project_type: project.project_type,
          description: project.description,
          mentee_name: project.mentee_name,
          user_id: user!.id 
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-projects'] });
      toast.success('Project created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create project: ' + error.message);
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GrowthProject> & { id: string }) => {
      const { data, error } = await supabase
        .from('growth_projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-projects'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to update project: ' + error.message);
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('growth_projects')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-projects'] });
      toast.success('Project deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete project: ' + error.message);
    },
  });

  return {
    projects,
    isLoading,
    createProject,
    updateProject,
    deleteProject,
  };
}

export function useGrowthProject(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['growth-project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('growth_projects')
        .select('*')
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      return data as GrowthProject;
    },
    enabled: !!projectId && !!user,
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['growth-project-entries', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('growth_project_entries')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GrowthProjectEntry[];
    },
    enabled: !!projectId && !!user,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['growth-tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('growth_tasks')
        .select('*')
        .eq('project_id', projectId!)
        .order('is_completed', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as GrowthTask[];
    },
    enabled: !!projectId && !!user,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['growth-project-documents', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('growth_project_documents')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GrowthDocument[];
    },
    enabled: !!projectId && !!user,
  });

  const addEntry = useMutation({
    mutationFn: async (entry: Partial<GrowthProjectEntry>) => {
      const { data, error } = await supabase
        .from('growth_project_entries')
        .insert({ ...entry, project_id: projectId!, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-project-entries', projectId] });
      // Trigger AI synthesis
      synthesizeProject();
    },
    onError: (error: Error) => {
      toast.error('Failed to add entry: ' + error.message);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('growth_project_entries')
        .delete()
        .eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-project-entries', projectId] });
    },
  });

  const addTask = useMutation({
    mutationFn: async (task: { title: string; description?: string; assignee?: string; deadline_type: TaskDeadlineType }) => {
      const { data, error } = await supabase
        .from('growth_tasks')
        .insert([{ 
          title: task.title,
          description: task.description,
          assignee: task.assignee,
          deadline_type: task.deadline_type,
          project_id: projectId!, 
          user_id: user!.id,
          deadline_set_at: task.deadline_type !== 'no_deadline' ? new Date().toISOString() : null,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-upcoming-growth-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-growth-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
      synthesizeProject();
    },
    onError: (error: Error) => {
      toast.error('Failed to add task: ' + error.message);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, currentDeadlineSetAt, ...updates }: Partial<GrowthTask> & { id: string; currentDeadlineSetAt?: string | null }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.is_completed === true) {
        updateData.completed_at = new Date().toISOString();
      }
      // Only reset deadline_set_at if:
      // 1. Changing TO a deadline from no_deadline (no existing deadline_set_at)
      // 2. Or explicitly clearing the deadline
      if (updates.deadline_type !== undefined) {
        if (updates.deadline_type === 'no_deadline') {
          updateData.deadline_set_at = null;
        } else if (!currentDeadlineSetAt) {
          // Setting a deadline for the first time
          updateData.deadline_set_at = new Date().toISOString();
        }
        // If changing between deadline types and already has deadline_set_at, keep it
      }
      const { data, error } = await supabase
        .from('growth_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, ...updates }) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['growth-tasks', projectId] });
      await queryClient.cancelQueries({ queryKey: ['my-upcoming-growth-tasks'] });
      
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<GrowthTask[]>(['growth-tasks', projectId]);
      
      // Optimistically update the cache
      if (previousTasks) {
        queryClient.setQueryData<GrowthTask[]>(['growth-tasks', projectId], old => 
          old?.map(task => task.id === id ? { ...task, ...updates } : task)
        );
      }
      
      return { previousTasks };
    },
    onSuccess: () => {
      // Force immediate refetch of the current project's tasks
      queryClient.refetchQueries({ queryKey: ['growth-tasks', projectId] });
      queryClient.refetchQueries({ queryKey: ['my-upcoming-growth-tasks'] });
      queryClient.refetchQueries({ queryKey: ['all-growth-tasks'] });
      queryClient.refetchQueries({ queryKey: ['overdue-tasks'] });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['growth-tasks', projectId], context.previousTasks);
      }
      toast.error('Failed to update task: ' + error.message);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('growth_tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-upcoming-growth-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-growth-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
    },
  });

  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const synthesizeProject = async () => {
    if (!projectId) return;
    setIsSynthesizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('synthesize-growth-project', {
        body: { projectId },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['growth-project', projectId] });
    } catch (error) {
      console.error('Synthesis error:', error);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const refreshDocuments = () => {
    queryClient.invalidateQueries({ queryKey: ['growth-project-documents', projectId] });
  };

  const updateDocumentSummary = (docId: string, summary: string) => {
    queryClient.setQueryData(['growth-project-documents', projectId], (old: GrowthDocument[] | undefined) => {
      if (!old) return old;
      return old.map(doc => 
        doc.id === docId 
          ? { ...doc, ai_summary: summary, summary_generated_at: new Date().toISOString() }
          : doc
      );
    });
  };

  return {
    project,
    entries,
    tasks,
    documents,
    isLoading: projectLoading || entriesLoading || tasksLoading || documentsLoading,
    isSynthesizing,
    addEntry,
    deleteEntry,
    addTask,
    updateTask,
    deleteTask,
    synthesizeProject,
    refreshDocuments,
    updateDocumentSummary,
  };
}

export function useKnownAssignees() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: assignees = [] } = useQuery({
    queryKey: ['known-assignees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('known_assignees')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as KnownAssignee[];
    },
    enabled: !!user,
  });

  const addAssignee = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('known_assignees')
        .upsert({ name, user_id: user!.id }, { onConflict: 'user_id,name' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['known-assignees'] });
    },
  });

  return { assignees, addAssignee };
}

export interface TaskWithProject extends GrowthTask {
  growth_projects: Pick<GrowthProject, 'name' | 'project_type'>;
}

export function useOverdueTasks() {
  const { user } = useAuth();

  const { data: overdueTasks = [] } = useQuery({
    queryKey: ['overdue-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('growth_tasks')
        .select('*, growth_projects!inner(name, project_type)')
        .eq('is_completed', false)
        .neq('deadline_type', 'no_deadline');
      if (error) throw error;
      
      const now = new Date();
      return (data || []).filter((task: TaskWithProject) => {
        if (!task.deadline_set_at) return false;
        const setAt = new Date(task.deadline_set_at);
        const dueDate = calculateDueDate(setAt, task.deadline_type);
        return dueDate < now;
      }) as TaskWithProject[];
    },
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  });

  return { overdueTasks, overdueCount: overdueTasks.length };
}

export function useAllTasksByCategory() {
  const { user } = useAuth();

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ['all-growth-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('growth_tasks')
        .select('*, growth_projects!inner(name, project_type)')
        .eq('is_completed', false);
      if (error) throw error;
      return data as TaskWithProject[];
    },
    enabled: !!user,
  });

  const sortByUrgency = (tasks: TaskWithProject[]) => {
    const now = new Date();
    return [...tasks].sort((a, b) => {
      const aDate = a.deadline_set_at ? calculateDueDate(new Date(a.deadline_set_at), a.deadline_type) : new Date(9999, 11, 31);
      const bDate = b.deadline_set_at ? calculateDueDate(new Date(b.deadline_set_at), b.deadline_type) : new Date(9999, 11, 31);
      return aDate.getTime() - bDate.getTime();
    });
  };

  const getTasksForCategory = (projectType: GrowthProjectType) => {
    const categoryTasks = allTasks.filter(t => t.growth_projects.project_type === projectType);
    const myTasks = sortByUrgency(categoryTasks.filter(t => !t.assignee || t.assignee === 'Me'));
    const othersTasks = sortByUrgency(categoryTasks.filter(t => t.assignee && t.assignee !== 'Me'));
    return { myTasks, othersTasks };
  };

  return {
    isLoading,
    getTasksForCategory,
    bdTasks: getTasksForCategory('business_development'),
    pdTasks: getTasksForCategory('professional_development'),
    ldTasks: getTasksForCategory('learning_development'),
  };
}

/**
 * Hook to fetch Growth tasks assigned to "Me" that are due within the next week.
 * These tasks are shown in the Quick Tasks panel alongside regular quick tasks.
 */
export function useMyUpcomingGrowthTasks() {
  const { user } = useAuth();

  const { data: upcomingTasks = [], isLoading, refetch } = useQuery({
    queryKey: ['my-upcoming-growth-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('growth_tasks')
        .select('*, growth_projects!inner(name, project_type)')
        .eq('is_completed', false);
      
      if (error) throw error;
      
      const now = new Date();
      const twoWeeksFromNow = new Date(now);
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      
      // Include tasks that are:
      // 1. Explicitly pinned to the task list (pinned_to_tasklist = true), OR
      // 2. Have short deadlines (this_week, next_week) - these are always auto-included
      //    unless user explicitly unpins (which sets pinned_to_tasklist to false AND
      //    we track it was user action, not default)
      // 
      // Since DB default is false, we can't distinguish "default false" from "user unpinned".
      // So for short deadline tasks: ALWAYS include them. The only way to remove is to
      // change the deadline or complete the task.
      const shortDeadlines: TaskDeadlineType[] = ['this_week', 'next_week'];
      
      return (data || []).filter((task: TaskWithProject) => {
        // Always include explicitly pinned tasks
        if (task.pinned_to_tasklist === true) return true;
        
        // Always include tasks with short deadlines (auto-add behavior)
        if (shortDeadlines.includes(task.deadline_type)) return true;
        
        return false;
      }) as TaskWithProject[];
    },
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  });

  return { upcomingTasks, isLoading, refetch };
}

export function calculateDueDate(setAt: Date, deadlineType: TaskDeadlineType): Date {
  const date = new Date(setAt);
  switch (deadlineType) {
    case 'this_week':
      // 7 days from set date
      date.setDate(date.getDate() + 7);
      break;
    case 'next_week':
      // 14 days from set date (2 weeks)
      date.setDate(date.getDate() + 14);
      break;
    case 'this_month':
      // 1 month from set date
      date.setMonth(date.getMonth() + 1);
      break;
    case 'next_month':
      // 2 months from set date
      date.setMonth(date.getMonth() + 2);
      break;
    case 'in_3_months':
      // 3 months from set date
      date.setMonth(date.getMonth() + 3);
      break;
    case 'in_6_months':
      // 6 months from set date
      date.setMonth(date.getMonth() + 6);
      break;
    default:
      return new Date(9999, 11, 31); // Far future for no deadline
  }
  return date;
}

export function getDeadlineLabel(deadlineType: TaskDeadlineType): string {
  const labels: Record<TaskDeadlineType, string> = {
    this_week: 'This week',
    next_week: 'Next week',
    this_month: 'This month',
    next_month: 'Next month',
    in_3_months: 'In 3 months',
    in_6_months: 'In 6 months',
    no_deadline: 'No deadline',
  };
  return labels[deadlineType];
}
