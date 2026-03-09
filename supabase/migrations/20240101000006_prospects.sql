-- ============================================================
-- Migration 6 (20240101000006) — Table prospects (CRM Prospection)
-- ============================================================
-- Stocke les prospects du cabinet avec leur historique de contact,
-- le statut Kanban, et les données de tarification associées.
-- Les colonnes pricing_data, siren et naf_code ont été ajoutées
-- pour relier le module Tarification au CRM.
-- ============================================================

CREATE TABLE IF NOT EXISTS prospects (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name     TEXT        NOT NULL,
  -- SIREN (9 chiffres) — unique quand renseigné (NULL autorisé)
  siren            TEXT        UNIQUE,
  naf_code         TEXT,
  secteur_activite TEXT,
  contact_email    TEXT,
  contact_phone    TEXT,
  contact_nom      TEXT,
  contact_prenom   TEXT,
  adresse          TEXT,
  code_postal      TEXT,
  ville            TEXT,
  legal_form       TEXT,
  effectif         TEXT,
  -- Statut du cycle de vie dans le pipeline
  status           TEXT        NOT NULL DEFAULT 'a-contacter'
                               CHECK (status IN (
                                 'a-contacter',
                                 'email-envoye',
                                 'en-negociation',
                                 'gagne',
                                 'perdu',
                                 'client_converti'
                               )),
  -- Colonne Kanban courante
  kanban_column    TEXT        NOT NULL DEFAULT 'a-contacter',
  -- Données de tarification sauvegardées depuis le Moteur de Tarification
  -- (objet JSON contenant prix, services choisis, etc.)
  pricing_data     JSONB,
  -- Journal d'appels (tableau d'objets : { date, notes, duration })
  call_logs        JSONB       DEFAULT '[]'::jsonb,
  -- Données des dirigeants (depuis API SIREN / Pappers)
  dirigeants       JSONB       DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_siren
  ON prospects(siren) WHERE siren IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospects_status
  ON prospects(status);

CREATE INDEX IF NOT EXISTS idx_prospects_kanban_column
  ON prospects(kanban_column);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
-- Les utilisateurs authentifiés ont un accès complet à leurs prospects.

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospects_authenticated_full_access"
  ON prospects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
