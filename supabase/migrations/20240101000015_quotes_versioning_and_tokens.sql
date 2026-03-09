-- Migration 15 : Versioning des devis et tokens d'acceptation
--
-- Objectif :
--   1. Ajouter un champ `version` (v1, v2...) pour tracer les révisions de devis.
--   2. Ajouter un champ `accept_token` (UUID unique) pour les liens magiques
--      d'acceptation par le client.
--   3. Ajouter le statut 'ACCEPTED' à la table quotes pour les devis validés
--      via lien magique.
--   4. Ajouter le statut 'devis-valide' à la table prospects pour les prospects
--      ayant validé un devis.

-- ─── Version du devis ────────────────────────────────────────────────────────
-- Entier positif, commençant à 1. Chaque nouvelle révision d'un devis pour
-- le même prospect incrémente ce compteur (v1, v2, v3…).
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
  CHECK (version >= 1);

CREATE INDEX IF NOT EXISTS idx_quotes_version
  ON quotes(prospect_id, version) WHERE prospect_id IS NOT NULL;

-- Unique constraint to prevent duplicate version numbers for the same prospect
-- (prevents race conditions in concurrent inserts)
ALTER TABLE quotes
  ADD CONSTRAINT quotes_prospect_version_unique
  UNIQUE (prospect_id, version)
  DEFERRABLE INITIALLY DEFERRED;

-- ─── Token d'acceptation ─────────────────────────────────────────────────────
-- UUID généré côté serveur lors de l'envoi du devis au client.
-- Le lien magique intègre ce token : /api/accept-quote?token=<uuid>
-- Quand le client clique, le statut du devis passe à 'ACCEPTED' et le prospect
-- passe à 'devis-valide'.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS accept_token UUID UNIQUE;

CREATE INDEX IF NOT EXISTS idx_quotes_accept_token
  ON quotes(accept_token) WHERE accept_token IS NOT NULL;

-- ─── Statut 'ACCEPTED' pour les devis ────────────────────────────────────────
-- Supprime l'ancienne contrainte CHECK et recrée-la avec 'ACCEPTED'.
ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_status_check;

ALTER TABLE quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN (
    'PENDING_ONBOARDING',
    'DRAFT',
    'SENT',
    'ACCEPTED',
    'VALIDATED',
    'SIGNED',
    'ARCHIVED'
  ));

-- ─── Commentaires de colonnes ─────────────────────────────────────────────────
COMMENT ON COLUMN quotes.version IS
  'Numéro de version du devis pour ce prospect (1 = première version).';

COMMENT ON COLUMN quotes.accept_token IS
  'Token UUID unique inclus dans le lien magique d''acceptation envoyé au client.
   NULL tant que le devis n''a pas été envoyé.';
