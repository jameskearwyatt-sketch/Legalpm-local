
-- Carbon Credit Offtake Analyst tables

-- Analyses
CREATE TABLE public.carbon_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT 'carbon_vs_bible',
  perspective TEXT NOT NULL DEFAULT 'buyer',
  project_name TEXT NOT NULL,
  jurisdiction TEXT,
  document_file_name TEXT NOT NULL,
  document_file_url TEXT,
  comparison_file_name TEXT,
  comparison_file_url TEXT,
  is_agreed BOOLEAN NOT NULL DEFAULT false,
  agreed_at TIMESTAMPTZ,
  notes TEXT,
  parent_analysis_id UUID,
  version_number INTEGER NOT NULL DEFAULT 1,
  is_comparison BOOLEAN NOT NULL DEFAULT false,
  carbon_type TEXT,
  project_stage TEXT,
  complexity_score INTEGER,
  key_risk_areas TEXT[] NOT NULL DEFAULT '{}',
  counterparty_type TEXT,
  buyer_name TEXT,
  seller_name TEXT,
  buyer_normalized TEXT,
  seller_normalized TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.carbon_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own carbon analyses" ON public.carbon_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own carbon analyses" ON public.carbon_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own carbon analyses" ON public.carbon_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own carbon analyses" ON public.carbon_analyses FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_carbon_analyses_updated_at BEFORE UPDATE ON public.carbon_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extracted Positions
CREATE TABLE public.carbon_extracted_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.carbon_analyses(id) ON DELETE CASCADE,
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

ALTER TABLE public.carbon_extracted_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own carbon positions" ON public.carbon_extracted_positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own carbon positions" ON public.carbon_extracted_positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own carbon positions" ON public.carbon_extracted_positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own carbon positions" ON public.carbon_extracted_positions FOR DELETE USING (auth.uid() = user_id);

-- Precedent Bank
CREATE TABLE public.carbon_precedent_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_analysis_id UUID REFERENCES public.carbon_analyses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  position_summary TEXT NOT NULL,
  project_name TEXT NOT NULL,
  jurisdiction TEXT,
  perspective TEXT NOT NULL DEFAULT 'buyer',
  banked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_gold_standard BOOLEAN NOT NULL DEFAULT false,
  template_name TEXT,
  template_description TEXT,
  carbon_type TEXT,
  project_stage TEXT,
  source_text TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  market_position TEXT,
  party_favorability TEXT,
  buyer_name TEXT,
  seller_name TEXT,
  buyer_normalized TEXT,
  seller_normalized TEXT
);

ALTER TABLE public.carbon_precedent_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own carbon precedents" ON public.carbon_precedent_bank FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own carbon precedents" ON public.carbon_precedent_bank FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own carbon precedents" ON public.carbon_precedent_bank FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own carbon precedents" ON public.carbon_precedent_bank FOR DELETE USING (auth.uid() = user_id);

-- Learnings
CREATE TABLE public.carbon_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_id UUID REFERENCES public.carbon_analyses(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  original_position TEXT NOT NULL,
  corrected_position TEXT NOT NULL,
  correction_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.carbon_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own carbon learnings" ON public.carbon_learnings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own carbon learnings" ON public.carbon_learnings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own carbon learnings" ON public.carbon_learnings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own carbon learnings" ON public.carbon_learnings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_carbon_learnings_updated_at BEFORE UPDATE ON public.carbon_learnings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
