
-- 1. Contacts: restrict SELECT to client owner or admin
DROP POLICY IF EXISTS "auth read contacts" ON public.contacts;
CREATE POLICY "owner or admin read contacts" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = contacts.client_id AND c.created_by = auth.uid()
    )
  );

-- 2. Credentials: restrict SELECT to admins
DROP POLICY IF EXISTS "auth read credentials meta" ON public.credentials;
CREATE POLICY "admins read credentials" ON public.credentials
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. wiki_page_revisions: require edited_by = auth.uid()
DROP POLICY IF EXISTS "wiki_rev insert" ON public.wiki_page_revisions;
CREATE POLICY "wiki_rev insert" ON public.wiki_page_revisions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = edited_by);

-- 4. Revoke EXECUTE on SECURITY DEFINER functions from anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.credential_reveal(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.credential_set_secret(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.wiki_pages_write_revision() FROM anon, public, authenticated;
