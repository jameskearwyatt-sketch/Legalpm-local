-- Create table to store user-confirmed matter mappings for report matching
CREATE TABLE public.report_matter_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  imported_matter_number TEXT,
  imported_matter_name TEXT,
  imported_client_name TEXT,
  mapped_matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, imported_matter_number, imported_matter_name)
);

-- Enable RLS
ALTER TABLE public.report_matter_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own mappings" 
ON public.report_matter_mappings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mappings" 
ON public.report_matter_mappings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mappings" 
ON public.report_matter_mappings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mappings" 
ON public.report_matter_mappings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add client_name column to the column mappings type in user_report_formats
-- (This is handled in the JSON, no migration needed)

-- Add updated_at trigger
CREATE TRIGGER update_report_matter_mappings_updated_at
BEFORE UPDATE ON public.report_matter_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();