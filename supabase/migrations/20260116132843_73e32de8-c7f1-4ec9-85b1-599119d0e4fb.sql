-- Create a history table to preserve all financial snapshot changes
CREATE TABLE public.financial_snapshot_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  operation TEXT NOT NULL -- 'UPDATE' or 'DELETE'
);

-- Enable RLS
ALTER TABLE public.financial_snapshot_history ENABLE ROW LEVEL SECURITY;

-- RLS policy - users can only view their own history
CREATE POLICY "Users can view own snapshot history"
  ON public.financial_snapshot_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create trigger function to archive snapshots before update/delete
CREATE OR REPLACE FUNCTION public.archive_financial_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the OLD values into history
  INSERT INTO public.financial_snapshot_history (
    snapshot_id,
    matter_id,
    user_id,
    as_of_date,
    wip_amount,
    billed_amount,
    paid_amount,
    accounts_receivable,
    wip_write_off_amount,
    notes,
    update_source,
    operation
  ) VALUES (
    OLD.id,
    OLD.matter_id,
    OLD.user_id,
    OLD.as_of_date,
    OLD.wip_amount,
    OLD.billed_amount,
    OLD.paid_amount,
    OLD.accounts_receivable,
    OLD.wip_write_off_amount,
    OLD.notes,
    OLD.update_source,
    TG_OP
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on financial_snapshots
CREATE TRIGGER archive_snapshot_before_change
  BEFORE UPDATE OR DELETE ON public.financial_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_financial_snapshot();

-- Also archive existing snapshots as initial history
INSERT INTO public.financial_snapshot_history (
  snapshot_id, matter_id, user_id, as_of_date, wip_amount, billed_amount, 
  paid_amount, accounts_receivable, wip_write_off_amount, notes, update_source, operation
)
SELECT 
  id, matter_id, user_id, as_of_date, wip_amount, billed_amount,
  paid_amount, accounts_receivable, wip_write_off_amount, notes, update_source, 'INITIAL'
FROM public.financial_snapshots;