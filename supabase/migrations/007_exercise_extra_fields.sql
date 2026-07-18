-- Add richer classification fields to exercises
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS category        TEXT,
  ADD COLUMN IF NOT EXISTS primary_muscles TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipment       TEXT[] NOT NULL DEFAULT '{}';
