-- Settings table for app configuration (Slack, etc.)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS for settings (internal use only)
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;

-- Insert default Slack settings
INSERT INTO public.settings (key, value) VALUES
  ('slack_webhook_url', NULL),
  ('slack_notifications_enabled', 'false'),
  ('slack_daily_summary_enabled', 'false'),
  ('slack_daily_summary_time', '09:00')
ON CONFLICT (key) DO NOTHING;
