-- Track when a coach first opens/views a submitted check-in.
-- Powers the "Levert" → "Arbeid pågår" status transition in the weekly overview.

ALTER TABLE public.checkin_feedback
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
