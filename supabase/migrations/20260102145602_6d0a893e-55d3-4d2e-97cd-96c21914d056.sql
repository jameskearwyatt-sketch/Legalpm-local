-- Add JSONB columns to pricing_proposals for proposal-specific settings
ALTER TABLE public.pricing_proposals
ADD COLUMN IF NOT EXISTS rate_card JSONB DEFAULT '{
  "partner": {"rate": 850, "cost": 425},
  "seniorAssociate": {"rate": 650, "cost": 260},
  "associate": {"rate": 450, "cost": 180},
  "trainee": {"rate": 250, "cost": 100}
}'::jsonb;

ALTER TABLE public.pricing_proposals
ADD COLUMN IF NOT EXISTS work_phases JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.pricing_proposals
ADD COLUMN IF NOT EXISTS assumptions JSONB DEFAULT '{
  "negotiatedDocsDecay": 0.5,
  "ddDecay": 0.35,
  "numMeetings": 0,
  "meetingHoursPartner": 3,
  "meetingHoursAssociate": 2,
  "numNegotiationTurns": 3,
  "afaDiscount": 0
}'::jsonb;