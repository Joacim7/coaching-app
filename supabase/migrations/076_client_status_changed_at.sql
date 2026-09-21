-- ── Track when a client's status last became "inactive" ─────────────────────
-- coach_clients only had created_at (when the relationship began) — no way
-- to show "Inaktiv siden X" the same way the client hero card shows "Klient
-- siden X" for created_at. Stamped by the status API route only when a
-- client transitions TO 'inactive'; left untouched on other transitions, so
-- reactivating and later deactivating again correctly refreshes it to the
-- most recent inactive date.

ALTER TABLE public.coach_clients
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
