-- ============================================================
-- Migration 3 (20240101000002) — Supabase Storage : bucket cabinet-templates
-- ============================================================
-- Crée le bucket utilisé par backendApi.ts uploadPdfTemplate()
-- pour stocker les templates PDF des lettres de mission.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cabinet-templates',
  'cabinet-templates',
  false,
  52428800,   -- 50 MB max par fichier
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── Politiques de stockage ───────────────────────────────────────────────────

-- Lecture : les utilisateurs authentifiés lisent uniquement leur dossier
DROP POLICY IF EXISTS "cabinet_templates_select" ON storage.objects;
CREATE POLICY "cabinet_templates_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cabinet-templates'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Insertion / mise à jour : les utilisateurs authentifiés écrivent uniquement
-- dans leur dossier (templates/<userId>/...)
DROP POLICY IF EXISTS "cabinet_templates_insert" ON storage.objects;
CREATE POLICY "cabinet_templates_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cabinet-templates'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "cabinet_templates_update" ON storage.objects;
CREATE POLICY "cabinet_templates_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cabinet-templates'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "cabinet_templates_delete" ON storage.objects;
CREATE POLICY "cabinet_templates_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cabinet-templates'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
