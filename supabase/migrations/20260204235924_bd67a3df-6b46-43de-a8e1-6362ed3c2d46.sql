-- Add market_benchmark column to store the "What's Market?" textbook position
ALTER TABLE public.ppa_extracted_positions 
ADD COLUMN market_benchmark text DEFAULT NULL;