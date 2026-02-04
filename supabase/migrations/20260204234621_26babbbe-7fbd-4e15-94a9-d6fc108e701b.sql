-- Create enum for PPA types
CREATE TYPE ppa_structure_type AS ENUM ('vppa', 'physical', 'sleeved', 'private_wire');

-- Add ppa_type to ppa_analyses table
ALTER TABLE public.ppa_analyses 
ADD COLUMN ppa_type ppa_structure_type DEFAULT NULL;

-- Add ppa_type to ppa_precedent_bank table  
ALTER TABLE public.ppa_precedent_bank 
ADD COLUMN ppa_type ppa_structure_type DEFAULT NULL;

-- Add additional learning fields to ppa_analyses
ALTER TABLE public.ppa_analyses 
ADD COLUMN complexity_score integer DEFAULT NULL,
ADD COLUMN key_risk_areas text[] DEFAULT '{}',
ADD COLUMN counterparty_type text DEFAULT NULL;

-- Add additional learning fields to ppa_precedent_bank
ALTER TABLE public.ppa_precedent_bank 
ADD COLUMN source_text text DEFAULT NULL,
ADD COLUMN confidence ppa_confidence_level DEFAULT 'medium',
ADD COLUMN market_position text DEFAULT NULL,
ADD COLUMN party_favorability text DEFAULT NULL;