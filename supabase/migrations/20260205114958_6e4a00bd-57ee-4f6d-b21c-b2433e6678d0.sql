-- Add buyer and seller name columns to ppa_analyses
ALTER TABLE public.ppa_analyses
ADD COLUMN buyer_name text,
ADD COLUMN seller_name text;

-- Add buyer and seller name columns to ppa_precedent_bank
ALTER TABLE public.ppa_precedent_bank
ADD COLUMN buyer_name text,
ADD COLUMN seller_name text;

-- Add indexes for efficient searching by party names
CREATE INDEX idx_ppa_analyses_buyer_name ON public.ppa_analyses(buyer_name);
CREATE INDEX idx_ppa_analyses_seller_name ON public.ppa_analyses(seller_name);
CREATE INDEX idx_ppa_precedent_bank_buyer_name ON public.ppa_precedent_bank(buyer_name);
CREATE INDEX idx_ppa_precedent_bank_seller_name ON public.ppa_precedent_bank(seller_name);