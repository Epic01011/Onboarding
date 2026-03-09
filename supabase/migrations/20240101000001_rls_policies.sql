-- ============================================================
-- Migration 2 (20240101000001) — Row Level Security (RLS) policies
-- ============================================================
-- Toutes les tables utilisent RLS.
-- La service role key (backendApi.ts) contourne toujours RLS.
-- Les clients authentifiés accèdent selon les politiques ci-dessous.
-- ============================================================

-- ─── kv_store_f54b77bb ────────────────────────────────────────────────────────
-- Accès UNIQUEMENT via la service role key (backendApi.ts).
-- Aucune politique "utilisateur" nécessaire — RLS bloque tout sauf service role.

ALTER TABLE kv_store_f54b77bb ENABLE ROW LEVEL SECURITY;

-- Politique explicite pour les utilisateurs authentifiés :
-- Chaque utilisateur ne peut lire/écrire que ses propres entrées.
-- Les clés sont préfixées par le type (ex: "apikeys:<userId>", "dossiers:<userId>").
-- On ne peut pas facilement extraire l'userId depuis la clé TEXT en SQL standard,
-- donc on laisse le service role key gérer cela (il bypasse RLS de toute façon).
-- Pour la couche anon, on bloque tout accès direct.

DROP POLICY IF EXISTS "kv_no_direct_access" ON kv_store_f54b77bb;
CREATE POLICY "kv_no_direct_access"
  ON kv_store_f54b77bb
  FOR ALL
  TO authenticated
  USING (false);

-- ─── onboarding_cases ─────────────────────────────────────────────────────────
-- Chaque utilisateur peut uniquement accéder à ses propres dossiers.

ALTER TABLE onboarding_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_cases_select" ON onboarding_cases;
CREATE POLICY "users_own_cases_select"
  ON onboarding_cases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_cases_insert" ON onboarding_cases;
CREATE POLICY "users_own_cases_insert"
  ON onboarding_cases
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_cases_update" ON onboarding_cases;
CREATE POLICY "users_own_cases_update"
  ON onboarding_cases
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_cases_delete" ON onboarding_cases;
CREATE POLICY "users_own_cases_delete"
  ON onboarding_cases
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── onboarding_events ────────────────────────────────────────────────────────
-- Chaque utilisateur peut lire ses propres événements et en créer de nouveaux.
-- Les événements sont immuables (pas d'UPDATE ni DELETE).

ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_events_select" ON onboarding_events;
CREATE POLICY "users_own_events_select"
  ON onboarding_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_events_insert" ON onboarding_events;
CREATE POLICY "users_own_events_insert"
  ON onboarding_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ─── clients ──────────────────────────────────────────────────────────────────
-- Tous les utilisateurs authentifiés du cabinet peuvent accéder à tous les clients.
-- (Usage interne cabinet, pas multi-tenant public.)

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_clients_all" ON clients;
CREATE POLICY "authenticated_clients_all"
  ON clients
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── quotes ───────────────────────────────────────────────────────────────────
-- Tous les utilisateurs authentifiés du cabinet peuvent accéder à tous les devis.

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_quotes_all" ON quotes;
CREATE POLICY "authenticated_quotes_all"
  ON quotes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
