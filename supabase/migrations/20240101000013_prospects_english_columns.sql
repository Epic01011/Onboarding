-- ============================================================
-- Migration 13 — Align prospects table with live DB schema
-- ============================================================
-- Renames columns in `prospects` from French to English names
-- and adds missing columns to align the migration files with
-- the exact live Supabase schema.
--
-- prospects:
--   adresse       → address
--   code_postal   → postal_code
--   ville         → city
--   contact_nom / contact_prenom → contact_name (single field)
--
-- Also adds prospect_id FK to `quotes` so that draft quotes
-- can reference a prospect before being converted to a client.
-- ============================================================

-- ─── Rename prospects address columns ────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prospects' AND column_name = 'adresse') THEN
    ALTER TABLE prospects RENAME COLUMN adresse TO address;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prospects' AND column_name = 'code_postal') THEN
    ALTER TABLE prospects RENAME COLUMN code_postal TO postal_code;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prospects' AND column_name = 'ville') THEN
    ALTER TABLE prospects RENAME COLUMN ville TO city;
  END IF;
END $$;

-- ─── Merge contact_nom + contact_prenom into contact_name ────────────────────

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_name TEXT;

DO $$
BEGIN
  -- Populate contact_name from existing split fields if contact_name is empty
  UPDATE prospects
  SET contact_name = TRIM(
    COALESCE(contact_prenom, '') || ' ' || COALESCE(contact_nom, '')
  )
  WHERE contact_name IS NULL
    AND (contact_nom IS NOT NULL OR contact_prenom IS NOT NULL);
END $$;

-- Drop old split contact columns (safe: data has been migrated above)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prospects' AND column_name = 'contact_prenom') THEN
    ALTER TABLE prospects DROP COLUMN contact_prenom;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prospects' AND column_name = 'contact_nom') THEN
    ALTER TABLE prospects DROP COLUMN contact_nom;
  END IF;
END $$;

-- ─── Add missing prospects columns ───────────────────────────────────────────

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS siret               VARCHAR,
  ADD COLUMN IF NOT EXISTS source              TEXT,
  ADD COLUMN IF NOT EXISTS notes               TEXT,
  ADD COLUMN IF NOT EXISTS user_id             UUID,
  ADD COLUMN IF NOT EXISTS forme_juridique     TEXT,
  ADD COLUMN IF NOT EXISTS libelle_forme_juridique TEXT,
  ADD COLUMN IF NOT EXISTS libelle_naf         TEXT,
  ADD COLUMN IF NOT EXISTS departement         TEXT,
  ADD COLUMN IF NOT EXISTS date_creation       TEXT,
  ADD COLUMN IF NOT EXISTS capital_social      TEXT,
  ADD COLUMN IF NOT EXISTS categorie_entreprise TEXT,
  ADD COLUMN IF NOT EXISTS dirigeant_principal JSONB,
  ADD COLUMN IF NOT EXISTS telephone           TEXT,
  ADD COLUMN IF NOT EXISTS open_count          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked             BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_sent_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS icebreaker_ia       TEXT,
  ADD COLUMN IF NOT EXISTS sequence_step       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_follow_up_date DATE;

-- ─── Add prospect_id to quotes ────────────────────────────────────────────────
-- Allows draft quotes to reference a prospect before client conversion.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_prospect_id
  ON quotes(prospect_id) WHERE prospect_id IS NOT NULL;
