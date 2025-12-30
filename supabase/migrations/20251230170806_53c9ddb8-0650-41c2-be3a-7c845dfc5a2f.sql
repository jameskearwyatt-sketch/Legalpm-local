-- Add matter category enum
CREATE TYPE public.matter_category AS ENUM ('Live', 'Pipeline', 'Closed', 'Lost');

-- Add current stage enum  
CREATE TYPE public.matter_stage AS ENUM ('Term Sheet', 'Documentation - Start', 'Documentation - Close', 'Paused', 'Closed', 'Won', 'Pending');

-- Add fee type enum
CREATE TYPE public.fee_type AS ENUM ('Discounted Rates with Cap', 'Discounted Rates with Estimate', 'Discounted Rates with Partial Cap', 'Rack Rates with Cap', 'Rack Rates with Estimate');

-- Add source enum
CREATE TYPE public.matter_source AS ENUM ('RfP', 'Direct from Client', 'Internal Referral');

-- Add pipeline outcome enum
CREATE TYPE public.pipeline_outcome AS ENUM ('Won', 'Lost', 'Pending');

-- Add new columns to matters table
ALTER TABLE public.matters
  ADD COLUMN category matter_category NOT NULL DEFAULT 'Live',
  ADD COLUMN current_stage matter_stage NULL,
  ADD COLUMN fee_amount_upper_end numeric NOT NULL DEFAULT 0,
  ADD COLUMN local_counsel_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN bm_fee_component numeric NOT NULL DEFAULT 0,
  ADD COLUMN exchange_rate numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN fee_currency text NOT NULL DEFAULT 'GBP',
  ADD COLUMN fee_type fee_type NULL,
  ADD COLUMN source matter_source NULL,
  ADD COLUMN originator text NULL,
  ADD COLUMN deal_currency text NULL,
  ADD COLUMN deal_value numeric NULL,
  ADD COLUMN cm_number text NULL,
  ADD COLUMN conflicts_check boolean NOT NULL DEFAULT false,
  ADD COLUMN opportunity_receipt_date date NULL,
  ADD COLUMN clarifications_date date NULL,
  ADD COLUMN submission_deadline date NULL,
  ADD COLUMN submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN decision_date date NULL,
  ADD COLUMN pipeline_outcome pipeline_outcome NULL;