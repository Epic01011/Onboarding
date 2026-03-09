-- ============================================================
-- Migration 10 (20240101000010) — Table user_integrations
-- ============================================================
-- Stocke les connexions API tierces par utilisateur.
-- Les credentials sensibles sont chiffrés côté client
-- (AES-256-GCM via cryptoUtils.ts) avant d'être persistés
-- dans la colonne encrypted_credentials.
--
-- Utilisée par :
--   src/app/utils/servicesStorage.ts  (loadIntegrationsFromSupabase / saveIntegrationToSupabase)
--   src/app/hooks/useApiKeys.ts       (chargement / mise à jour)
--   src/app/pages/SettingsPage.tsx    (onglets Emails & Stockage + Intégrations)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_integrations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name          TEXT        NOT NULL,
  is_connected          BOOLEAN     NOT NULL DEFAULT false,
  -- Credentials chiffrés côté client (encryptApiKey) — jamais en clair dans la DB
  encrypted_credentials TEXT        NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_name)
);

-- Trigger : met à jour updated_at automatiquement
DROP TRIGGER IF EXISTS trg_user_integrations_updated_at ON user_integrations;
CREATE TRIGGER trg_user_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur ne peut lire que ses propres intégrations
CREATE POLICY "user_integrations_select_own"
  ON user_integrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Chaque utilisateur ne peut insérer que pour lui-même
CREATE POLICY "user_integrations_insert_own"
  ON user_integrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Chaque utilisateur ne peut modifier que ses propres intégrations
CREATE POLICY "user_integrations_update_own"
  ON user_integrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
