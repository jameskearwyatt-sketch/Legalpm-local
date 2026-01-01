-- Add fields for different billing currency scenario
ALTER TABLE public.matters
ADD COLUMN different_billing_currency boolean NOT NULL DEFAULT false,
ADD COLUMN quote_currency text,
ADD COLUMN billing_currency text,
ADD COLUMN agreed_billing_amount numeric NOT NULL DEFAULT 0;