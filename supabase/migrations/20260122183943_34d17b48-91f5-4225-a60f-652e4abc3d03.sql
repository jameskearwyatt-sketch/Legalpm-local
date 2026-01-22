-- Create table to store user contact import format configurations
CREATE TABLE public.contact_import_formats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format_name TEXT NOT NULL,
  column_mappings JSONB NOT NULL DEFAULT '{}',
  header_signature TEXT, -- For auto-recognition of format
  sample_headers JSONB, -- Store sample headers for display
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, header_signature) -- Allow multiple formats per user, one per signature
);

-- Enable RLS
ALTER TABLE public.contact_import_formats ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own contact import formats"
  ON public.contact_import_formats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contact import formats"
  ON public.contact_import_formats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contact import formats"
  ON public.contact_import_formats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contact import formats"
  ON public.contact_import_formats FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_contact_import_formats_updated_at
  BEFORE UPDATE ON public.contact_import_formats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.contact_import_formats IS 'Stores user-specific contact import format configurations';
COMMENT ON COLUMN public.contact_import_formats.column_mappings IS 'JSON mapping of field names to column indices, e.g., {"full_name": 0, "email": 1}';