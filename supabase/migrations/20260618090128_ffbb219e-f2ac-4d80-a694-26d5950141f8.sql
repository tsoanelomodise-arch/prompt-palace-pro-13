
CREATE TYPE public.conversation_channel AS ENUM ('email','call','meeting','whatsapp','sms','other');

CREATE TABLE public.client_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  channel public.conversation_channel NOT NULL DEFAULT 'meeting',
  subject text NOT NULL,
  summary text NOT NULL,
  participants text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  follow_up_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_conversations TO authenticated;
GRANT ALL ON public.client_conversations TO service_role;

ALTER TABLE public.client_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read client_conversations"
  ON public.client_conversations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_conversations.client_id AND c.created_by = auth.uid())
  );

CREATE POLICY "auth insert client_conversations"
  ON public.client_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "auth update own client_conversations"
  ON public.client_conversations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by)
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

CREATE POLICY "auth delete own client_conversations"
  ON public.client_conversations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

CREATE TRIGGER client_conversations_set_updated_at
  BEFORE UPDATE ON public.client_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX client_conversations_client_idx ON public.client_conversations (client_id, occurred_at DESC);
