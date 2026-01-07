-- Create enum for project types
CREATE TYPE growth_project_type AS ENUM ('business_development', 'professional_development', 'learning_development');

-- Create enum for task deadline types
CREATE TYPE task_deadline_type AS ENUM ('this_week', 'next_week', 'this_month', 'next_month', 'in_3_months', 'in_6_months', 'no_deadline');

-- Create table for known assignees (remembered names)
CREATE TABLE public.known_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.known_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own known assignees"
  ON public.known_assignees
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create table for growth projects
CREATE TABLE public.growth_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_type growth_project_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  ai_summary TEXT,
  mentee_name TEXT, -- For professional development projects where user is coaching someone
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.growth_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own growth projects"
  ON public.growth_projects
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_growth_projects_updated_at
  BEFORE UPDATE ON public.growth_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for project entries (the scrapbook content)
CREATE TABLE public.growth_project_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.growth_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'note', -- 'note', 'file', 'meeting_minutes'
  title TEXT,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.growth_project_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own project entries"
  ON public.growth_project_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_growth_project_entries_updated_at
  BEFORE UPDATE ON public.growth_project_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for tasks
CREATE TABLE public.growth_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.growth_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT,
  deadline_type task_deadline_type NOT NULL DEFAULT 'no_deadline',
  deadline_set_at TIMESTAMP WITH TIME ZONE, -- When the deadline was set (to calculate actual due date)
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.growth_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own growth tasks"
  ON public.growth_tasks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_growth_tasks_updated_at
  BEFORE UPDATE ON public.growth_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for growth project files
INSERT INTO storage.buckets (id, name, public) VALUES ('growth-files', 'growth-files', false);

-- Storage policies for growth files
CREATE POLICY "Users can upload growth files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'growth-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own growth files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'growth-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own growth files"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'growth-files' AND auth.uid()::text = (storage.foldername(name))[1]);