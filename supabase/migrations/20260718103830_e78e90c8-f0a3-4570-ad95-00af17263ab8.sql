ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_occurrence_date date;

CREATE INDEX IF NOT EXISTS projects_due_date_idx ON public.projects (due_date);
CREATE INDEX IF NOT EXISTS projects_next_occurrence_idx ON public.projects (next_occurrence_date);