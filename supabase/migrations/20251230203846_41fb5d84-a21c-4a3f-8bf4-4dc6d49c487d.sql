-- Add 'Pre-Start' to the matter_stage enum
ALTER TYPE matter_stage ADD VALUE IF NOT EXISTS 'Pre-Start' BEFORE 'Term Sheet';