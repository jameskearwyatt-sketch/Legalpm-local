-- Add progress column to matters table (0-100 representing percentage completion)
ALTER TABLE public.matters
ADD COLUMN progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);