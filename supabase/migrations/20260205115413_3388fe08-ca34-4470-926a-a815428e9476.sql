-- Add normalized party name columns for intelligent grouping
ALTER TABLE public.ppa_analyses
ADD COLUMN buyer_normalized text,
ADD COLUMN seller_normalized text;

ALTER TABLE public.ppa_precedent_bank
ADD COLUMN buyer_normalized text,
ADD COLUMN seller_normalized text;

-- Index the normalized names for efficient filtering
CREATE INDEX idx_ppa_analyses_buyer_normalized ON public.ppa_analyses(buyer_normalized);
CREATE INDEX idx_ppa_analyses_seller_normalized ON public.ppa_analyses(seller_normalized);
CREATE INDEX idx_ppa_precedent_bank_buyer_normalized ON public.ppa_precedent_bank(buyer_normalized);
CREATE INDEX idx_ppa_precedent_bank_seller_normalized ON public.ppa_precedent_bank(seller_normalized);