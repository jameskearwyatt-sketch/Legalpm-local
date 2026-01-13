-- Add selected_dates column to store the array of selected dates (supports non-contiguous selections)
ALTER TABLE public.time_recording_drafts 
ADD COLUMN selected_dates jsonb DEFAULT '[]'::jsonb;