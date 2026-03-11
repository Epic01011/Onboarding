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

  -- Exercice comptable
  start_date        DATE        NOT NULL,
  closing_date      DATE        NOT NULL,

  -- Statut Pennylane (open / closed / closing_in_progress)
  pennylane_status  TEXT        NOT NULL DEFAULT 'open'
                    CHECK (pennylane_status IN ('open', 'closed', 'closing_in_progress')),

  -- Avancement production interne
  production_step   TEXT        NOT NULL DEFAULT 'not_started'
                    CHECK (production_step IN (
                      'not_started', 'data_collection', 'revision',
                      'final_review', 'certified'
                    )),

  -- Collaborateur responsable
  assigned_manager  TEXT,

  -- Échéance légale de dépôt calculée (closing_date + 4 mois)
  due_date          DATE        NOT NULL,

  -- Code couleur calculé (green / orange / red)
  urgency_semantic  TEXT        NOT NULL DEFAULT 'green'
                    CHECK (urgency_semantic IN ('green', 'orange', 'red')),

  -- Notes libres
  notes             TEXT,

  -- Métadonnées de sync
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes courantes
CREATE INDEX IF NOT EXISTS idx_balance_sheets_user_id
  ON balance_sheets(user_id);

CREATE INDEX IF NOT EXISTS idx_balance_sheets_closing_date
  ON balance_sheets(closing_date);

CREATE INDEX IF NOT EXISTS idx_balance_sheets_due_date
  ON balance_sheets(due_date);

-- Contrainte d'unicité par utilisateur + exercice Pennylane
CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_sheets_pennylane_user
  ON balance_sheets(user_id, pennylane_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE balance_sheets ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur ne voit que ses propres enregistrements
CREATE POLICY "balance_sheets_select_own"
  ON balance_sheets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "balance_sheets_insert_own"
  ON balance_sheets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "balance_sheets_update_own"
  ON balance_sheets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "balance_sheets_delete_own"
  ON balance_sheets FOR DELETE
  USING (auth.uid() = user_id);
