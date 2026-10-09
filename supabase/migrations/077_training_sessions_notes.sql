-- Per-session coach note, shown to the client alongside the session title.
-- training_plans.description already exists and serves the same purpose
-- at the whole-program level — this adds the missing per-session column.
alter table public.training_sessions
  add column if not exists notes text;
