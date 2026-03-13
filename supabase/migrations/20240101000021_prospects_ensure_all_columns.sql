-- ============================================================
-- Migration 21 — Safety: ensure all enrichment columns exist on prospects
-- ============================================================
-- Some environments may not have run migration 13 fully, causing
-- "column not found" errors when saving capital_social and related
-- SIREN-enriched fields. This migration adds every column with
-- ADD COLUMN IF NOT EXISTS so it is safe to re-run.
-- ============================================================

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS siret                   TEXT,
  ADD COLUMN IF NOT EXISTS contact_name            TEXT,
  ADD COLUMN IF NOT EXISTS source                  TEXT,
  ADD COLUMN IF NOT EXISTS notes                   TEXT,
  ADD COLUMN IF NOT EXISTS user_id                 UUID,
  ADD COLUMN IF NOT EXISTS forme_juridique         TEXT,
  ADD COLUMN IF NOT EXISTS libelle_forme_juridique TEXT,
  ADD COLUMN IF NOT EXISTS libelle_naf             TEXT,
  ADD COLUMN IF NOT EXISTS departement             TEXT,
  ADD COLUMN IF NOT EXISTS date_creation           TEXT,
  ADD COLUMN IF NOT EXISTS capital_social          TEXT,
  ADD COLUMN IF NOT EXISTS categorie_entreprise    TEXT,
  ADD COLUMN IF NOT EXISTS dirigeant_principal     JSONB,
  ADD COLUMN IF NOT EXISTS telephone               TEXT,
  ADD COLUMN IF NOT EXISTS open_count              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked                 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_sent_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS icebreaker_ia           TEXT,
  ADD COLUMN IF NOT EXISTS sequence_step           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_follow_up_date     DATE,
  ADD COLUMN IF NOT EXISTS event_status            TEXT
    CHECK (event_status IN ('invite', 'inscrit', 'a-participe', 'absent')),
  ADD COLUMN IF NOT EXISTS linkedin_url            TEXT,
  ADD COLUMN IF NOT EXISTS opened_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS score                   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_value         NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS next_action_date        DATE,
  ADD COLUMN IF NOT EXISTS disable_auto_follow_up  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_activity_at        TIMESTAMPTZ;

-- Back-fill last_activity_at for any rows that may be missing it
UPDATE prospects
SET last_activity_at = updated_at
WHERE last_activity_at IS NULL;
