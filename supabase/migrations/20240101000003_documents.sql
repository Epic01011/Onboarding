-- ============================================================
-- Migration 4 — Table documents pour les modèles LDM/Confraternelle
-- ============================================================
-- Stocke les templates de lettres de mission et confraternelles
-- avec leur contenu (variable {{...}}) dans la colonne `contenu`.
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT        NOT NULL DEFAULT 'mission'
             CHECK (type IN ('confraternal', 'mission', 'mandat_creation')),
  name       TEXT        NOT NULL,
  contenu    TEXT        NOT NULL,
  variables  JSONB,
  is_default BOOLEAN     NOT NULL DEFAULT false,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_type
  ON documents(type);

CREATE INDEX IF NOT EXISTS idx_documents_user_id
  ON documents(user_id) WHERE user_id IS NOT NULL;

-- Trigger updated_at automatique
DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS : lecture publique (anon/authenticated), écriture authentifiée seulement
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_read_all"
  ON documents FOR SELECT
  USING (true);

CREATE POLICY "documents_write_authenticated"
  ON documents FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (true);
