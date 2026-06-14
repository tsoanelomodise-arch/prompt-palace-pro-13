import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Link2, Plus, X, Building2, Briefcase, FileText } from "lucide-react";
import type { EntityType } from "@/lib/wiki";
import { ENTITY_LABELS } from "@/lib/wiki";

const ICON: Record<EntityType, typeof Building2> = {
  client: Building2,
  project: Briefcase,
  prompt: FileText,
};

type LinkRow = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
};

type EntityLite = { id: string; name?: string | null; title?: string | null; client_id?: string | null };

export function LinkedEntities({ pageId, canEdit }: { pageId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const queryKey = ["wiki-page-links", pageId];

  const { data: links = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_page_links")
        .select("id, entity_type, entity_id")
        .eq("page_id", pageId);
      if (error) throw error;
      return data as LinkRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["wiki-resolve-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name");
      if (error) throw error;
      return data as EntityLite[];
    },
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["wiki-resolve-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, client_id");
      if (error) throw error;
      return data as EntityLite[];
    },
  });
  const { data: prompts = [] } = useQuery({
    queryKey: ["wiki-resolve-prompts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prompts").select("id, title");
      if (error) throw error;
      return data as EntityLite[];
    },
  });

  const lookup = (type: EntityType, id: string) => {
    const list = type === "client" ? clients : type === "project" ? projects : prompts;
    const row = list.find((r) => r.id === id);
    return row?.name ?? row?.title ?? "(deleted)";
  };

  const detach = async (id: string) => {
    const { error } = await supabase.from("wiki_page_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey });
  };

  return (
    <div className="border border-border rounded-lg p-5 bg-paper">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Linked to
          </h3>
        </div>
        {canEdit && (
          <AttachEntityPopover
            pageId={pageId}
            existing={links}
            clients={clients}
            projects={projects}
            prompts={prompts}
            onAttached={() => qc.invalidateQueries({ queryKey })}
          />
        )}
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Not linked to anything yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {links.map((l) => {
            const Icon = ICON[l.entity_type];
            const label = lookup(l.entity_type, l.entity_id);
            const inner = (
              <>
                <Icon className="h-3 w-3" />
                <span className="font-mono text-[10px] uppercase tracking-widest">
                  {ENTITY_LABELS[l.entity_type]}
                </span>
                <span className="text-sm">{label}</span>
              </>
            );
            const cls =
              "inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md border border-border bg-background hover:bg-paper-soft transition group";
            return (
              <li key={l.id}>
                <div className={cls}>
                  {l.entity_type === "client" ? (
                    <Link to="/clients/$clientId" params={{ clientId: l.entity_id }} className="inline-flex items-center gap-1.5">
                      {inner}
                    </Link>
                  ) : l.entity_type === "prompt" ? (
                    <Link to="/$id" params={{ id: l.entity_id }} className="inline-flex items-center gap-1.5">
                      {inner}
                    </Link>
                  ) : (
                    // project: link to its client detail page
                    (() => {
                      const proj = projects.find((p) => p.id === l.entity_id);
                      return proj?.client_id ? (
                        <Link to="/clients/$clientId" params={{ clientId: proj.client_id }} className="inline-flex items-center gap-1.5">
                          {inner}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">{inner}</span>
                      );
                    })()
                  )}
                  {canEdit && (
                    <button
                      onClick={() => detach(l.id)}
                      className="ml-1 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-background opacity-0 group-hover:opacity-100 transition"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AttachEntityPopover({
  pageId,
  existing,
  clients,
  projects,
  prompts,
  onAttached,
}: {
  pageId: string;
  existing: LinkRow[];
  clients: EntityLite[];
  projects: EntityLite[];
  prompts: EntityLite[];
  onAttached: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<EntityType>("client");
  const [q, setQ] = useState("");

  const list = tab === "client" ? clients : tab === "project" ? projects : prompts;
  const takenIds = new Set(existing.filter((e) => e.entity_type === tab).map((e) => e.entity_id));
  const filtered = list
    .filter((r) => !takenIds.has(r.id))
    .filter((r) => {
      const name = (r.name ?? r.title ?? "").toLowerCase();
      return q.trim() === "" || name.includes(q.toLowerCase());
    })
    .slice(0, 50);

  const attach = async (entityId: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("wiki_page_links").insert({
      page_id: pageId,
      entity_type: tab,
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
          <Plus className="h-3.5 w-3.5" /> Link
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex border-b border-border">
          {(["client", "project", "prompt"] as EntityType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-3 py-2 text-xs font-mono uppercase tracking-widest transition ${
                tab === t
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ENTITY_LABELS[t]}s
            </button>
          ))}
        </div>
        <div className="p-2 border-b border-border">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-72 overflow-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">
              Nothing to link.
            </p>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => attach(r.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-paper-soft transition truncate"
              >
                {r.name ?? r.title}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
