-- Add on_hold_months column to matters table
ALTER TABLE public.matters 
ADD COLUMN on_hold_months numeric NOT NULL DEFAULT 0;