-- Add 'to_all' to the email_delivery_mode enum
ALTER TYPE email_delivery_mode ADD VALUE IF NOT EXISTS 'to_all';