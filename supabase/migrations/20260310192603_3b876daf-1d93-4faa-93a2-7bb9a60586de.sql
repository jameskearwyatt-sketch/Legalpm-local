
CREATE TABLE public.aggregation_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  matter_name TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('aggregate', 'separate')),
  target_matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, matter_name)
);

ALTER TABLE public.aggregation_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own aggregation decisions"
  ON public.aggregation_decisions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_aggregation_decisions_updated_at
  BEFORE UPDATE ON public.aggregation_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
