-- Add column to financial_snapshots to track update source (manual vs bulk import)
ALTER TABLE public.financial_snapshots
ADD COLUMN IF NOT EXISTS update_source TEXT DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.financial_snapshots.update_source IS 'Source of this snapshot: manual (user entered via individual matter page) or bulk (from Excel import)';