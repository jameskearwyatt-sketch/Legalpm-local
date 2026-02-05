-- Create table to store user corrections/learnings for the PPA AI
CREATE TABLE public.ppa_ai_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  original_position TEXT NOT NULL,
  user_feedback TEXT NOT NULL,
  corrected_position TEXT,
  source_analysis_id UUID REFERENCES public.ppa_analyses(id) ON DELETE SET NULL,
  source_position_id UUID REFERENCES public.ppa_extracted_positions(id) ON DELETE SET NULL,
  project_context TEXT,
  jurisdiction TEXT,
  ppa_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ppa_ai_learnings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own learnings" 
ON public.ppa_ai_learnings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own learnings" 
ON public.ppa_ai_learnings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learnings" 
ON public.ppa_ai_learnings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learnings" 
ON public.ppa_ai_learnings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_ppa_ai_learnings_updated_at
BEFORE UPDATE ON public.ppa_ai_learnings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient lookups by category
CREATE INDEX idx_ppa_ai_learnings_category ON public.ppa_ai_learnings(category);
CREATE INDEX idx_ppa_ai_learnings_user_active ON public.ppa_ai_learnings(user_id, is_active);