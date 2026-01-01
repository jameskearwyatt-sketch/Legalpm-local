-- Add matter managing attorney field to matters table
ALTER TABLE public.matters 
ADD COLUMN matter_managing_attorney text;