-- Update the default rate_card for new pricing proposals
ALTER TABLE public.pricing_proposals 
ALTER COLUMN rate_card SET DEFAULT '{"partner": {"cost": 425, "rate": 1300}, "trainee": {"cost": 100, "rate": 400}, "associate": {"cost": 180, "rate": 650}, "seniorAssociate": {"cost": 260, "rate": 1000}}'::jsonb;