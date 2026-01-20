-- Add is_exceeded column to matter_assumptions table
ALTER TABLE public.matter_assumptions 
ADD COLUMN is_exceeded boolean NOT NULL DEFAULT false;