
-- Spaces
CREATE TABLE public.wiki_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wiki_spaces TO authenticated;
GRANT ALL ON public.wiki_spaces TO service_role;
ALTER TABLE public.wiki_spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wiki_spaces read" ON public.wiki_spaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "wiki_spaces admin insert" ON public.wiki_spaces FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wiki_spaces admin update" ON public.wiki_spaces FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wiki_spaces admin delete" ON public.wiki_spaces FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER wiki_spaces_updated BEFORE UPDATE ON public.wiki_spaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Pages
CREATE TABLE public.wiki_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.wiki_spaces(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.wiki_pages(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL,
  content text NOT NULL DEFAULT '',
  excerpt text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  position int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(space_id, slug)
);
CREATE INDEX wiki_pages_space_idx ON public.wiki_pages(space_id);
CREATE INDEX wiki_pages_parent_idx ON public.wiki_pages(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wiki_pages TO authenticated;
GRANT ALL ON public.wiki_pages TO service_role;
ALTER TABLE public.wiki_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wiki_pages read" ON public.wiki_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "wiki_pages insert" ON public.wiki_pages FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "wiki_pages update" ON public.wiki_pages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);
CREATE POLICY "wiki_pages delete" ON public.wiki_pages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);
CREATE TRIGGER wiki_pages_updated BEFORE UPDATE ON public.wiki_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Links (polymorphic)
CREATE TABLE public.wiki_page_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.wiki_pages(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('client','project','prompt')),
  entity_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(page_id, entity_type, entity_id)
);
CREATE INDEX wiki_links_entity_idx ON public.wiki_page_links(entity_type, entity_id);
CREATE INDEX wiki_links_page_idx ON public.wiki_page_links(page_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wiki_page_links TO authenticated;
GRANT ALL ON public.wiki_page_links TO service_role;
ALTER TABLE public.wiki_page_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wiki_links read" ON public.wiki_page_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "wiki_links insert" ON public.wiki_page_links FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "wiki_links delete" ON public.wiki_page_links FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

-- Revisions
CREATE TABLE public.wiki_page_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.wiki_pages(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wiki_revisions_page_idx ON public.wiki_page_revisions(page_id, created_at DESC);
GRANT SELECT, INSERT ON public.wiki_page_revisions TO authenticated;
GRANT ALL ON public.wiki_page_revisions TO service_role;
ALTER TABLE public.wiki_page_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wiki_rev read" ON public.wiki_page_revisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "wiki_rev insert" ON public.wiki_page_revisions FOR INSERT TO authenticated WITH CHECK (true);

-- Revision trigger: snapshot previous values on UPDATE when title/content change
CREATE OR REPLACE FUNCTION public.wiki_pages_write_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.title IS DISTINCT FROM NEW.title) OR (OLD.content IS DISTINCT FROM NEW.content) THEN
    INSERT INTO public.wiki_page_revisions (page_id, title, content, edited_by)
    VALUES (OLD.id, OLD.title, OLD.content, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wiki_pages_revision BEFORE UPDATE ON public.wiki_pages
  FOR EACH ROW EXECUTE FUNCTION public.wiki_pages_write_revision();

-- Seed a default space
INSERT INTO public.wiki_spaces (name, slug, description, icon)
VALUES ('Agency SOPs', 'agency-sops', 'Standard operating procedures and internal know-how', 'book');
