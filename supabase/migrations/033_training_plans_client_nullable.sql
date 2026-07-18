-- client_id must be nullable to support templates (client_id = null, is_template = true)
-- Migration 003 already declared this intent but may not have been applied
ALTER TABLE public.training_plans ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.meal_plans ALTER COLUMN client_id DROP NOT NULL;
