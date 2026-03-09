-- ============================================================
-- Migration 1 (20240101000000) — Schéma initial CabinetFlow
-- ============================================================
-- Tables requises par l'application :
--   kv_store_f54b77bb  — Magasin clé-valeur pour les données cabinet
--   onboarding_cases   — Dossiers d'onboarding en cours
--   onboarding_events  — Journal d'audit des actions
--   clients            — Clients du cabinet
--   quotes             — Propositions / devis
-- ============================================================

-- ─── kv_store_f54b77bb ────────────────────────────────────────────────────────
-- Table générique clé-valeur utilisée par backendApi.ts
-- pour stocker les clés API, informations cabinet, templates et dossiers.

CREATE TABLE IF NOT EXISTS kv_store_f54b77bb (
  key   TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);

-- ─── onboarding_cases ─────────────────────────────────────────────────────────
-- Sauvegarde des brouillons de dossiers pendant le parcours d'onboarding.

CREATE TABLE IF NOT EXISTS onboarding_cases (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id    TEXT        NOT NULL UNIQUE,
  step_id       TEXT        NOT NULL DEFAULT 'collecte',
  status        TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
  client_data   JSONB,
  step_statuses JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_cases_user_id
  ON onboarding_cases(user_id);

-- ─── onboarding_events ────────────────────────────────────────────────────────
-- Journal d'audit des actions utilisateurs (immuable — pas d'UPDATE/DELETE).

CREATE TABLE IF NOT EXISTS onboarding_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  dossier_id   TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_dossier_id
  ON onboarding_events(dossier_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_user_id
  ON onboarding_events(user_id);

-- ─── clients ──────────────────────────────────────────────────────────────────
-- Clients du cabinet — référencés par les devis.

CREATE TABLE IF NOT EXISTS clients (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name  TEXT        NOT NULL,
  -- UNIQUE sur client_email pour permettre l'upsert par email
  -- NULL n'est pas contraint (plusieurs clients peuvent ne pas avoir d'email)
  client_email TEXT        UNIQUE,
  siret        TEXT,
  legal_form   TEXT,
  tax_regime   TEXT,
  activity     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_client_email
  ON clients(client_email) WHERE client_email IS NOT NULL;

-- ─── quotes ───────────────────────────────────────────────────────────────────
-- Propositions / devis liés aux clients.

CREATE TABLE IF NOT EXISTS quotes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID        REFERENCES clients(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'PENDING_ONBOARDING'
                            CHECK (status IN (
                              'PENDING_ONBOARDING',
                              'DRAFT',
                              'VALIDATED',
                              'SIGNED',
                              'ARCHIVED'
                            )),
  monthly_total NUMERIC     CHECK (monthly_total >= 0),
  setup_fees    NUMERIC     CHECK (setup_fees >= 0),
  quote_data    JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_client_id
  ON quotes(client_id);

CREATE INDEX IF NOT EXISTS idx_quotes_status
  ON quotes(status);

-- ─── Trigger : updated_at automatique pour onboarding_cases ──────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_cases_updated_at ON onboarding_cases;
CREATE TRIGGER trg_onboarding_cases_updated_at
  BEFORE UPDATE ON onboarding_cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
