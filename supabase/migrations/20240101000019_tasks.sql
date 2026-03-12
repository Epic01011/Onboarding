-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0019 — Module Organisation & Productivité (Task Management)
-- Tables : tasks · task_comments · task_attachments
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Ensure handle_updated_at() exists (idempotent — safe to run multiple times)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Enumerated types (idempotent via DO block)
DO $$ BEGIN
  CREATE TYPE public.task_status   AS ENUM ('todo', 'in_progress', 'review', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table : tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    title       TEXT         NOT NULL,
    description TEXT,
    dossier_id  UUID         REFERENCES public.prospects(id) ON DELETE SET NULL,
    assignee_id UUID         REFERENCES auth.users(id)       ON DELETE SET NULL,
    status      task_status  DEFAULT 'todo'::task_status     NOT NULL,
    priority    task_priority DEFAULT 'medium'::task_priority NOT NULL,
    due_date    TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  DEFAULT now()                   NOT NULL,
    updated_at  TIMESTAMPTZ  DEFAULT now()                   NOT NULL,
    created_by  UUID         REFERENCES auth.users(id)       DEFAULT auth.uid()
);

-- 3. Table : task_comments
CREATE TABLE IF NOT EXISTS public.task_comments (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id    UUID        REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id    UUID        REFERENCES auth.users(id)   ON DELETE SET NULL,
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Table : task_attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id      UUID        REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    file_name    TEXT        NOT NULL,
    file_path    TEXT        NOT NULL,
    file_size    INTEGER,
    content_type TEXT,
    uploaded_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Row Level Security
ALTER TABLE public.tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies — tasks
CREATE POLICY "Les utilisateurs authentifiés peuvent voir toutes les tâches"
    ON public.tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Les utilisateurs authentifiés peuvent créer des tâches"
    ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Les utilisateurs authentifiés peuvent modifier les tâches"
    ON public.tasks FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Les utilisateurs authentifiés peuvent supprimer des tâches"
    ON public.tasks FOR DELETE TO authenticated USING (true);

-- 6. RLS Policies — task_comments
CREATE POLICY "Voir les commentaires"
    ON public.task_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Ajouter un commentaire"
    ON public.task_comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Modifier son propre commentaire"
    ON public.task_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Supprimer son propre commentaire"
    ON public.task_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 6. RLS Policies — task_attachments
CREATE POLICY "Voir les pièces jointes"
    ON public.task_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Ajouter une pièce jointe"
    ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Supprimer une pièce jointe"
    ON public.task_attachments FOR DELETE TO authenticated USING (true);

-- 7. Triggers — auto-update updated_at
CREATE TRIGGER on_task_updated
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_comment_updated
    BEFORE UPDATE ON public.task_comments
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 8. Performance indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status        ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee      ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dossier       ON public.tasks(dossier_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date      ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_comments_task  ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attach_task    ON public.task_attachments(task_id);
