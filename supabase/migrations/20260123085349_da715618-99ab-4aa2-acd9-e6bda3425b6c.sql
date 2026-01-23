-- Create custom distribution lists table
CREATE TABLE public.custom_distribution_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for contacts in lists (many-to-many)
CREATE TABLE public.custom_list_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.custom_distribution_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.distribution_contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(list_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.custom_distribution_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_list_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_distribution_lists
CREATE POLICY "Users can view their own distribution lists"
  ON public.custom_distribution_lists
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own distribution lists"
  ON public.custom_distribution_lists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own distribution lists"
  ON public.custom_distribution_lists
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own distribution lists"
  ON public.custom_distribution_lists
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for custom_list_contacts
CREATE POLICY "Users can view their own list contacts"
  ON public.custom_list_contacts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add contacts to their own lists"
  ON public.custom_list_contacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove contacts from their own lists"
  ON public.custom_list_contacts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_custom_distribution_lists_user_id ON public.custom_distribution_lists(user_id);
CREATE INDEX idx_custom_list_contacts_list_id ON public.custom_list_contacts(list_id);
CREATE INDEX idx_custom_list_contacts_contact_id ON public.custom_list_contacts(contact_id);
CREATE INDEX idx_custom_list_contacts_user_id ON public.custom_list_contacts(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_custom_distribution_lists_updated_at
  BEFORE UPDATE ON public.custom_distribution_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();