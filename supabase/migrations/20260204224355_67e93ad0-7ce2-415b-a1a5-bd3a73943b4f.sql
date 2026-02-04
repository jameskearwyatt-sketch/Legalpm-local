-- Add PPA precedent threshold setting
ALTER TABLE public.user_settings
ADD COLUMN ppa_precedent_threshold INTEGER NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.user_settings.ppa_precedent_threshold IS 'Minimum number of precedents required before comparing PPA positions against market';