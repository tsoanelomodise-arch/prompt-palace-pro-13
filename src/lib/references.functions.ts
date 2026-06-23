import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReferenceKind = "prompt" | "note" | "conversation" | "wiki";

export interface ReferenceItem {
  kind: ReferenceKind;
  id: string;
  label: string;
  sublabel?: string;
  url: string;
}

const inputSchema = z.object({
  query: z.string().max(200).default(""),
});

export const searchReferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ReferenceItem[]> => {
    const supabase = context.supabase;
    const q = data.query.trim();
    const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;
    const limitPer = 5;

    const promptsQ = supabase
      .from("prompts")
      .select("id, title, description")
      .order("updated_at", { ascending: false })
      .limit(limitPer);
    if (like) promptsQ.or(`title.ilike.${like},description.ilike.${like}`);

    const notesQ = supabase
      .from("client_notes")
      .select("id, body, client_id, clients(name)")
      .order("updated_at", { ascending: false })
      .limit(limitPer);
    if (like) notesQ.ilike("body", like);

    const convosQ = supabase
      .from("client_conversations")
      .select("id, subject, summary, client_id, clients(name)")
      .order("occurred_at", { ascending: false })
      .limit(limitPer);
    if (like) convosQ.or(`subject.ilike.${like},summary.ilike.${like}`);

    const wikiQ = supabase
      .from("wiki_pages")
      .select("id, title, slug, excerpt, wiki_spaces(slug, name)")
      .order("updated_at", { ascending: false })
      .limit(limitPer);
    if (like) wikiQ.or(`title.ilike.${like},excerpt.ilike.${like}`);

    const [prompts, notes, convos, wikis] = await Promise.all([
      promptsQ, notesQ, convosQ, wikiQ,
    ]);

    const out: ReferenceItem[] = [];

    for (const p of prompts.data ?? []) {
      out.push({
        kind: "prompt",
        id: p.id,
        label: p.title || "Untitled prompt",
        sublabel: p.description ?? undefined,
        url: `/${p.id}`,
      });
    }
    for (const n of notes.data ?? []) {
      const clientName = (n as { clients?: { name?: string } | null }).clients?.name;
      const snippet = (n.body ?? "").replace(/\s+/g, " ").slice(0, 60);
      out.push({
        kind: "note",
        id: n.id,
        label: snippet || "Note",
        sublabel: clientName ? `Note · ${clientName}` : "Note",
        url: `/clients/${n.client_id}#note-${n.id}`,
      });
    }
    for (const c of convos.data ?? []) {
      const clientName = (c as { clients?: { name?: string } | null }).clients?.name;
      out.push({
        kind: "conversation",
        id: c.id,
        label: c.subject || "Conversation",
        sublabel: clientName ? `Conversation · ${clientName}` : "Conversation",
        url: `/clients/${c.client_id}#conversation-${c.id}`,
      });
    }
    for (const w of wikis.data ?? []) {
      const space = (w as { wiki_spaces?: { slug?: string; name?: string } | null }).wiki_spaces;
      if (!space?.slug) continue;
      out.push({
        kind: "wiki",
        id: w.id,
        label: w.title || "Untitled page",
        sublabel: space.name ? `Wiki · ${space.name}` : "Wiki",
        url: `/wiki/${space.slug}/${w.slug}`,
      });
    }

    return out;
  });
