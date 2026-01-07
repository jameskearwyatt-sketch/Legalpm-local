-- Add a display name field for summarized matter names in table view
ALTER TABLE public.matters ADD COLUMN IF NOT EXISTS matter_display_name text;