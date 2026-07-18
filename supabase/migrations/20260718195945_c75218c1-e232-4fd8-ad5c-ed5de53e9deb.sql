
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS impl_stage text;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_impl_stage_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_impl_stage_check
  CHECK (impl_stage IS NULL OR impl_stage IN ('kickoff','build','qa','launch','done'));
CREATE INDEX IF NOT EXISTS projects_impl_stage_idx ON public.projects(impl_stage);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','blocked','done')),
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT ALL ON public.project_tasks TO service_role;

CREATE INDEX IF NOT EXISTS project_tasks_project_idx ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS project_tasks_assignee_idx ON public.project_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS project_tasks_status_idx ON public.project_tasks(status);
CREATE INDEX IF NOT EXISTS project_tasks_due_idx ON public.project_tasks(due_date);

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read project_tasks" ON public.project_tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert project_tasks" ON public.project_tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "owner or admin update project_tasks" ON public.project_tasks
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assignee_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owner or admin delete project_tasks" ON public.project_tasks
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_project_tasks_updated_at ON public.project_tasks;
CREATE TRIGGER trg_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
