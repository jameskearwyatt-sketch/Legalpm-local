-- Create table for storing reusable welcome paragraphs
CREATE TABLE public.wip_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wip_email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage own WIP email templates"
  ON public.wip_email_templates
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create table for WIP email log (tracking sent emails)
CREATE TABLE public.wip_email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  recipient_names TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  welcome_template_id UUID REFERENCES public.wip_email_templates(id) ON DELETE SET NULL,
  was_sent BOOLEAN NOT NULL DEFAULT false,
  sent_date DATE,
  sent_confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wip_email_log ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage own WIP email log"
  ON public.wip_email_log
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add billing_contacts JSONB column to clients table to store billing contact references
-- Format: [{ contact_id: uuid, name: string, email: string }]
ALTER TABLE public.clients 
ADD COLUMN billing_contacts JSONB DEFAULT '[]'::jsonb;

-- Create trigger for updated_at on wip_email_templates
CREATE TRIGGER update_wip_email_templates_updated_at
  BEFORE UPDATE ON public.wip_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();