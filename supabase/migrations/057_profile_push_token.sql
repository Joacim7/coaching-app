-- ── Expo push token storage ───────────────────────────────────────────────────
-- The mobile app registers for push notifications and stores its Expo push
-- token here so the web app can send a push (e.g. "coach answered your
-- weekly check-in") without needing the device to be actively polling.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
