-- ============================================================
-- Migration 14 — Journal des emails envoyés (sent_emails)
-- ============================================================
-- Table d'audit pour tous les emails envoyés depuis l'application.
-- Permet d'afficher le "Moteur E-mails" dans le dashboard.

CREATE TABLE IF NOT EXISTS sent_emails (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email  TEXT        NOT NULL,
  recipient_name   TEXT,
  subject          TEXT        NOT NULL,
  html_content     TEXT        NOT NULL DEFAULT '',
  email_type       TEXT,
  demo             BOOLEAN     NOT NULL DEFAULT false,
  message_id       TEXT,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sent_emails_user_id
  ON sent_emails(user_id);

CREATE INDEX IF NOT EXISTS idx_sent_emails_sent_at
  ON sent_emails(sent_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE sent_emails ENABLE ROW LEVEL SECURITY;

-- Each authenticated user can read only their own sent emails
DROP POLICY IF EXISTS "sent_emails: select own" ON sent_emails;
CREATE POLICY "sent_emails: select own"
  ON sent_emails FOR SELECT
  USING (auth.uid() = user_id);

-- Each authenticated user can insert their own sent emails
DROP POLICY IF EXISTS "sent_emails: insert own" ON sent_emails;
CREATE POLICY "sent_emails: insert own"
  ON sent_emails FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
