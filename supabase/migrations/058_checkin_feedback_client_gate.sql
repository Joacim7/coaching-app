-- Drafts (is_complete = false) must never be visible to the client — only
-- feedback the coach has explicitly sent. Previously any row with a
-- comment/video_link was immediately readable by the client the instant
-- it was saved, even from an unsent "save draft" click, since this policy
-- had no status check at all.

DROP POLICY IF EXISTS "clients_read_own_checkin_feedback" ON public.checkin_feedback;

CREATE POLICY "clients_read_own_checkin_feedback"
  ON public.checkin_feedback FOR SELECT
  USING (
    is_complete = true
    AND EXISTS (
      SELECT 1 FROM public.checkins c
      WHERE c.id = checkin_id
        AND c.client_id = auth.uid()
    )
  );
