-- Add session type to training_sessions (styrke vs cardio)
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'styrke';
