-- ============================================================
-- Migration 12 (20240101000012) — cabinet_settings : code_naf et capital_social
-- ============================================================
-- Ajoute les colonnes code_naf et capital_social récupérées depuis l'API SIREN.
-- Ces données enrichissent les documents et lettres de mission.
-- ============================================================

ALTER TABLE cabinet_settings
  ADD COLUMN IF NOT EXISTS code_naf      TEXT,
  ADD COLUMN IF NOT EXISTS capital_social TEXT;
