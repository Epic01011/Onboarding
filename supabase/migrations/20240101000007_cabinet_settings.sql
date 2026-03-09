-- ============================================================
-- Migration 7 (20240101000007) — Table cabinet_settings
-- ============================================================
-- Stocke les paramètres du cabinet par utilisateur :
-- informations générales et configuration de l'IA.
--
-- Utilisée par :
--   src/app/pages/SettingsPage.tsx  (SELECT + UPSERT)
-- ============================================================

CREATE TABLE IF NOT EXISTS cabinet_settings (
  user_id       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cabinet_name  TEXT        NOT NULL DEFAULT '',
  expert_name   TEXT        NOT NULL DEFAULT '',
  logo_url      TEXT        NOT NULL DEFAULT '',
  ai_provider   TEXT        NOT NULL DEFAULT 'claude'
                            CHECK (ai_provider IN ('claude', 'openai')),
  -- ⚠️  Stockée chiffrée côté serveur (Supabase Vault recommandé en production)
  ai_api_key    TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger : met à jour updated_at automatiquement
DROP TRIGGER IF EXISTS trg_cabinet_settings_updated_at ON cabinet_settings;
CREATE TRIGGER trg_cabinet_settings_updated_at
  BEFORE UPDATE ON cabinet_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE cabinet_settings ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur ne peut lire et modifier que ses propres paramètres
CREATE POLICY "cabinet_settings_select_own"
  ON cabinet_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "cabinet_settings_upsert_own"
  ON cabinet_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cabinet_settings_update_own"
  ON cabinet_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
