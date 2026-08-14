-- ── Track when the onboarding email was actually sent ────────────────────────
--
-- The client detail page's onboarding panel only ever showed "Fullført"
-- (submitted) or "Ikke sendt" ("not sent") — the latter used for every
-- client who hadn't yet submitted the form, even ones who'd genuinely been
-- emailed an invite and just hadn't gotten to it yet, or ones the coach hit
-- "Send på nytt" for. Both invite-client and resend-onboarding already send
-- the email; this just records when, so the panel can show a real
-- "Sendt" / "Ikke sendt" / "Fullført" tri-state instead of collapsing
-- "sent" into "not sent".

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_email_sent_at TIMESTAMPTZ;
