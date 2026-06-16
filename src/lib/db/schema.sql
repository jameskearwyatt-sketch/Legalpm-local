-- =============================================================================
-- Legal Practice Manager — Complete DDL (non-analyst tables)
-- Generated from supabase/migrations/ (consolidated final state)
--
-- Stripped: RLS policies, auth.users FK references, SECURITY INVOKER/DEFINER
-- Compatible with PGlite (standard PostgreSQL)
-- =============================================================================

-- Functions below (e.g. has_role) are defined before the tables they reference.
-- Disable function-body validation so these forward references don't fail when
-- the schema is applied top-to-bottom.
SET check_function_bodies = false;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE public.matter_status AS ENUM ('Open', 'On Hold', 'Closed');
CREATE TYPE public.budget_type AS ENUM ('Fixed', 'Cap', 'Estimate', 'Retainer', 'Hourly');
CREATE TYPE public.invoice_status AS ENUM ('Draft', 'Sent', 'Part Paid', 'Paid', 'Overdue');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TYPE public.matter_category AS ENUM ('Live', 'Pipeline', 'Closed', 'Lost');
CREATE TYPE public.matter_stage AS ENUM (
  'Pre-Start', 'Term Sheet', 'Documentation - Start', 'Documentation - Close',
  'Closing Process', 'Paused', 'Closed', 'Won', 'Lost', 'Pending'
);
CREATE TYPE public.fee_type AS ENUM (
  'Discounted Rates with Cap', 'Discounted Rates with Estimate',
  'Discounted Rates with Partial Cap', 'Rack Rates with Cap', 'Rack Rates with Estimate'
);
CREATE TYPE public.matter_source AS ENUM ('RfP', 'Direct from Client', 'Internal Referral');
CREATE TYPE public.pipeline_outcome AS ENUM ('Won', 'Lost', 'Pending');

CREATE TYPE public.growth_project_type AS ENUM (
  'business_development', 'professional_development', 'learning_development'
);
CREATE TYPE public.task_deadline_type AS ENUM (
  'this_week', 'next_week', 'this_month', 'next_month',
  'in_3_months', 'in_6_months', 'no_deadline'
);

CREATE TYPE public.task_importance AS ENUM ('important', 'not_important', 'unset');
CREATE TYPE public.task_urgency AS ENUM ('urgent', 'not_urgent', 'unset');
CREATE TYPE public.task_effort AS ENUM ('quick_win', 'deep_work', 'unset');

CREATE TYPE public.contact_gender AS ENUM ('male', 'female', 'unknown');
CREATE TYPE public.email_draft_type AS ENUM ('event_invitation', 'article_sharing', 'firm_update');
CREATE TYPE public.email_delivery_mode AS ENUM ('bcc_all', 'individual', 'to_all');

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Generic updated_at trigger function (used by most tables)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Role checking function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Financial snapshot history archival trigger function
CREATE OR REPLACE FUNCTION public.archive_financial_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.financial_snapshot_history (
    snapshot_id, matter_id, user_id, as_of_date,
    wip_amount, billed_amount, paid_amount, accounts_receivable,
    wip_write_off_amount, notes, update_source, operation
  ) VALUES (
    OLD.id, OLD.matter_id, OLD.user_id, OLD.as_of_date,
    OLD.wip_amount, OLD.billed_amount, OLD.paid_amount, OLD.accounts_receivable,
    OLD.wip_write_off_amount, OLD.notes, OLD.update_source, TG_OP
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Write-off event updated_at trigger function
CREATE OR REPLACE FUNCTION public.touch_write_off_event_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Auto-record write-off events from snapshot changes
CREATE OR REPLACE FUNCTION public.record_write_off_event_from_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  prior_writeoff numeric := 0;
  delta numeric := 0;
  matter_currency text;
  matter_exchange numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(wip_write_off_amount, 0)
      INTO prior_writeoff
      FROM public.financial_snapshots
      WHERE matter_id = NEW.matter_id
        AND as_of_date < NEW.as_of_date
        AND id <> NEW.id
      ORDER BY as_of_date DESC
      LIMIT 1;
    delta := COALESCE(NEW.wip_write_off_amount, 0) - COALESCE(prior_writeoff, 0);
  ELSIF TG_OP = 'UPDATE' THEN
    delta := COALESCE(NEW.wip_write_off_amount, 0) - COALESCE(OLD.wip_write_off_amount, 0);
  ELSE
    RETURN NEW;
  END IF;

  IF delta > 0 THEN
    SELECT fee_currency, COALESCE(exchange_rate, 1)
      INTO matter_currency, matter_exchange
      FROM public.matters WHERE id = NEW.matter_id;

    INSERT INTO public.write_off_events (
      matter_id, user_id, write_off_amount, fee_currency,
      exchange_rate, write_off_date, source_snapshot_id, description
    ) VALUES (
      NEW.matter_id, NEW.user_id, delta,
      COALESCE(matter_currency, 'GBP'), COALESCE(matter_exchange, 1),
      NEW.as_of_date, NEW.id,
      'Auto-recorded from snapshot ' || TG_OP
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Slate items updated_at trigger function (separate from generic one)
CREATE OR REPLACE FUNCTION public.update_slate_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- =============================================================================
-- SECTION: AUTH & USER MANAGEMENT
-- =============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,  -- maps to auth user id
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  default_currency TEXT NOT NULL DEFAULT 'GBP',
  near_budget_threshold INTEGER NOT NULL DEFAULT 80,
  poor_collection_threshold INTEGER NOT NULL DEFAULT 60,
  wip_warning_threshold DECIMAL(15,2) NOT NULL DEFAULT 50000,
  use_billed_only_for_burn BOOLEAN NOT NULL DEFAULT false,
  default_rate_card JSONB DEFAULT NULL,
  email_signature TEXT,
  ppa_precedent_threshold INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  transports TEXT[] DEFAULT '{}',
  authenticator_attachment TEXT,
  device_name TEXT,
  backup_eligible BOOLEAN DEFAULT false,
  backup_state BOOLEAN DEFAULT false,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_passkeys_user_id ON public.passkeys(user_id);
CREATE INDEX idx_passkeys_credential_id ON public.passkeys(credential_id);


-- =============================================================================
-- SECTION: CLIENTS
-- =============================================================================

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  group_sector TEXT,
  billing_contact TEXT,
  display_name TEXT DEFAULT NULL,
  billing_contacts JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION: MATTERS
-- =============================================================================

CREATE TABLE public.matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  matter_name TEXT NOT NULL,
  matter_number TEXT NOT NULL,
  practice_area TEXT,
  status public.matter_status NOT NULL DEFAULT 'Open',
  lead_partner TEXT,
  start_date DATE,
  target_close_date DATE,
  currency TEXT NOT NULL DEFAULT 'GBP',
  budget_type public.budget_type NOT NULL DEFAULT 'Fixed',
  agreed_budget_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  budget_notes TEXT,
  fee_earner_mix_notes TEXT,
  billing_terms TEXT,
  -- Onboarding/compliance
  aml_kyc_complete BOOLEAN NOT NULL DEFAULT false,
  assignment_letter_signed BOOLEAN NOT NULL DEFAULT false,
  matter_open BOOLEAN NOT NULL DEFAULT false,
  -- Pipeline / category fields
  category public.matter_category NOT NULL DEFAULT 'Live',
  current_stage public.matter_stage,
  fee_amount_upper_end NUMERIC NOT NULL DEFAULT 0,
  local_counsel_fee NUMERIC NOT NULL DEFAULT 0,
  bm_fee_component NUMERIC NOT NULL DEFAULT 0,
  exchange_rate NUMERIC NOT NULL DEFAULT 1.0,
  fee_currency TEXT NOT NULL DEFAULT 'GBP',
  fee_type public.fee_type,
  source public.matter_source,
  originator TEXT,
  deal_currency TEXT,
  deal_value NUMERIC,
  cm_number TEXT,
  conflicts_check BOOLEAN NOT NULL DEFAULT false,
  opportunity_receipt_date DATE,
  clarifications_date DATE,
  submission_deadline DATE,
  submitted BOOLEAN NOT NULL DEFAULT false,
  decision_date DATE,
  pipeline_outcome public.pipeline_outcome,
  -- Multi-client
  is_multi_client BOOLEAN NOT NULL DEFAULT false,
  -- Local counsel billing
  local_counsel_billing TEXT DEFAULT NULL,
  -- Billing currency
  different_billing_currency BOOLEAN NOT NULL DEFAULT false,
  quote_currency TEXT,
  billing_currency TEXT,
  agreed_billing_amount NUMERIC NOT NULL DEFAULT 0,
  -- Attorney / management
  matter_managing_attorney TEXT,
  matter_display_name TEXT,
  -- LC financials
  lc_wip NUMERIC NOT NULL DEFAULT 0,
  lc_billed NUMERIC NOT NULL DEFAULT 0,
  lc_last_updated DATE,
  -- Time costs
  pay_full_time_costs BOOLEAN NOT NULL DEFAULT false,
  -- WIP shaping
  show_shaping_proposal BOOLEAN NOT NULL DEFAULT false,
  -- Jurisdictions
  jurisdictions TEXT[] DEFAULT ARRAY[]::text[],
  -- Progress
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  -- On hold
  on_hold_months NUMERIC NOT NULL DEFAULT 0,
  -- Manual budget override
  use_manual_budget BOOLEAN NOT NULL DEFAULT false,
  manual_budget_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  -- Rate / pricing model
  rate_modifier TEXT,
  rate_modifier_value NUMERIC,
  pricing_model TEXT,
  rate_modifier_scope TEXT,
  -- Audit
  created_by UUID,
  updated_by UUID,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matters_client_id ON public.matters(client_id);
CREATE INDEX idx_matters_status ON public.matters(status);
CREATE INDEX idx_matters_user_id ON public.matters(user_id);

-- Multi-client junction
CREATE TABLE public.matter_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cm_number TEXT,
  is_master BOOLEAN NOT NULL DEFAULT false,
  fee_percentage NUMERIC NOT NULL DEFAULT 0 CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (matter_id, client_id)
);

-- Assumptions from engagement letters
CREATE TABLE public.matter_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  assumption_text TEXT NOT NULL,
  source_document TEXT,
  is_standard BOOLEAN NOT NULL DEFAULT false,
  is_exceeded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matter_assumptions_matter_id ON public.matter_assumptions(matter_id);
CREATE INDEX idx_matter_assumptions_is_standard ON public.matter_assumptions(is_standard) WHERE is_standard = true;


-- =============================================================================
-- SECTION: LOCAL COUNSEL
-- =============================================================================

-- Per-matter local counsel tracking
CREATE TABLE public.matter_local_counsels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  firm_name TEXT NOT NULL,
  allocated_budget NUMERIC NOT NULL DEFAULT 0,
  wip_amount NUMERIC NOT NULL DEFAULT 0,
  billed_amount NUMERIC NOT NULL DEFAULT 0,
  last_updated DATE,
  billing_mode TEXT DEFAULT NULL,
  update_source TEXT DEFAULT NULL,
  wip_updated_at TIMESTAMPTZ DEFAULT NULL,
  billed_updated_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(matter_id, firm_name)
);

-- Global library of LC firms
CREATE TABLE public.local_counsel_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  firm_name TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  rate_card JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, firm_name, country)
);

-- Unallocated LC disbursements from imports
CREATE TABLE public.unallocated_lc_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  wip_amount NUMERIC DEFAULT 0,
  ar_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'master_update',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  allocated_at TIMESTAMPTZ
);

-- LC disbursement allocation records
CREATE TABLE public.lc_disbursement_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  import_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  disbursement_type TEXT NOT NULL,
  original_amount NUMERIC NOT NULL DEFAULT 0,
  allocated_to_lc BOOLEAN NOT NULL DEFAULT false,
  allocations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION: BUDGETS
-- =============================================================================

CREATE TABLE public.budget_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  bm_total NUMERIC NOT NULL DEFAULT 0,
  local_counsel_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_versions_matter_id ON public.budget_versions(matter_id);

CREATE TABLE public.budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_version_id UUID NOT NULL REFERENCES public.budget_versions(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL,
  user_id UUID NOT NULL,
  work_item TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('Baker McKenzie', 'Local Counsel')),
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  lc_firm_name TEXT,
  lc_country TEXT,
  lc_currency TEXT,
  lc_library_id UUID,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  is_included BOOLEAN NOT NULL DEFAULT true,
  is_capped BOOLEAN NOT NULL DEFAULT false,
  is_additional_scope BOOLEAN NOT NULL DEFAULT false,
  detail TEXT DEFAULT NULL,
  wip_amount NUMERIC NOT NULL DEFAULT 0,
  wip_updated_at TIMESTAMPTZ,
  wip_write_off NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_line_items_budget_version_id ON public.budget_line_items(budget_version_id);
CREATE INDEX idx_budget_line_items_matter_id ON public.budget_line_items(matter_id);
CREATE INDEX idx_budget_line_items_category ON public.budget_line_items(category);

CREATE TABLE public.budget_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amendment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_budget NUMERIC NOT NULL DEFAULT 0,
  new_budget NUMERIC NOT NULL DEFAULT 0,
  previous_bm_fee NUMERIC NOT NULL DEFAULT 0,
  new_bm_fee NUMERIC NOT NULL DEFAULT 0,
  previous_local_counsel NUMERIC NOT NULL DEFAULT 0,
  new_local_counsel NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_amendments_matter_id ON public.budget_amendments(matter_id);

CREATE TABLE public.budget_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Draft Budget',
  notes TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  bm_total NUMERIC NOT NULL DEFAULT 0,
  local_counsel_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION: FINANCIAL SNAPSHOTS & HISTORY
-- =============================================================================

CREATE TABLE public.financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  as_of_date DATE NOT NULL,
  wip_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  billed_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  accounts_receivable NUMERIC NOT NULL DEFAULT 0,
  wip_write_off_amount NUMERIC NOT NULL DEFAULT 0,
  update_source TEXT DEFAULT NULL,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_snapshots_matter_id ON public.financial_snapshots(matter_id);
CREATE INDEX idx_financial_snapshots_as_of_date ON public.financial_snapshots(as_of_date DESC);
CREATE UNIQUE INDEX idx_financial_snapshots_matter_date_unique ON public.financial_snapshots(matter_id, as_of_date);

CREATE TABLE public.financial_snapshot_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  as_of_date DATE NOT NULL,
  wip_amount NUMERIC NOT NULL DEFAULT 0,
  billed_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  accounts_receivable NUMERIC NOT NULL DEFAULT 0,
  wip_write_off_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  update_source TEXT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  operation TEXT NOT NULL  -- 'UPDATE', 'DELETE', 'INITIAL'
);


-- =============================================================================
-- SECTION: INVOICES & PAYMENTS
-- =============================================================================

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  billed_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  due_date DATE,
  status public.invoice_status NOT NULL DEFAULT 'Draft',
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_date DATE,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_matter_id ON public.invoices(matter_id);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  reference TEXT,
  allocated_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_matter_id ON public.payments(matter_id);

CREATE TABLE public.matter_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matter_bills_matter_id ON public.matter_bills(matter_id);


-- =============================================================================
-- SECTION: WIP UPDATES & TRACKING
-- =============================================================================

CREATE TABLE public.detailed_wip_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  total_wip_amount NUMERIC NOT NULL DEFAULT 0,
  total_write_off_amount NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_detailed_wip_updates_matter_id ON public.detailed_wip_updates(matter_id);

CREATE TABLE public.detailed_wip_update_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wip_update_id UUID NOT NULL REFERENCES public.detailed_wip_updates(id) ON DELETE CASCADE,
  budget_line_item_id UUID NOT NULL,
  work_item TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT,
  lc_firm_name TEXT,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  wip_amount NUMERIC NOT NULL DEFAULT 0,
  write_off_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_detailed_wip_update_items_wip_update_id ON public.detailed_wip_update_items(wip_update_id);

-- Snapshot changes made by master WIP updates (for revert functionality)
CREATE TABLE public.master_wip_snapshot_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wip_update_id UUID NOT NULL REFERENCES public.detailed_wip_updates(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES public.financial_snapshots(id) ON DELETE SET NULL,
  was_new_snapshot BOOLEAN NOT NULL DEFAULT false,
  before_wip_amount NUMERIC DEFAULT 0,
  before_billed_amount NUMERIC DEFAULT 0,
  before_paid_amount NUMERIC DEFAULT 0,
  before_accounts_receivable NUMERIC DEFAULT 0,
  before_wip_write_off_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_master_wip_snapshot_changes_wip_update_id ON public.master_wip_snapshot_changes(wip_update_id);
CREATE INDEX idx_master_wip_snapshot_changes_matter_id ON public.master_wip_snapshot_changes(matter_id);

-- LC changes made by master WIP updates (for revert functionality)
CREATE TABLE public.master_lc_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wip_update_id UUID NOT NULL REFERENCES public.detailed_wip_updates(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  local_counsel_id UUID NOT NULL REFERENCES public.matter_local_counsels(id) ON DELETE CASCADE,
  before_wip_amount NUMERIC DEFAULT 0,
  before_billed_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_master_lc_changes_wip_update_id ON public.master_lc_changes(wip_update_id);
CREATE INDEX idx_master_lc_changes_local_counsel_id ON public.master_lc_changes(local_counsel_id);

-- Report format configs for WIP import
CREATE TABLE public.user_report_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  format_name TEXT NOT NULL,
  column_mappings JSONB NOT NULL DEFAULT '{}',
  header_signature TEXT,
  sample_headers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matter mapping for report matching
CREATE TABLE public.report_matter_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  imported_matter_number TEXT,
  imported_matter_name TEXT,
  imported_client_name TEXT,
  mapped_matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, imported_matter_number, imported_matter_name)
);

-- Aggregation decisions for multi-CM matters
CREATE TABLE public.aggregation_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  matter_name TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('aggregate', 'separate')),
  target_matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, matter_name)
);


-- =============================================================================
-- SECTION: WIP SHAPING PROPOSALS
-- =============================================================================

CREATE TABLE public.wip_shaping_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  proposal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL,
  -- Financial fields
  wip_amount NUMERIC NOT NULL DEFAULT 0,
  wip_write_off_amount NUMERIC NOT NULL DEFAULT 0,
  billed_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  accounts_receivable NUMERIC NOT NULL DEFAULT 0,
  ar_write_off_amount NUMERIC NOT NULL DEFAULT 0,
  -- LC fields
  lc_wip_amount NUMERIC NOT NULL DEFAULT 0,
  lc_billed_amount NUMERIC NOT NULL DEFAULT 0,
  -- Write-off mode
  write_off_mode TEXT NOT NULL DEFAULT 'fixed_writeoff',
  wip_target_amount NUMERIC DEFAULT 0,
  -- Status
  status TEXT NOT NULL DEFAULT 'active',
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_write_off_mode CHECK (write_off_mode IN ('fixed_writeoff', 'fixed_target'))
);

CREATE INDEX idx_wip_shaping_proposals_matter_id ON public.wip_shaping_proposals(matter_id);
CREATE INDEX idx_wip_shaping_proposals_selected ON public.wip_shaping_proposals(matter_id, is_selected) WHERE is_selected = true;

CREATE TABLE public.wip_proposal_local_counsels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.wip_shaping_proposals(id) ON DELETE CASCADE,
  local_counsel_id UUID NOT NULL REFERENCES public.matter_local_counsels(id) ON DELETE CASCADE,
  firm_name TEXT NOT NULL,
  raw_wip_amount NUMERIC NOT NULL DEFAULT 0,
  raw_billed_amount NUMERIC NOT NULL DEFAULT 0,
  proposed_wip_amount NUMERIC NOT NULL DEFAULT 0,
  proposed_billed_amount NUMERIC NOT NULL DEFAULT 0,
  wip_write_off_amount NUMERIC NOT NULL DEFAULT 0,
  billed_write_off_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, local_counsel_id)
);


-- =============================================================================
-- SECTION: WIP EMAIL NOTIFICATIONS
-- =============================================================================

CREATE TABLE public.wip_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.wip_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  recipient_names TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  welcome_template_id UUID REFERENCES public.wip_email_templates(id) ON DELETE SET NULL,
  was_sent BOOLEAN NOT NULL DEFAULT false,
  sent_date DATE,
  sent_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION: PRICING PROPOSALS
-- =============================================================================

CREATE TABLE public.pricing_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Agreed')),
  current_version INTEGER NOT NULL DEFAULT 1,
  rate_card JSONB DEFAULT '{"partner": {"cost": 425, "rate": 1300}, "trainee": {"cost": 100, "rate": 400}, "associate": {"cost": 180, "rate": 650}, "seniorAssociate": {"cost": 260, "rate": 1000}}'::jsonb,
  work_phases JSONB DEFAULT '[]'::jsonb,
  assumptions JSONB DEFAULT '{"negotiatedDocsDecay": 0.5, "ddDecay": 0.35, "numMeetings": 0, "meetingHoursPartner": 3, "meetingHoursAssociate": 2, "numNegotiationTurns": 3, "afaDiscount": 0}'::jsonb,
  scope_assumptions JSONB DEFAULT NULL,
  team_rate_currency TEXT DEFAULT NULL,
  locked_categories JSONB DEFAULT '[]'::jsonb,
  linked_matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_proposals_linked_matter ON public.pricing_proposals(linked_matter_id);

CREATE TABLE public.pricing_proposal_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.pricing_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  bm_total NUMERIC NOT NULL DEFAULT 0,
  local_counsel_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pricing_proposal_versions_unique_version
  ON public.pricing_proposal_versions(proposal_id, version_number);

CREATE TABLE public.pricing_proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.pricing_proposal_versions(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES public.pricing_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  work_item TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'Baker McKenzie',
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  fee_lower NUMERIC NOT NULL DEFAULT 0,
  fee_upper NUMERIC NOT NULL DEFAULT 0,
  pricing_method TEXT NOT NULL DEFAULT 'manual' CHECK (pricing_method IN ('ai_suggested', 'pricing_tool', 'manual')),
  category TEXT,
  lc_firm_name TEXT,
  lc_country TEXT DEFAULT NULL,
  lc_currency TEXT DEFAULT NULL,
  lc_library_id UUID DEFAULT NULL,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  is_included BOOLEAN NOT NULL DEFAULT true,
  is_pc_sum BOOLEAN NOT NULL DEFAULT false,
  is_multiplied BOOLEAN NOT NULL DEFAULT false,
  multiplier_qty INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_rationale TEXT,
  partner_hours NUMERIC NOT NULL DEFAULT 0,
  associate_hours NUMERIC NOT NULL DEFAULT 0,
  num_turns INTEGER NOT NULL DEFAULT 1,
  item_type TEXT NOT NULL DEFAULT 'documentation',
  phase_id TEXT DEFAULT NULL,
  detail TEXT,
  internal_input_dept TEXT DEFAULT NULL,
  assumption_linked BOOLEAN NOT NULL DEFAULT false,
  assumption_text TEXT,
  alt_fee_lower NUMERIC NOT NULL DEFAULT 0,
  alt_fee_upper NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pricing_proposal_afas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.pricing_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  afa_type TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  client_price NUMERIC DEFAULT 0,
  effective_rate NUMERIC DEFAULT 0,
  margin_impact_percent NUMERIC DEFAULT 0,
  client_narrative TEXT,
  is_selected_for_export BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_proposal_afas_proposal_id ON public.pricing_proposal_afas(proposal_id);

-- LC quotes per work item per firm
CREATE TABLE public.lc_work_item_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  proposal_id UUID NOT NULL REFERENCES public.pricing_proposals(id) ON DELETE CASCADE,
  lc_library_id UUID NOT NULL REFERENCES public.local_counsel_library(id) ON DELETE CASCADE,
  work_item_key TEXT NOT NULL,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  fee_lower NUMERIC NOT NULL DEFAULT 0,
  fee_upper NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, lc_library_id, work_item_key)
);


-- =============================================================================
-- SECTION: TIME RECORDING
-- =============================================================================

CREATE TABLE public.time_recording_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('single', 'multi')),
  single_date DATE,
  date_range_from DATE,
  date_range_to DATE,
  selected_dates JSONB DEFAULT '[]'::jsonb,
  grid_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  processed_output JSONB,
  is_polished BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION: GROWTH / BD PROJECTS
-- =============================================================================

CREATE TABLE public.growth_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_type public.growth_project_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  ai_summary TEXT,
  mentee_name TEXT,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.growth_project_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.growth_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'note',
  title TEXT,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.growth_project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.growth_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  ai_summary TEXT,
  summary_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.growth_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.growth_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT,
  deadline_type public.task_deadline_type NOT NULL DEFAULT 'no_deadline',
  deadline_set_at TIMESTAMPTZ,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Triage
  importance public.task_importance NOT NULL DEFAULT 'unset',
  urgency public.task_urgency NOT NULL DEFAULT 'unset',
  effort public.task_effort NOT NULL DEFAULT 'unset',
  pinned_to_tasklist BOOLEAN NOT NULL DEFAULT false,
  -- Slate
  on_slate BOOLEAN NOT NULL DEFAULT false,
  slate_sort_order INTEGER NOT NULL DEFAULT 0,
  must_do_today BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_growth_tasks_triage ON public.growth_tasks(user_id, is_completed, urgency, importance, effort);

CREATE TABLE public.known_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);


-- =============================================================================
-- SECTION: TASKS & SLATE
-- =============================================================================

CREATE TABLE public.quick_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  -- Triage
  importance public.task_importance NOT NULL DEFAULT 'unset',
  urgency public.task_urgency NOT NULL DEFAULT 'unset',
  effort public.task_effort NOT NULL DEFAULT 'unset',
  -- Slate
  on_slate BOOLEAN NOT NULL DEFAULT false,
  slate_sort_order INTEGER NOT NULL DEFAULT 0,
  must_do_today BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quick_tasks_triage ON public.quick_tasks(user_id, is_completed, urgency, importance, effort);

CREATE TABLE public.slate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  is_personal BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  must_do_today BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION: DISTRIBUTION CONTACTS (CRM)
-- =============================================================================

CREATE TABLE public.distribution_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE TABLE public.distribution_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  job_title TEXT,
  country TEXT,
  city TEXT,
  gender public.contact_gender NOT NULL DEFAULT 'unknown',
  sectors TEXT[] NOT NULL DEFAULT '{}',
  sectors_ai_assigned BOOLEAN NOT NULL DEFAULT false,
  linkedin_url TEXT,
  notes TEXT,
  relationship_owner TEXT,
  do_not_contact BOOLEAN NOT NULL DEFAULT false,
  provenance TEXT,
  email_status TEXT,
  sic_codes TEXT[] DEFAULT '{}',
  naics_codes TEXT[] DEFAULT '{}',
  company_keywords TEXT[] DEFAULT '{}',
  -- EMI focus areas
  emi_focus_areas TEXT[] NOT NULL DEFAULT '{}',
  emi_focus_areas_assigned_at TIMESTAMPTZ,
  emi_focus_areas_manual_edit BOOLEAN NOT NULL DEFAULT false,
  -- Email mismatch tracking
  email_company_mismatch BOOLEAN NOT NULL DEFAULT false,
  email_mismatch_dismissed BOOLEAN NOT NULL DEFAULT false,
  -- AI classification
  is_law_firm BOOLEAN DEFAULT NULL,
  is_consultant BOOLEAN DEFAULT NULL,
  classification_reason TEXT DEFAULT NULL,
  classified_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

CREATE INDEX idx_distribution_contacts_updated_at ON public.distribution_contacts(updated_at DESC);
CREATE INDEX idx_distribution_contacts_is_law_firm ON public.distribution_contacts(is_law_firm) WHERE is_law_firm IS NOT NULL;
CREATE INDEX idx_distribution_contacts_is_consultant ON public.distribution_contacts(is_consultant) WHERE is_consultant IS NOT NULL;

CREATE TABLE public.distribution_contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.distribution_contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_source TEXT NOT NULL DEFAULT 'manual',
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT
);

CREATE INDEX idx_contact_history_contact_id ON public.distribution_contact_history(contact_id);
CREATE INDEX idx_contact_history_changed_at ON public.distribution_contact_history(changed_at DESC);

CREATE TABLE public.distribution_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  saved_filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.distribution_email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.distribution_campaigns(id) ON DELETE SET NULL,
  draft_type public.email_draft_type NOT NULL,
  delivery_mode public.email_delivery_mode NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  was_sent BOOLEAN NOT NULL DEFAULT false,
  sent_date DATE,
  sent_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.distribution_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.distribution_relationship_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE TABLE public.contact_import_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  format_name TEXT NOT NULL,
  column_mappings JSONB NOT NULL DEFAULT '{}',
  header_signature TEXT,
  sample_headers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, header_signature)
);

CREATE TABLE public.custom_distribution_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_distribution_lists_user_id ON public.custom_distribution_lists(user_id);

CREATE TABLE public.custom_list_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.custom_distribution_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.distribution_contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(list_id, contact_id)
);

CREATE INDEX idx_custom_list_contacts_list_id ON public.custom_list_contacts(list_id);
CREATE INDEX idx_custom_list_contacts_contact_id ON public.custom_list_contacts(contact_id);
CREATE INDEX idx_custom_list_contacts_user_id ON public.custom_list_contacts(user_id);


-- =============================================================================
-- SECTION: BM INTERNAL CONTACTS
-- =============================================================================

CREATE TABLE public.bm_internal_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  surname TEXT NOT NULL,
  title TEXT,
  region TEXT,
  office TEXT,
  practice_group TEXT,
  email TEXT,
  expertise JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bm_internal_contacts_region ON public.bm_internal_contacts(region);
CREATE INDEX idx_bm_internal_contacts_office ON public.bm_internal_contacts(office);
CREATE INDEX idx_bm_internal_contacts_expertise ON public.bm_internal_contacts USING GIN(expertise);

CREATE TABLE public.bm_contact_shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bm_shortlist_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  shortlist_id UUID NOT NULL REFERENCES public.bm_contact_shortlists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.bm_internal_contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shortlist_id, contact_id)
);

CREATE INDEX idx_bm_shortlist_members_shortlist ON public.bm_shortlist_members(shortlist_id);
CREATE INDEX idx_bm_shortlist_members_contact ON public.bm_shortlist_members(contact_id);


-- =============================================================================
-- SECTION: WRITE-OFF EVENTS
-- =============================================================================

CREATE TABLE public.write_off_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  write_off_amount NUMERIC NOT NULL CHECK (write_off_amount > 0),
  fee_currency TEXT NOT NULL DEFAULT 'GBP',
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  write_off_date DATE NOT NULL,
  source_snapshot_id UUID REFERENCES public.financial_snapshots(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_write_off_events_matter_date ON public.write_off_events(matter_id, write_off_date DESC);
CREATE INDEX idx_write_off_events_user_date ON public.write_off_events(user_id, write_off_date DESC);
CREATE INDEX idx_write_off_events_source_snapshot ON public.write_off_events(source_snapshot_id) WHERE source_snapshot_id IS NOT NULL;


-- =============================================================================
-- SECTION: NOTIFICATIONS & SAVED REPORTS
-- =============================================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL,
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE,
  matter_name TEXT,
  matter_number TEXT,
  client_name TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC) WHERE NOT is_read;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_dedup ON public.notifications(user_id, alert_type, matter_id);

CREATE TABLE public.saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION: DEAL CREDENTIALS
-- =============================================================================

CREATE TABLE public.deal_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  deal_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_public_name TEXT,
  description TEXT,
  deal_type TEXT,
  practice_areas TEXT[],
  sector TEXT,
  jurisdictions TEXT[],
  deal_value NUMERIC(15,2),
  deal_currency TEXT DEFAULT 'USD',
  role_played TEXT,
  lead_partner TEXT,
  has_institutional_involvement BOOLEAN DEFAULT false,
  institutions TEXT[],
  start_date DATE,
  completion_date DATE,
  year_completed INTEGER,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Ongoing')),
  is_auto_generated BOOLEAN DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_credentials_user ON public.deal_credentials(user_id);
CREATE INDEX idx_credentials_matter ON public.deal_credentials(matter_id) WHERE matter_id IS NOT NULL;
CREATE INDEX idx_credentials_deal_type ON public.deal_credentials(deal_type);
CREATE INDEX idx_credentials_year ON public.deal_credentials(year_completed);
CREATE INDEX gin_credentials_jurisdictions ON public.deal_credentials USING GIN(jurisdictions);
CREATE INDEX gin_credentials_practice_areas ON public.deal_credentials USING GIN(practice_areas);
CREATE INDEX gin_credentials_institutions ON public.deal_credentials USING GIN(institutions);


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auth & profiles
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_passkeys_updated_at BEFORE UPDATE ON public.passkeys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Clients & matters
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_matters_updated_at BEFORE UPDATE ON public.matters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_matter_clients_updated_at BEFORE UPDATE ON public.matter_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_matter_assumptions_updated_at BEFORE UPDATE ON public.matter_assumptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_matter_local_counsels_updated_at BEFORE UPDATE ON public.matter_local_counsels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_local_counsel_library_updated_at BEFORE UPDATE ON public.local_counsel_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Financials
CREATE TRIGGER update_financial_snapshots_updated_at BEFORE UPDATE ON public.financial_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER archive_snapshot_before_change BEFORE UPDATE OR DELETE ON public.financial_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.archive_financial_snapshot();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Budgets
CREATE TRIGGER update_budget_line_items_updated_at BEFORE UPDATE ON public.budget_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budget_drafts_updated_at BEFORE UPDATE ON public.budget_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WIP
CREATE TRIGGER update_user_report_formats_updated_at BEFORE UPDATE ON public.user_report_formats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_report_matter_mappings_updated_at BEFORE UPDATE ON public.report_matter_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aggregation_decisions_updated_at BEFORE UPDATE ON public.aggregation_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WIP shaping
CREATE TRIGGER update_wip_shaping_proposals_updated_at BEFORE UPDATE ON public.wip_shaping_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wip_proposal_local_counsels_updated_at BEFORE UPDATE ON public.wip_proposal_local_counsels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WIP email
CREATE TRIGGER update_wip_email_templates_updated_at BEFORE UPDATE ON public.wip_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pricing
CREATE TRIGGER update_pricing_proposals_updated_at BEFORE UPDATE ON public.pricing_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_proposal_items_updated_at BEFORE UPDATE ON public.pricing_proposal_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_proposal_afas_updated_at BEFORE UPDATE ON public.pricing_proposal_afas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lc_work_item_quotes_updated_at BEFORE UPDATE ON public.lc_work_item_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Time recording
CREATE TRIGGER update_time_recording_drafts_updated_at BEFORE UPDATE ON public.time_recording_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Growth
CREATE TRIGGER update_growth_projects_updated_at BEFORE UPDATE ON public.growth_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_growth_project_entries_updated_at BEFORE UPDATE ON public.growth_project_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_growth_project_documents_updated_at BEFORE UPDATE ON public.growth_project_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_growth_tasks_updated_at BEFORE UPDATE ON public.growth_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Slate
CREATE TRIGGER update_slate_items_updated_at BEFORE UPDATE ON public.slate_items
  FOR EACH ROW EXECUTE FUNCTION public.update_slate_items_updated_at();

-- Distribution / CRM
CREATE TRIGGER update_distribution_contacts_updated_at BEFORE UPDATE ON public.distribution_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_distribution_campaigns_updated_at BEFORE UPDATE ON public.distribution_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_custom_distribution_lists_updated_at BEFORE UPDATE ON public.custom_distribution_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contact_import_formats_updated_at BEFORE UPDATE ON public.contact_import_formats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BM contacts
CREATE TRIGGER update_bm_internal_contacts_updated_at BEFORE UPDATE ON public.bm_internal_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bm_contact_shortlists_updated_at BEFORE UPDATE ON public.bm_contact_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Write-off events
CREATE TRIGGER trg_touch_write_off_event_updated_at BEFORE UPDATE ON public.write_off_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_write_off_event_updated_at();
CREATE TRIGGER trg_record_write_off_event AFTER INSERT OR UPDATE ON public.financial_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.record_write_off_event_from_snapshot();
