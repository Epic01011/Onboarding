-- ============================================================
-- Migration 15 (20240101000015) — cabinet_settings : clé Perplexity + contrainte ai_provider
-- ============================================================
-- Objectif :
--   1. Ajouter la colonne perplexity_api_key pour stocker la clé
--      API Perplexity chiffrée (AES-256-GCM, côté client).
--   2. Mettre à jour la contrainte CHECK sur ai_provider pour
--      autoriser la valeur 'perplexity' en plus de 'claude' et 'openai'.
--
-- Utilisée par :
--   src/app/pages/SettingsPage.tsx  (SELECT + UPSERT)
--   src/app/utils/servicesStorage.ts (type AiProvider)
-- ============================================================

-- 1. Ajout de la colonne perplexity_api_key
--    Stockée chiffrée (AES-256-GCM, dérivation PBKDF2 côté client).
--    Voir : src/app/utils/cryptoUtils.ts
ALTER TABLE cabinet_settings
  ADD COLUMN IF NOT EXISTS perplexity_api_key TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN cabinet_settings.perplexity_api_key
  IS 'Clé API Perplexity chiffrée (AES-256-GCM, dérivation PBKDF2 côté client). Ne jamais stocker en clair. Voir cryptoUtils.ts.';

-- 2. Mise à jour de la contrainte CHECK sur ai_provider
--    La contrainte existante n''autorise que 'claude' et 'openai'.
--    On la supprime puis on la recrée avec 'perplexity' en plus.
ALTER TABLE cabinet_settings
  DROP CONSTRAINT IF EXISTS cabinet_settings_ai_provider_check;

ALTER TABLE cabinet_settings
  ADD CONSTRAINT cabinet_settings_ai_provider_check
  CHECK (ai_provider IN ('claude', 'openai', 'perplexity'));
