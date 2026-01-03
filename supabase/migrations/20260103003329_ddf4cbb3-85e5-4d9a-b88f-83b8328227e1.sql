-- Create table for time recording drafts
CREATE TABLE public.time_recording_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('single', 'multi')),
  single_date DATE,
  date_range_from DATE,
  date_range_to DATE,
  grid_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  processed_output JSONB,
  is_polished BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.time_recording_drafts ENABLE ROW LEVEL SECURITY;

-- Create policy for user access
CREATE POLICY "Users can manage own time recording drafts" 
ON public.time_recording_drafts 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_time_recording_drafts_updated_at
BEFORE UPDATE ON public.time_recording_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();