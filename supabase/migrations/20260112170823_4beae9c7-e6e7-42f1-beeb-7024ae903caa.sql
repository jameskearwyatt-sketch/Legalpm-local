-- Add is_starred column to growth_projects table
ALTER TABLE public.growth_projects 
ADD COLUMN is_starred BOOLEAN NOT NULL DEFAULT false;