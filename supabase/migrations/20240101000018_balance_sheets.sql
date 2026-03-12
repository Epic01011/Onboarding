-- ============================================================
-- Migration 20240101000018 — Table balance_sheets
-- ============================================================
-- Stocke les exercices comptables synchronisés depuis Pennylane.
-- Enrichit les tâches BILAN avec :
--   - closing_date     : date de clôture réelle (API Pennylane)
--   - due_date         : échéance légale de dépôt (clôture + 4 mois)
--   - production_step  : avancement interne (not_started → certified)
--   - assigned_manager : collaborateur responsable
--   - urgency_semantic : code couleur (green/orange/red)
-- ============================================================

CREATE TABLE IF NOT EXISTS balance_sheets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identifiants Pennylane
  pennylane_id      TEXT        NOT NULL,
  customer_id       TEXT        NOT NULL,
  customer_name     TEXT        NOT NULL,

  -- Dates de l'exercice
  start_date        DATE        NOT NULL,
  closing_date      DATE        NOT NULL, -- Date de clôture Pennylane
  due_date          DATE        NOT NULL, -- Échéance légale (ex: Clôture + 4 mois)

  -- Statuts et Production
  pennylane_status  TEXT        NOT NULL CHECK (pennylane_status IN ('open', 'closed', 'closing_in_progress')),
  production_step   TEXT        NOT NULL DEFAULT 'not_started'
                                CHECK (production_step IN ('not_started', 'data_collection', 'revision', 'final_review', 'certified')),

  -- Coordination
  assigned_manager  TEXT,
  urgency_semantic  TEXT        NOT NULL DEFAULT 'green' CHECK (urgency_semantic IN ('green', 'orange', 'red')),

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Contrainte d'unicité pour éviter les doublons lors de la synchronisation
  UNIQUE(user_id, pennylane_id)
);

-- Index pour optimiser les recherches par utilisateur et par date
CREATE INDEX IF NOT EXISTS idx_balance_sheets_user_id ON balance_sheets(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_sheets_closing_date ON balance_sheets(closing_date);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

-- Activation de la RLS
ALTER TABLE balance_sheets ENABLE ROW LEVEL SECURITY;

-- Politique de lecture : l'utilisateur ne voit que ses bilans
CREATE POLICY "Les utilisateurs peuvent voir leurs propres bilans"
  ON balance_sheets FOR SELECT
  USING (auth.uid() = user_id);

-- Politique d'insertion : l'utilisateur peut insérer ses propres bilans
CREATE POLICY "Les utilisateurs peuvent insérer leurs propres bilans"
  ON balance_sheets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique de mise à jour : l'utilisateur peut modifier ses propres bilans
CREATE POLICY "Les utilisateurs peuvent modifier leurs propres bilans"
  ON balance_sheets FOR UPDATE
  USING (auth.uid() = user_id);

-- Politique de suppression
CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres bilans"
  ON balance_sheets FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Trigger updated_at ──────────────────────────────────────────────────────

-- 1. Créer d'abord la fonction (si elle n'existe pas déjà)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Créer ensuite le trigger pour la table balance_sheets
DROP TRIGGER IF EXISTS trg_balance_sheets_updated_at ON balance_sheets;
CREATE TRIGGER trg_balance_sheets_updated_at
  BEFORE UPDATE ON balance_sheets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
