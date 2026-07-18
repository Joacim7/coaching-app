-- Add is_complete flag so coaches can explicitly mark feedback as done.
-- Powers the "Ferdig" status column in the weekly overview page.

ALTER TABLE public.checkin_feedback
  ADD COLUMN IF NOT EXISTS is_complete BOOLEAN NOT NULL DEFAULT FALSE;
