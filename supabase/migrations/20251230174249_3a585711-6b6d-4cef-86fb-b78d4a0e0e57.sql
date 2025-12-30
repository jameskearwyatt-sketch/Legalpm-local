-- Add new stage values to matter_stage enum
ALTER TYPE matter_stage ADD VALUE IF NOT EXISTS 'Closing Process';
ALTER TYPE matter_stage ADD VALUE IF NOT EXISTS 'Lost';