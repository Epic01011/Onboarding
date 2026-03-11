-- ============================================================
-- Migration 17 (20240101000017) — Nouveaux champs prospects
-- ============================================================
-- Ajoute quatre nouvelles colonnes à la table prospects :
--   event_status  — statut RSVP pour Événements Locaux
--   linkedin_url  — URL directe du profil LinkedIn du dirigeant
--   opened_at     — horodatage réel de la première ouverture d'email
--   clicked_at    — horodatage réel du premier clic sur un lien
-- ============================================================

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS event_status  TEXT        CHECK (event_status IN ('invite', 'inscrit', 'a-participe', 'absent')),
  ADD COLUMN IF NOT EXISTS linkedin_url  TEXT,
  ADD COLUMN IF NOT EXISTS opened_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_prospects_event_status
  ON prospects(event_status) WHERE event_status IS NOT NULL;
