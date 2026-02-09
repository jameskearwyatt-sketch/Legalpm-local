
-- Tolling Analyst tables (mirrors PPA Analyst structure)

-- Tolling Analyses
CREATE TABLE public.tolling_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT 'tolling_vs_bible',
  perspective TEXT NOT NULL DEFAULT 'offtaker',
  project_name TEXT NOT NULL,
  jurisdiction TEXT,
  document_file_name TEXT NOT NULL DEFAULT '',
  document_file_url TEXT,
  comparison_file_name TEXT,
  comparison_file_url TEXT,
  is_agreed BOOLEAN NOT NULL DEFAULT false,
  agreed_at TIMESTAMPTZ,
  notes TEXT,
  parent_analysis_id UUID REFERENCES public.tolling_analyses(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  is_comparison BOOLEAN NOT NULL DEFAULT false,
  tolling_type TEXT,
  complexity_score INTEGER,
  key_risk_areas TEXT[] DEFAULT '{}',
  counterparty_type TEXT,
  offtaker_name TEXT,
  generator_name TEXT,
  offtaker_normalized TEXT,
  generator_normalized TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tolling_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tolling analyses" ON public.tolling_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tolling analyses" ON public.tolling_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tolling analyses" ON public.tolling_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tolling analyses" ON public.tolling_analyses FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_tolling_analyses_updated_at BEFORE UPDATE ON public.tolling_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tolling Extracted Positions
CREATE TABLE public.tolling_extracted_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.tolling_analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  position_summary TEXT NOT NULL,
  source_text TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  bible_reference TEXT,
  comparison_position TEXT,
  variance_notes TEXT,
  previous_position TEXT,
  change_summary TEXT,
  change_type TEXT,
  market_benchmark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tolling_extracted_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tolling positions" ON public.tolling_extracted_positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tolling positions" ON public.tolling_extracted_positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tolling positions" ON public.tolling_extracted_positions FOR DELETE USING (auth.uid() = user_id);

-- Tolling Precedent Bank
CREATE TABLE public.tolling_precedent_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_analysis_id UUID REFERENCES public.tolling_analyses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  position_summary TEXT NOT NULL,
  project_name TEXT NOT NULL,
  jurisdiction TEXT,
  perspective TEXT NOT NULL DEFAULT 'offtaker',
  banked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_gold_standard BOOLEAN NOT NULL DEFAULT false,
  template_name TEXT,
  template_description TEXT,
  tolling_type TEXT,
  source_text TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  market_position TEXT,
  party_favorability TEXT,
  offtaker_name TEXT,
  generator_name TEXT,
  offtaker_normalized TEXT,
  generator_normalized TEXT
);

ALTER TABLE public.tolling_precedent_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tolling precedents" ON public.tolling_precedent_bank FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tolling precedents" ON public.tolling_precedent_bank FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tolling precedents" ON public.tolling_precedent_bank FOR DELETE USING (auth.uid() = user_id);

-- Tolling Learnings
CREATE TABLE public.tolling_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_id UUID REFERENCES public.tolling_analyses(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  original_position TEXT NOT NULL,
  corrected_position TEXT NOT NULL,
  correction_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tolling_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tolling learnings" ON public.tolling_learnings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tolling learnings" ON public.tolling_learnings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tolling learnings" ON public.tolling_learnings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tolling learnings" ON public.tolling_learnings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_tolling_learnings_updated_at BEFORE UPDATE ON public.tolling_learnings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
