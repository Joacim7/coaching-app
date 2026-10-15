-- Recordings can now be captured with no screen/video track at all (mic-only
-- audio recordings) — `kind` lets the UI know which <audio>/<video> tag and
-- icon to render without having to sniff file_path's extension at read time.
-- NOT NULL DEFAULT 'video' backfills every pre-existing row (all genuine
-- screen recordings) in one statement.

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'video';

ALTER TABLE public.recordings DROP CONSTRAINT IF EXISTS recordings_kind_check;
ALTER TABLE public.recordings
  ADD CONSTRAINT recordings_kind_check CHECK (kind IN ('video', 'audio'));
