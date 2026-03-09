-- ============================================================
-- Migration 6 (20240101000006) — Paramètres IA du Cabinet
-- ============================================================
-- Les paramètres IA (ai_api_key, ai_provider, cabinet_logo_url)
-- sont stockés dans kv_store_f54b77bb sous la clé cabinet:{userId}
-- sous forme de JSONB (structure CabinetInfo étendue).
--
-- Cette migration est documentaire — elle confirme que le schéma
-- kv_store_f54b77bb peut stocker ces champs sans modification DDL.
--
-- Champs ajoutés dans la structure CabinetInfo (côté applicatif) :
--   ai_api_key      TEXT    — Clé API IA (Claude Anthropic ou OpenAI)
--   ai_provider     TEXT    — Fournisseur IA ('claude' | 'openai')
--   cabinet_logo_url TEXT   — URL du logo du cabinet pour les emails
--
-- Ces informations sont gérées par :
--   src/app/utils/servicesStorage.ts  (types + localStorage fallback)
--   src/app/context/CabinetContext.tsx (React context + backend sync)
--   src/app/utils/backendApi.ts       (kv_store read/write)
-- ============================================================

-- Aucun DDL requis : la table kv_store_f54b77bb (JSONB) accueille
-- automatiquement les nouveaux champs.

-- Index optionnel pour accélérer les lookups si la table grossit.
CREATE INDEX IF NOT EXISTS idx_kv_store_key_prefix
  ON kv_store_f54b77bb (key text_pattern_ops);
