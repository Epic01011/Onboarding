-- Migration: add disable_auto_follow_up and last_activity_at to prospects
--
-- disable_auto_follow_up : when TRUE, this prospect is excluded from the
--   automated J+7 inactivity alerts in the Centre d'Action.
--
-- last_activity_at : timestamp of the most recent timeline action
--   (call log, note save, status change). Used instead of updated_at so that
--   purely administrative edits (address correction, etc.) do not reset the
--   inactivity counter.

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS disable_auto_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_activity_at       TIMESTAMPTZ;

-- Back-fill last_activity_at from updated_at for existing rows
UPDATE prospects
SET last_activity_at = updated_at
WHERE last_activity_at IS NULL;
