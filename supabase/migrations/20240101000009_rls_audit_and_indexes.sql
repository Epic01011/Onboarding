-- ============================================================
-- Migration 9 (20240101000009) — Audit RLS + indexes manquants
-- ============================================================
-- S'assure que :
--   1. RLS est activé sur toutes les tables critiques.
--   2. Les politiques existantes sont idempotentes (DROP IF EXISTS
--      + CREATE pour chaque table qui n'en avait pas encore).
--   3. Les index de performance sont présents.
--
-- Cette migration est safe à re-jouer (IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- ─── kv_store_f54b77bb ────────────────────────────────────────────────────────
-- Vérifie que RLS est bien actif (déjà fait en migration 2, idempotent).
ALTER TABLE kv_store_f54b77bb ENABLE ROW LEVEL SECURITY;

-- ─── clients ──────────────────────────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Index de déduplication sur SIREN (NULL-safe : ne porte que sur les non-NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_siren_unique
  ON clients(siren) WHERE siren IS NOT NULL;

-- ─── quotes ───────────────────────────────────────────────────────────────────
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Index composite pour la lecture des devis VALIDATED/SIGNED avec leur client
CREATE INDEX IF NOT EXISTS idx_quotes_client_status
  ON quotes(client_id, status);

-- ─── prospects ────────────────────────────────────────────────────────────────
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

-- ─── cabinet_settings ─────────────────────────────────────────────────────────
ALTER TABLE cabinet_settings ENABLE ROW LEVEL SECURITY;

-- Politique DELETE manquante (ajoutée ici pour être complet)
DROP POLICY IF EXISTS "cabinet_settings_delete_own" ON cabinet_settings;
CREATE POLICY "cabinet_settings_delete_own"
  ON cabinet_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── onboarding_cases ─────────────────────────────────────────────────────────
ALTER TABLE onboarding_cases ENABLE ROW LEVEL SECURITY;

-- ─── onboarding_events ────────────────────────────────────────────────────────
ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;
