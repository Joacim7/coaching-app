-- Allow exercises to have more than one category (e.g. both Styrke and Hypertrofi).

ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.exercises
  SET categories = ARRAY[category]
  WHERE category IS NOT NULL;

ALTER TABLE public.exercises DROP COLUMN IF EXISTS category;
