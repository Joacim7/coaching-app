-- Coach preferences: language, units, notification settings
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weight_unit   TEXT NOT NULL DEFAULT 'kg'  CHECK (weight_unit  IN ('kg', 'lb')),
  ADD COLUMN IF NOT EXISTS distance_unit TEXT NOT NULL DEFAULT 'km'  CHECK (distance_unit IN ('km', 'mi')),
  ADD COLUMN IF NOT EXISTS language      TEXT NOT NULL DEFAULT 'nb';
