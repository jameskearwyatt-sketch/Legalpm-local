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
  sort_order: number;
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
      synthesizeProject();
    },
    onError: (error: Error) => {
      toast.error('Failed to add task: ' + error.message);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GrowthTask> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.is_completed === true) {
        updateData.completed_at = new Date().toISOString();
      }
      if (updates.deadline_type && updates.deadline_type !== 'no_deadline') {
        updateData.deadline_set_at = new Date().toISOString();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-tasks', projectId] });
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

  return {
    project,
    entries,
    tasks,
    isLoading: projectLoading || entriesLoading || tasksLoading,
    isSynthesizing,
    addEntry,
    deleteEntry,
    addTask,
    updateTask,
    deleteTask,
    synthesizeProject,
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
      return (data || []).filter((task: GrowthTask & { growth_projects: GrowthProject }) => {
        if (!task.deadline_set_at) return false;
        const setAt = new Date(task.deadline_set_at);
        const dueDate = calculateDueDate(setAt, task.deadline_type);
        return dueDate < now;
      });
    },
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  });

  return { overdueTasks, overdueCount: overdueTasks.length };
}

export function calculateDueDate(setAt: Date, deadlineType: TaskDeadlineType): Date {
  const date = new Date(setAt);
  switch (deadlineType) {
    case 'this_week':
      // End of current week (Sunday)
      const dayOfWeek = date.getDay();
      date.setDate(date.getDate() + (7 - dayOfWeek));
      break;
    case 'next_week':
      date.setDate(date.getDate() + 14 - date.getDay());
      break;
    case 'this_month':
      date.setMonth(date.getMonth() + 1, 0); // Last day of current month
      break;
    case 'next_month':
      date.setMonth(date.getMonth() + 2, 0);
      break;
    case 'in_3_months':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'in_6_months':
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
