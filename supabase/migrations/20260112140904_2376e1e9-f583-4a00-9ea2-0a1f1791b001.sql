-- Create table for slate-only items (personal tasks that don't exist in quick_tasks or growth_tasks)
CREATE TABLE public.slate_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  is_personal BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.slate_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage own slate items"
ON public.slate_items
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add slate_sort_order column to quick_tasks for ordering on slate
ALTER TABLE public.quick_tasks
ADD COLUMN slate_sort_order INTEGER NOT NULL DEFAULT 0;

-- Add slate_sort_order column to growth_tasks for ordering on slate
ALTER TABLE public.growth_tasks
ADD COLUMN slate_sort_order INTEGER NOT NULL DEFAULT 0;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_slate_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_slate_items_updated_at
BEFORE UPDATE ON public.slate_items
FOR EACH ROW
EXECUTE FUNCTION public.update_slate_items_updated_at();