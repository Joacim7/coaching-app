-- ── Auto-activate new clients once they have both a plan and a diet ──────────
--
-- When a client (status = 'new') gets an active training plan AND an active
-- meal plan assigned, flip their status to 'active' automatically — a coach
-- shouldn't have to remember to do this by hand once setup is done.
--
-- Only fires while status = 'new'; clients in other stages (onboarding,
-- followup, etc.) are left alone so this doesn't fight manual status changes.

CREATE OR REPLACE FUNCTION public.maybe_activate_new_client(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_client_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.training_plans WHERE client_id = p_client_id AND is_active = true)
     AND EXISTS (SELECT 1 FROM public.meal_plans WHERE client_id = p_client_id AND is_active = true)
  THEN
    UPDATE public.coach_clients
    SET status = 'active'
    WHERE client_id = p_client_id
      AND status = 'new';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_training_plan_activate_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.maybe_activate_new_client(NEW.client_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_meal_plan_activate_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.maybe_activate_new_client(NEW.client_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_plans_activate_client ON public.training_plans;
CREATE TRIGGER trg_training_plans_activate_client
AFTER INSERT OR UPDATE OF client_id, is_active ON public.training_plans
FOR EACH ROW
EXECUTE FUNCTION public.trg_training_plan_activate_client();

DROP TRIGGER IF EXISTS trg_meal_plans_activate_client ON public.meal_plans;
CREATE TRIGGER trg_meal_plans_activate_client
AFTER INSERT OR UPDATE OF client_id, is_active ON public.meal_plans
FOR EACH ROW
EXECUTE FUNCTION public.trg_meal_plan_activate_client();

-- ── Backfill: activate existing 'new' clients who already qualify ────────────
UPDATE public.coach_clients cc
SET status = 'active'
WHERE cc.status = 'new'
  AND EXISTS (SELECT 1 FROM public.training_plans tp WHERE tp.client_id = cc.client_id AND tp.is_active = true)
  AND EXISTS (SELECT 1 FROM public.meal_plans mp WHERE mp.client_id = cc.client_id AND mp.is_active = true);
