-- ============================================================
-- Migration 11 (20240101000011) — cabinet_settings : colonnes SIREN + RLS idempotent
-- ============================================================
-- 1. Ajoute les colonnes SIREN/adresse pour le pré-remplissage automatique
--    depuis l'API gouvernementale (recherche-entreprises.api.gouv.fr).
-- 2. Normalise ai_provider : l'ancienne valeur par défaut 'anthropic' est
--    remplacée par 'claude' pour correspondre aux valeurs acceptées par l'UI.
-- 3. Re-crée toutes les politiques RLS de façon idempotente (DROP IF EXISTS)
--    afin de garantir leur présence même sur des bases créées sans les migrations.
-- ============================================================

-- ─── 1. Nouvelles colonnes SIREN/adresse ──────────────────────────────────────
ALTER TABLE cabinet_settings
  ADD COLUMN IF NOT EXISTS siren           TEXT,
  ADD COLUMN IF NOT EXISTS siret           TEXT,
  ADD COLUMN IF NOT EXISTS adresse         TEXT,
  ADD COLUMN IF NOT EXISTS code_postal     TEXT,
  ADD COLUMN IF NOT EXISTS ville           TEXT,
  ADD COLUMN IF NOT EXISTS forme_juridique TEXT,
  ADD COLUMN IF NOT EXISTS telephone       TEXT,
  ADD COLUMN IF NOT EXISTS site_web        TEXT;

-- ─── 2. Normalisation ai_provider ────────────────────────────────────────────
-- L'ancienne valeur 'anthropic' (défaut du projet initial) est remplacée par
-- 'claude' qui correspond au libellé attendu par le Select de l'UI.
UPDATE cabinet_settings
SET    ai_provider = 'claude'
WHERE  ai_provider = 'anthropic';

-- ─── 3. Politiques RLS idempotentes ──────────────────────────────────────────
ALTER TABLE cabinet_settings ENABLE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS "cabinet_settings_select_own" ON cabinet_settings;
CREATE POLICY "cabinet_settings_select_own"
  ON cabinet_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT
DROP POLICY IF EXISTS "cabinet_settings_upsert_own"  ON cabinet_settings;
DROP POLICY IF EXISTS "cabinet_settings_insert_own"  ON cabinet_settings;
CREATE POLICY "cabinet_settings_insert_own"
  ON cabinet_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE
DROP POLICY IF EXISTS "cabinet_settings_update_own" ON cabinet_settings;
CREATE POLICY "cabinet_settings_update_own"
  ON cabinet_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE
DROP POLICY IF EXISTS "cabinet_settings_delete_own" ON cabinet_settings;
CREATE POLICY "cabinet_settings_delete_own"
  ON cabinet_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
