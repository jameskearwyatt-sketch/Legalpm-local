-- Notification persistence for proactive alerts.
--
-- Dashboard alert computation already runs client-side (useDashboard hook).
-- This table persists alerts so users can track read/unread state and snooze
-- individual alerts. Notifications are synced from the dashboard on each load
-- (idempotent upsert by alert_type + matter_id).

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  matter_id uuid REFERENCES public.matters(id) ON DELETE CASCADE,
  matter_name text,
  matter_number text,
  client_name text,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC)
  WHERE NOT is_read;

CREATE INDEX idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX idx_notifications_dedup
  ON public.notifications (user_id, alert_type, matter_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
