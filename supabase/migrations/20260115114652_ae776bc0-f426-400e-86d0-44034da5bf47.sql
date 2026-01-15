-- Create table to store user report format configurations
CREATE TABLE public.user_report_formats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format_name TEXT NOT NULL,
  column_mappings JSONB NOT NULL DEFAULT '{}',
  header_signature TEXT, -- For auto-recognition of format
  sample_headers JSONB, -- Store sample headers for display
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id) -- One format per user for now
);

-- Enable RLS
ALTER TABLE public.user_report_formats ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own report formats"
  ON public.user_report_formats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own report formats"
  ON public.user_report_formats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own report formats"
  ON public.user_report_formats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own report formats"
  ON public.user_report_formats FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_report_formats_updated_at
  BEFORE UPDATE ON public.user_report_formats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.user_report_formats IS 'Stores user-specific report format configurations for WIP import';
COMMENT ON COLUMN public.user_report_formats.column_mappings IS 'JSON mapping of field names to column indices, e.g., {"wip": 3, "ar": 4, "matter_number": 0}';