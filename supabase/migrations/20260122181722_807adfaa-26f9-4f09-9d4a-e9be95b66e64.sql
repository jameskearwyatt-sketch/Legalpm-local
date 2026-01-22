-- Create enum for contact gender
CREATE TYPE contact_gender AS ENUM ('male', 'female', 'unknown');

-- Create enum for email draft types
CREATE TYPE email_draft_type AS ENUM ('event_invitation', 'article_sharing', 'firm_update');

-- Create enum for delivery mode
CREATE TYPE email_delivery_mode AS ENUM ('bcc_all', 'individual');

-- Create sectors table (admin-managed closed list)
CREATE TABLE public.distribution_sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.distribution_sectors ENABLE ROW LEVEL SECURITY;

-- RLS policies for sectors
CREATE POLICY "Users can manage own sectors"
ON public.distribution_sectors
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create contacts table
CREATE TABLE public.distribution_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  job_title TEXT,
  country TEXT,
  city TEXT,
  gender contact_gender NOT NULL DEFAULT 'unknown',
  sectors TEXT[] NOT NULL DEFAULT '{}',
  sectors_ai_assigned BOOLEAN NOT NULL DEFAULT false,
  linkedin_url TEXT,
  notes TEXT,
  relationship_owner TEXT,
  do_not_contact BOOLEAN NOT NULL DEFAULT false,
  provenance TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

-- Enable RLS
ALTER TABLE public.distribution_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for contacts
CREATE POLICY "Users can manage own contacts"
ON public.distribution_contacts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_distribution_contacts_updated_at
BEFORE UPDATE ON public.distribution_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create campaigns table
CREATE TABLE public.distribution_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  saved_filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.distribution_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaigns
CREATE POLICY "Users can manage own campaigns"
ON public.distribution_campaigns
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_distribution_campaigns_updated_at
BEFORE UPDATE ON public.distribution_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create email drafts table
CREATE TABLE public.distribution_email_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.distribution_campaigns(id) ON DELETE SET NULL,
  draft_type email_draft_type NOT NULL,
  delivery_mode email_delivery_mode NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.distribution_email_drafts ENABLE ROW LEVEL SECURITY;

-- RLS policies for email drafts
CREATE POLICY "Users can manage own email drafts"
ON public.distribution_email_drafts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create activity log table (minimal logging)
CREATE TABLE public.distribution_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.distribution_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity log
CREATE POLICY "Users can manage own activity log"
ON public.distribution_activity_log
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create known relationship owners table (for autocomplete)
CREATE TABLE public.distribution_relationship_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.distribution_relationship_owners ENABLE ROW LEVEL SECURITY;

-- RLS policies for relationship owners
CREATE POLICY "Users can manage own relationship owners"
ON public.distribution_relationship_owners
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);