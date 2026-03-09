-- ============================================================
-- Migration 12 (20240101000012) — Colonnes CRM sur la table prospects
-- ============================================================
-- Ajoute trois colonnes pour le pipeline CRM :
--   score           — score de chaleur du lead (0-100)
--   estimated_value — valeur financière estimée du contrat (€)
--   next_action_date — date de la prochaine action commerciale
-- ============================================================

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS score            INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_value  NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS next_action_date DATE;

CREATE INDEX IF NOT EXISTS idx_prospects_next_action_date
  ON prospects(next_action_date) WHERE next_action_date IS NOT NULL;
