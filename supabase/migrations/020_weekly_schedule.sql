-- Add weekly schedule settings to check-in templates
-- schedule_days: array of ISO weekday numbers 0=Mon … 6=Sun
-- schedule_time: local time of day the check-in should be sent (e.g. 08:00)

ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS schedule_days INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS schedule_time TIME;
