
-- =============================================
-- IT SUPPLY ANALYST TABLES
-- =============================================

-- IT Supply Analyses
CREATE TABLE public.it_supply_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT 'contract_vs_bible',
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
  version_number INT NOT NULL DEFAULT 1,
  is_comparison BOOLEAN NOT NULL DEFAULT false,
  supply_type TEXT,
  contract_stage TEXT,
  complexity_score INT,
  key_risk_areas TEXT[] NOT NULL DEFAULT '{}',
  counterparty_type TEXT,
  buyer_name TEXT,
  supplier_name TEXT,
  buyer_normalized TEXT,
  supplier_normalized TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.it_supply_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own IT supply analyses" ON public.it_supply_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own IT supply analyses" ON public.it_supply_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own IT supply analyses" ON public.it_supply_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own IT supply analyses" ON public.it_supply_analyses FOR DELETE USING (auth.uid() = user_id);

-- IT Supply Extracted Positions
CREATE TABLE public.it_supply_extracted_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.it_supply_analyses(id) ON DELETE CASCADE,
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

ALTER TABLE public.it_supply_extracted_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own IT supply positions" ON public.it_supply_extracted_positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own IT supply positions" ON public.it_supply_extracted_positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own IT supply positions" ON public.it_supply_extracted_positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own IT supply positions" ON public.it_supply_extracted_positions FOR DELETE USING (auth.uid() = user_id);

-- IT Supply Precedent Bank
CREATE TABLE public.it_supply_precedent_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_analysis_id UUID REFERENCES public.it_supply_analyses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  position_summary TEXT NOT NULL,
  project_name TEXT NOT NULL,
  jurisdiction TEXT,
  perspective TEXT NOT NULL DEFAULT 'buyer',
  banked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_gold_standard BOOLEAN NOT NULL DEFAULT false,
  template_name TEXT,
  template_description TEXT,
  supply_type TEXT,
  contract_stage TEXT,
  source_text TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  market_position TEXT,
  party_favorability TEXT,
  buyer_name TEXT,
  supplier_name TEXT,
  buyer_normalized TEXT,
  supplier_normalized TEXT
);

ALTER TABLE public.it_supply_precedent_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own IT supply precedents" ON public.it_supply_precedent_bank FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own IT supply precedents" ON public.it_supply_precedent_bank FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own IT supply precedents" ON public.it_supply_precedent_bank FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own IT supply precedents" ON public.it_supply_precedent_bank FOR DELETE USING (auth.uid() = user_id);

-- IT Supply Learnings
CREATE TABLE public.it_supply_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_id UUID REFERENCES public.it_supply_analyses(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  original_position TEXT NOT NULL,
  corrected_position TEXT NOT NULL,
  correction_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.it_supply_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own IT supply learnings" ON public.it_supply_learnings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own IT supply learnings" ON public.it_supply_learnings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own IT supply learnings" ON public.it_supply_learnings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own IT supply learnings" ON public.it_supply_learnings FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- CLOUD COMPUTE SERVICES ANALYST TABLES
-- =============================================

-- Cloud Compute Analyses
CREATE TABLE public.cloud_compute_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT 'agreement_vs_bible',
  perspective TEXT NOT NULL DEFAULT 'tenant',
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
  version_number INT NOT NULL DEFAULT 1,
  is_comparison BOOLEAN NOT NULL DEFAULT false,
  service_type TEXT,
  deployment_model TEXT,
  complexity_score INT,
  key_risk_areas TEXT[] NOT NULL DEFAULT '{}',
  counterparty_type TEXT,
  tenant_name TEXT,
  provider_name TEXT,
  tenant_normalized TEXT,
  provider_normalized TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cloud_compute_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cloud compute analyses" ON public.cloud_compute_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cloud compute analyses" ON public.cloud_compute_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cloud compute analyses" ON public.cloud_compute_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cloud compute analyses" ON public.cloud_compute_analyses FOR DELETE USING (auth.uid() = user_id);

-- Cloud Compute Extracted Positions
CREATE TABLE public.cloud_compute_extracted_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.cloud_compute_analyses(id) ON DELETE CASCADE,
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

ALTER TABLE public.cloud_compute_extracted_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cloud compute positions" ON public.cloud_compute_extracted_positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cloud compute positions" ON public.cloud_compute_extracted_positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cloud compute positions" ON public.cloud_compute_extracted_positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cloud compute positions" ON public.cloud_compute_extracted_positions FOR DELETE USING (auth.uid() = user_id);

-- Cloud Compute Precedent Bank
CREATE TABLE public.cloud_compute_precedent_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_analysis_id UUID REFERENCES public.cloud_compute_analyses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  position_summary TEXT NOT NULL,
  project_name TEXT NOT NULL,
  jurisdiction TEXT,
  perspective TEXT NOT NULL DEFAULT 'tenant',
  banked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_gold_standard BOOLEAN NOT NULL DEFAULT false,
  template_name TEXT,
  template_description TEXT,
  service_type TEXT,
  deployment_model TEXT,
  source_text TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  market_position TEXT,
  party_favorability TEXT,
  tenant_name TEXT,
  provider_name TEXT,
  tenant_normalized TEXT,
  provider_normalized TEXT
);

ALTER TABLE public.cloud_compute_precedent_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cloud compute precedents" ON public.cloud_compute_precedent_bank FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cloud compute precedents" ON public.cloud_compute_precedent_bank FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cloud compute precedents" ON public.cloud_compute_precedent_bank FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cloud compute precedents" ON public.cloud_compute_precedent_bank FOR DELETE USING (auth.uid() = user_id);

-- Cloud Compute Learnings
CREATE TABLE public.cloud_compute_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_id UUID REFERENCES public.cloud_compute_analyses(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  original_position TEXT NOT NULL,
  corrected_position TEXT NOT NULL,
  correction_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cloud_compute_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cloud compute learnings" ON public.cloud_compute_learnings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cloud compute learnings" ON public.cloud_compute_learnings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cloud compute learnings" ON public.cloud_compute_learnings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cloud compute learnings" ON public.cloud_compute_learnings FOR DELETE USING (auth.uid() = user_id);
