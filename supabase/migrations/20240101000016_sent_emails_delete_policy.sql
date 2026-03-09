-- ============================================================
-- Migration 16 — Allow users to delete their own sent emails
-- ============================================================
-- Adds a DELETE RLS policy for the sent_emails table so that
-- the Email Engine full page can remove email records.

DROP POLICY IF EXISTS "sent_emails: delete own" ON sent_emails;
CREATE POLICY "sent_emails: delete own"
  ON sent_emails FOR DELETE
  USING (auth.uid() = user_id);
