import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookOpen, Plus, FileText, Search, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { slugify } from "@/lib/wiki";

export const Route = createFileRoute("/_authenticated/wiki/")({
  component: WikiIndex,
});

function WikiIndex() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");

  const { data: spaces = [] } = useQuery({
    queryKey: ["wiki-spaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_spaces")
        .select("id, name, slug, description")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: pageCounts = {} } = useQuery({
    queryKey: ["wiki-page-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wiki_pages").select("space_id");
      if (error) throw error;
      const out: Record<string, number> = {};
      data?.forEach((r) => {
        out[r.space_id] = (out[r.space_id] ?? 0) + 1;
      });
      return out;
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["wiki-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_pages")
        .select("id, title, slug, updated_at, space:wiki_spaces(name, slug)")
        .order("updated_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["wiki-search", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const term = `%${q.trim()}%`;
      const { data, error } = await supabase
        .from("wiki_pages")
        .select("id, title, slug, excerpt, content, space:wiki_spaces(name, slug)")
        .or(`title.ilike.${term},content.ilike.${term}`)
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Knowledge Base
          </p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-semibold leading-tight">
            Wiki
          </h1>
          <p className="mt-2 text-muted-foreground">SOPs, playbooks and agency know-how.</p>
        </div>
        {isAdmin && <NewSpaceDialog />}
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search all pages…"
          className="pl-9"
        />
      </div>

      {q.trim().length >= 2 ? (
        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">
            {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
          </h2>
          <div className="space-y-2">
            {searchResults.map((p) => {
              const space = p.space as { name: string; slug: string } | null;
              return (
                <Link
                  key={p.id}
                  to="/wiki/$spaceSlug/$pageSlug"
                  params={{ spaceSlug: space?.slug ?? "", pageSlug: p.slug }}
                  className="block p-4 border border-border rounded-lg bg-paper hover:bg-paper-soft transition"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{p.title}</h3>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {space?.name}
                    </span>
                  </div>
                  {p.excerpt && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          <section className="mb-12">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4">
              Spaces
            </h2>
            {spaces.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No spaces yet. {isAdmin && "Create the first one."}
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {spaces.map((s) => (
                  <Link
                    key={s.id}
                    to="/wiki/$spaceSlug"
                    params={{ spaceSlug: s.slug }}
                    className="group p-5 border border-border rounded-lg bg-paper hover:bg-paper-soft transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {pageCounts[s.id] ?? 0} pages
                      </span>
                    </div>
                    <h3 className="mt-3 font-display font-semibold text-lg leading-tight">
                      {s.name}
                    </h3>
                    {s.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                    )}
                    <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition">
                      Open <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4">
              Recently updated
            </h2>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No pages yet.</p>
            ) : (
              <ul className="space-y-1">
                {recent.map((p) => {
                  const space = p.space as { name: string; slug: string } | null;
                  return (
                    <li key={p.id}>
                      <Link
                        to="/wiki/$spaceSlug/$pageSlug"
                        params={{ spaceSlug: space?.slug ?? "", pageSlug: p.slug }}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-paper-soft transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{p.title}</span>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                            · {space?.name}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function NewSpaceDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("wiki_spaces").insert({
      name: name.trim(),
      slug: slugify(name),
      description: description.trim() || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Space created");
    setOpen(false);
    setName("");
    setDescription("");
    qc.invalidateQueries({ queryKey: ["wiki-spaces"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New space
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New space</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="Agency SOPs" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
