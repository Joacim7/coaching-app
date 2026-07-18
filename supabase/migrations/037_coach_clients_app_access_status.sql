ALTER TABLE public.coach_clients
  DROP CONSTRAINT IF EXISTS coach_clients_status_check;

ALTER TABLE public.coach_clients
  ADD CONSTRAINT coach_clients_status_check
  CHECK (status IN ('active', 'inactive', 'new', 'onboarding', 'course', 'followup', 'app_access'));
