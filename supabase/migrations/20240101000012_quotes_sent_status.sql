-- Migration 12 : Ajouter le statut 'SENT' à la table quotes
--
-- Objectif : Permettre de tracer les devis envoyés aux clients (par email ou
-- export PDF/DOC) indépendamment de la validation formelle ('VALIDATED').
-- Cela permet de calculer des métriques d'analyse telles que
-- "Valeur totale des devis envoyés".

-- Supprimer l'ancienne contrainte CHECK sur le statut
ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_status_check;

-- Recréer la contrainte avec le statut 'SENT' inclus
ALTER TABLE quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN (
    'PENDING_ONBOARDING',
    'DRAFT',
    'SENT',
    'VALIDATED',
    'SIGNED',
    'ARCHIVED'
  ));
