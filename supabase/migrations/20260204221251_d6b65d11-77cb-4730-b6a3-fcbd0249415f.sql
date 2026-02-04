-- Create enum for analysis type
CREATE TYPE public.ppa_analysis_type AS ENUM ('ppa_vs_bible', 'ppa_vs_termsheet');

-- Create enum for perspective
CREATE TYPE public.ppa_perspective AS ENUM ('buyer', 'seller');

-- Create enum for confidence level
CREATE TYPE public.ppa_confidence_level AS ENUM ('high', 'medium', 'review_required');

-- Main PPA analyses table
CREATE TABLE public.ppa_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_type public.ppa_analysis_type NOT NULL,
  perspective public.ppa_perspective NOT NULL,
  project_name TEXT NOT NULL,
  jurisdiction TEXT,
  document_file_name TEXT NOT NULL,
  document_file_url TEXT,
  comparison_file_name TEXT,
  comparison_file_url TEXT,
  is_agreed BOOLEAN NOT NULL DEFAULT false,
  agreed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Extracted positions from analyses
CREATE TABLE public.ppa_extracted_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.ppa_analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  position_summary TEXT NOT NULL,
  source_text TEXT,
  confidence public.ppa_confidence_level NOT NULL DEFAULT 'medium',
  bible_reference TEXT,
  comparison_position TEXT,
  variance_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Precedent bank entries (banked from agreed PPAs)
CREATE TABLE public.ppa_precedent_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_analysis_id UUID REFERENCES public.ppa_analyses(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  position_summary TEXT NOT NULL,
  project_name TEXT NOT NULL,
  jurisdiction TEXT,
  perspective public.ppa_perspective NOT NULL,
  banked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ppa_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ppa_extracted_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ppa_precedent_bank ENABLE ROW LEVEL SECURITY;

-- RLS policies for ppa_analyses
CREATE POLICY "Users can view their own analyses" 
ON public.ppa_analyses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analyses" 
ON public.ppa_analyses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses" 
ON public.ppa_analyses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses" 
ON public.ppa_analyses 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for ppa_extracted_positions
CREATE POLICY "Users can view their own positions" 
ON public.ppa_extracted_positions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own positions" 
ON public.ppa_extracted_positions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions" 
ON public.ppa_extracted_positions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own positions" 
ON public.ppa_extracted_positions 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for ppa_precedent_bank
CREATE POLICY "Users can view their own precedents" 
ON public.ppa_precedent_bank 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own precedents" 
ON public.ppa_precedent_bank 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own precedents" 
ON public.ppa_precedent_bank 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create updated_at trigger for ppa_analyses
CREATE TRIGGER update_ppa_analyses_updated_at
BEFORE UPDATE ON public.ppa_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_ppa_analyses_user_id ON public.ppa_analyses(user_id);
CREATE INDEX idx_ppa_analyses_created_at ON public.ppa_analyses(created_at DESC);
CREATE INDEX idx_ppa_extracted_positions_analysis_id ON public.ppa_extracted_positions(analysis_id);
CREATE INDEX idx_ppa_precedent_bank_user_category ON public.ppa_precedent_bank(user_id, category);