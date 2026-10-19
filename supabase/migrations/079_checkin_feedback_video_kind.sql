-- Check-in feedback only stores the pasted recording link, and clients can't
-- read public.recordings (coach-only RLS), so the client app has no way to
-- tell an audio recording from a video one. Store the kind on the feedback
-- row itself; the feedback API fills it in by matching video_link against
-- the coach's recordings.share_url.

-- Audio-only recordings uploaded before the web app started sending `kind`
-- were saved with the default 'video'. The uploaded file's own MIME type in
-- storage is authoritative, so correct those first.
UPDATE public.recordings r
SET kind = 'audio'
FROM storage.objects o
WHERE o.bucket_id = 'coach-recordings'
  AND o.name = r.file_path
  AND o.metadata->>'mimetype' LIKE 'audio/%'
  AND r.kind <> 'audio';

ALTER TABLE public.checkin_feedback
  ADD COLUMN IF NOT EXISTS video_kind TEXT NOT NULL DEFAULT 'video';

ALTER TABLE public.checkin_feedback DROP CONSTRAINT IF EXISTS checkin_feedback_video_kind_check;
ALTER TABLE public.checkin_feedback
  ADD CONSTRAINT checkin_feedback_video_kind_check CHECK (video_kind IN ('video', 'audio'));

UPDATE public.checkin_feedback f
SET video_kind = r.kind
FROM public.recordings r
WHERE r.share_url = f.video_link
  AND f.video_kind <> r.kind;
