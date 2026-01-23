-- BM Internal Contacts - Core contact info
CREATE TABLE public.bm_internal_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  surname TEXT NOT NULL,
  title TEXT, -- e.g., Partner, Counsel, Associate
  region TEXT, -- e.g., Asia Pacific, EMEA, North America, Latin America
  office TEXT, -- e.g., Singapore, London, Dallas
  practice_group TEXT, -- e.g., Transactional - Energy & Infrastructure
  email TEXT,
  expertise JSONB NOT NULL DEFAULT '{}'::jsonb, -- Stores all expertise flags by category
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bm_internal_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own BM contacts" 
ON public.bm_internal_contacts 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for filtering
CREATE INDEX idx_bm_internal_contacts_region ON public.bm_internal_contacts(region);
CREATE INDEX idx_bm_internal_contacts_office ON public.bm_internal_contacts(office);
CREATE INDEX idx_bm_internal_contacts_expertise ON public.bm_internal_contacts USING GIN(expertise);

-- Trigger for updated_at
CREATE TRIGGER update_bm_internal_contacts_updated_at
BEFORE UPDATE ON public.bm_internal_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Named shortlists (like playlists)
CREATE TABLE public.bm_contact_shortlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bm_contact_shortlists ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own shortlists" 
ON public.bm_contact_shortlists 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_bm_contact_shortlists_updated_at
BEFORE UPDATE ON public.bm_contact_shortlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Junction table for shortlist members
CREATE TABLE public.bm_shortlist_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shortlist_id UUID NOT NULL REFERENCES public.bm_contact_shortlists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.bm_internal_contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shortlist_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.bm_shortlist_members ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own shortlist members" 
ON public.bm_shortlist_members 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for lookups
CREATE INDEX idx_bm_shortlist_members_shortlist ON public.bm_shortlist_members(shortlist_id);
CREATE INDEX idx_bm_shortlist_members_contact ON public.bm_shortlist_members(contact_id);