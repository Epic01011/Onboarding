-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0021 — Synchronisation Microsoft To Do
-- Ajoute les colonnes microsoft_task_id et microsoft_list_id à la table tasks
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ajout des colonnes de synchronisation Microsoft To Do
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS microsoft_task_id TEXT,
  ADD COLUMN IF NOT EXISTS microsoft_list_id TEXT;

-- 2. Index pour accélérer la recherche par identifiant Microsoft (ex. depuis le webhook)
CREATE INDEX IF NOT EXISTS idx_tasks_ms_task_id
  ON public.tasks(microsoft_task_id)
  WHERE microsoft_task_id IS NOT NULL;
