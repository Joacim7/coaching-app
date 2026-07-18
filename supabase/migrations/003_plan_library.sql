-- Allow training plans and meal plans to exist without a client (library/template concept)
alter table public.training_plans alter column client_id drop not null;
alter table public.meal_plans alter column client_id drop not null;
