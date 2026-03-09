-- ============================================================
-- Migration 5 (20240101000004) — Ajout de la colonne `slug`
-- ============================================================
-- Permet d'associer un modèle spécifique à une forme juridique
-- (ex: "ldm-societe-commerciale", "ldm-sci", "ldm-bnc").
-- La colonne est nullable pour la rétro-compatibilité avec les
-- modèles existants (is_default reste utilisable comme fallback).
-- ============================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_slug
  ON documents(slug) WHERE slug IS NOT NULL;
