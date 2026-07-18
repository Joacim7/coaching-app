ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS menstruation boolean;
