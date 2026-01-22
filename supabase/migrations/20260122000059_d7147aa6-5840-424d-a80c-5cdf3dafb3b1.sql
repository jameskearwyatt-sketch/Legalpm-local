-- Add column to track whether rate modifier applies to this matter only or all client matters
ALTER TABLE public.matters 
ADD COLUMN rate_modifier_scope text;