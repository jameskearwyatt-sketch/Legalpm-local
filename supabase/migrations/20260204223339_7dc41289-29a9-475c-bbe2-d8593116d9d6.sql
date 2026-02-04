-- Add version tracking for draft comparisons
ALTER TABLE ppa_analyses 
ADD COLUMN IF NOT EXISTS parent_analysis_id UUID REFERENCES ppa_analyses(id),
ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_comparison BOOLEAN DEFAULT false;

-- Add index for finding related analyses
CREATE INDEX IF NOT EXISTS idx_ppa_analyses_parent ON ppa_analyses(parent_analysis_id);

-- Add previous_position to extracted positions for comparison tracking
ALTER TABLE ppa_extracted_positions
ADD COLUMN IF NOT EXISTS previous_position TEXT,
ADD COLUMN IF NOT EXISTS change_summary TEXT,
ADD COLUMN IF NOT EXISTS change_type TEXT CHECK (change_type IN ('unchanged', 'modified', 'added', 'removed'));