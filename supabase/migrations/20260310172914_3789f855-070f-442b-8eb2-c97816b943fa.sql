
CREATE TABLE public.unallocated_lc_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
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

ALTER TABLE public.unallocated_lc_disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own unallocated LC disbursements"
  ON public.unallocated_lc_disbursements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own unallocated LC disbursements"
  ON public.unallocated_lc_disbursements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own unallocated LC disbursements"
  ON public.unallocated_lc_disbursements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own unallocated LC disbursements"
  ON public.unallocated_lc_disbursements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
