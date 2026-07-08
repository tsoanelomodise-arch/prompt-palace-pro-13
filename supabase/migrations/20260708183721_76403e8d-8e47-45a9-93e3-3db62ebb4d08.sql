
DROP POLICY IF EXISTS "wiki_links insert" ON public.wiki_page_links;

CREATE POLICY "wiki_links insert"
ON public.wiki_page_links
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.wiki_pages p
      WHERE p.id = wiki_page_links.page_id
        AND p.created_by = auth.uid()
    )
  )
);
