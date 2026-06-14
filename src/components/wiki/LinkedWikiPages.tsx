import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { BookOpen, Plus, X, FileText } from "lucide-react";
import { toast } from "sonner";
import type { EntityType } from "@/lib/wiki";

type LinkedRow = {
  id: string;
  page_id: string;
  page: { id: string; title: string; slug: string; space: { slug: string; name: string } | null } | null;
};

export function LinkedWikiPages({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const qc = useQueryClient();
  const queryKey = ["wiki-links", entityType, entityId];

  const { data: links = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_page_links")
        .select("id, page_id, page:wiki_pages(id, title, slug, space:wiki_spaces(slug, name))")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      if (error) throw error;
      return (data ?? []) as unknown as LinkedRow[];
    },
  });

  const detach = async (id: string) => {
    const { error } = await supabase.from("wiki_page_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey });
  };

  return (
    <div className="border border-border rounded-lg p-5 bg-paper">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Related know-how
          </h3>
        </div>
        <AttachPagePopover
          entityType={entityType}
          entityId={entityId}
          existingIds={links.map((l) => l.page_id)}
          onAttached={() => qc.invalidateQueries({ queryKey })}
        />
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No wiki pages linked yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map((l) =>
            l.page ? (
              <li key={l.id} className="flex items-center justify-between gap-3 group">
                <Link
                  to="/wiki/$spaceSlug/$pageSlug"
                  params={{
                    spaceSlug: l.page.space?.slug ?? "agency-sops",
                    pageSlug: l.page.slug,
                  }}
                  className="flex items-center gap-2 text-sm hover:text-primary transition flex-1 min-w-0"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{l.page.title}</span>
                  {l.page.space && (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      · {l.page.space.name}
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => detach(l.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                  title="Detach"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </div>
  );
}

function AttachPagePopover({
  entityType,
  entityId,
  existingIds,
  onAttached,
}: {
  entityType: EntityType;
  entityId: string;
  existingIds: string[];
  onAttached: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: pages = [] } = useQuery({
    queryKey: ["wiki-pages-attach"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_pages")
        .select("id, title, slug, space:wiki_spaces(name)")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const filtered = pages.filter(
    (p) =>
      !existingIds.includes(p.id) &&
      (q.trim() === "" || p.title.toLowerCase().includes(q.toLowerCase())),
  );

  const attach = async (pageId: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("wiki_page_links").insert({
      page_id: pageId,
      entity_type: entityType,
      entity_id: entityId,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Linked");
    setQ("");
    onAttached();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Attach
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-2 border-b border-border">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search wiki pages…"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-72 overflow-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">
              {pages.length === 0 ? "No wiki pages yet." : "Nothing matches."}
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => attach(p.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-paper-soft transition flex items-center justify-between gap-2"
              >
                <span className="truncate">{p.title}</span>
                {p.space && (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground shrink-0">
                    {(p.space as { name: string }).name}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
