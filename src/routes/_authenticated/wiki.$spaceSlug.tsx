import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, ChevronDown, FileText, Plus, BookOpen } from "lucide-react";
import { slugify } from "@/lib/wiki";

export const Route = createFileRoute("/_authenticated/wiki/$spaceSlug")({
  component: SpaceLayout,
});

type PageRow = {
  id: string;
  title: string;
  slug: string;
  parent_id: string | null;
  status: string;
  position: number;
};

function SpaceLayout() {
  const { spaceSlug } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: space, isLoading } = useQuery({
    queryKey: ["wiki-space", spaceSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_spaces")
        .select("*")
        .eq("slug", spaceSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["wiki-space-pages", space?.id],
    enabled: !!space?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_pages")
        .select("id, title, slug, parent_id, status, position")
        .eq("space_id", space!.id)
        .order("position")
        .order("title");
      if (error) throw error;
      return data as PageRow[];
    },
  });

  if (isLoading) {
    return <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!space) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Space not found.</p>
        <Link to="/wiki" className="text-sm underline">Back to wiki</Link>
      </div>
    );
  }

  // Build nested tree
  const childrenOf = new Map<string | null, PageRow[]>();
  pages.forEach((p) => {
    const k = p.parent_id;
    if (!childrenOf.has(k)) childrenOf.set(k, []);
    childrenOf.get(k)!.push(p);
  });

  const isIndex = pathname === `/wiki/${spaceSlug}` || pathname === `/wiki/${spaceSlug}/`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        to="/wiki"
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Wiki
      </Link>

      <div className="grid lg:grid-cols-[260px_1fr] gap-8">
        <aside className="lg:border-r lg:border-border lg:pr-6">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Space
            </p>
          </div>
          <h2 className="font-display font-semibold text-lg leading-tight mb-4">{space.name}</h2>

          <NewPageDialog spaceId={space.id} spaceSlug={spaceSlug} pages={pages} />

          <nav className="mt-4 space-y-0.5">
            {pages.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-2 py-1">No pages yet.</p>
            ) : (
              <PageAccordion
                pages={pages}
                childrenOf={childrenOf}
                spaceSlug={spaceSlug}
                pathname={pathname}
              />
            )}
          </nav>
        </aside>

        <div className="min-w-0">
          {isIndex ? (
            <div className="py-8">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Space
              </p>
              <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold">{space.name}</h1>
              {space.description && (
                <p className="mt-3 text-muted-foreground">{space.description}</p>
              )}
              <p className="mt-8 text-sm text-muted-foreground">
                {pages.length === 0
                  ? "This space is empty. Create the first page from the sidebar."
                  : "Pick a page from the sidebar."}
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
}

function PageAccordion({
  pages,
  childrenOf,
  spaceSlug,
  pathname,
}: {
  pages: PageRow[];
  childrenOf: Map<string | null, PageRow[]>;
  spaceSlug: string;
  pathname: string;
}) {
  // Map id → page and parent-id lookup for computing ancestors of the active page.
  const byId = useMemo(() => {
    const m = new Map<string, PageRow>();
    pages.forEach((p) => m.set(p.id, p));
    return m;
  }, [pages]);

  // Detect active page from URL and expand all its ancestors.
  const activeSlug = useMemo(() => {
    const prefix = `/wiki/${spaceSlug}/`;
    if (!pathname.startsWith(prefix)) return null;
    const rest = pathname.slice(prefix.length).split("/")[0];
    return rest || null;
  }, [pathname, spaceSlug]);

  const activePage = useMemo(
    () => (activeSlug ? pages.find((p) => p.slug === activeSlug) ?? null : null),
    [pages, activeSlug],
  );

  const ancestorIds = useMemo(() => {
    const ids = new Set<string>();
    let cur = activePage?.parent_id ?? null;
    while (cur) {
      ids.add(cur);
      cur = byId.get(cur)?.parent_id ?? null;
    }
    return ids;
  }, [activePage, byId]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(ancestorIds));

  // Keep ancestors of the current page expanded as the user navigates.
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      ancestorIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [ancestorIds]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <PageTree
      nodes={childrenOf.get(null) ?? []}
      childrenOf={childrenOf}
      spaceSlug={spaceSlug}
      pathname={pathname}
      depth={0}
      expanded={expanded}
      onToggle={toggle}
    />
  );
}

function PageTree({
  nodes,
  childrenOf,
  spaceSlug,
  pathname,
  depth,
  expanded,
  onToggle,
}: {
  nodes: PageRow[];
  childrenOf: Map<string | null, PageRow[]>;
  spaceSlug: string;
  pathname: string;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((n) => {
        const kids = childrenOf.get(n.id) ?? [];
        const hasKids = kids.length > 0;
        const isOpen = expanded.has(n.id);
        const href = `/wiki/${spaceSlug}/${n.slug}`;
        const isActive = pathname === href;
        return (
          <li key={n.id}>
            <div
              className={`group flex items-center gap-1 rounded text-sm transition ${
                isActive
                  ? "bg-paper-soft text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-paper-soft"
              }`}
              style={{ paddingLeft: `${0.25 + depth * 0.75}rem` }}
            >
              {hasKids ? (
                <button
                  type="button"
                  onClick={() => onToggle(n.id)}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Collapse" : "Expand"}
                  className="p-1 -m-1 rounded hover:bg-border/60 text-muted-foreground shrink-0"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              ) : (
                <span className="w-5 shrink-0 inline-flex justify-center">
                  <FileText className="h-3 w-3 opacity-60" />
                </span>
              )}
              <Link
                to="/wiki/$spaceSlug/$pageSlug"
                params={{ spaceSlug, pageSlug: n.slug }}
                className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1"
              >
                <span className="truncate">{n.title}</span>
                {n.status === "draft" && (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground ml-auto shrink-0">
                    draft
                  </span>
                )}
              </Link>
            </div>
            {hasKids && isOpen && (
              <PageTree
                nodes={kids}
                childrenOf={childrenOf}
                spaceSlug={spaceSlug}
                pathname={pathname}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NewPageDialog({
  spaceId,
  spaceSlug,
  pages,
}: {
  spaceId: string;
  spaceSlug: string;
  pages: PageRow[];
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    let baseSlug = slugify(title);
    // ensure unique within space
    const taken = new Set(pages.map((p) => p.slug));
    let finalSlug = baseSlug;
    let n = 2;
    while (taken.has(finalSlug)) finalSlug = `${baseSlug}-${n++}`;

    const { data, error } = await supabase
      .from("wiki_pages")
      .insert({
        space_id: spaceId,
        parent_id: parentId || null,
        title: title.trim(),
        slug: finalSlug,
        content: "",
        status: "draft",
        created_by: user?.id,
        updated_by: user?.id,
      })
      .select("slug")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Page created");
    setOpen(false);
    setTitle("");
    setParentId("");
    qc.invalidateQueries({ queryKey: ["wiki-space-pages", spaceId] });
    qc.invalidateQueries({ queryKey: ["wiki-recent"] });
    router.navigate({
      to: "/wiki/$spaceSlug/$pageSlug/edit",
      params: { spaceSlug, pageSlug: data!.slug },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New page
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New page</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Parent page (optional)</Label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
            >
              <option value="">— Top level —</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
