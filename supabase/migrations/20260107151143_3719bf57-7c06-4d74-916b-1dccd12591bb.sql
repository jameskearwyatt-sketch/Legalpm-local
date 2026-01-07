-- Add display_name column to clients table for "commonly referred to" short names
ALTER TABLE public.clients 
ADD COLUMN display_name text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.clients.display_name IS 'Optional short/nickname for the client. If set, this is displayed throughout the app instead of the full name.';