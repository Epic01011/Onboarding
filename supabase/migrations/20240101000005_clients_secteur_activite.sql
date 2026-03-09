-- Migration 5 : renomme la colonne activity → secteur_activite dans la table clients
-- et ajoute les colonnes enrichies manquantes (siren, raison_sociale, nom_contact,
-- prenom_contact, adresse, code_postal, ville) si elles n'existent pas encore.

-- Renommer activity → secteur_activite
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'activity'
  ) THEN
    ALTER TABLE clients RENAME COLUMN activity TO secteur_activite;
  END IF;
END $$;

-- Ajouter les colonnes enrichies si absentes
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS siren           TEXT,
  ADD COLUMN IF NOT EXISTS raison_sociale  TEXT,
  ADD COLUMN IF NOT EXISTS nom_contact     TEXT,
  ADD COLUMN IF NOT EXISTS prenom_contact  TEXT,
  ADD COLUMN IF NOT EXISTS adresse         TEXT,
  ADD COLUMN IF NOT EXISTS code_postal     TEXT,
  ADD COLUMN IF NOT EXISTS ville           TEXT;
