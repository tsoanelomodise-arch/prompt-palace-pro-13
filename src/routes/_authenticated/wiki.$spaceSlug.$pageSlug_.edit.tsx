import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageTextarea } from "@/components/ui/image-textarea";
import { toast } from "sonner";
import { Check, Eye, Edit3 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";

export const Route = createFileRoute("/_authenticated/wiki/$spaceSlug/$pageSlug_/edit")({
  component: PageEdit,
});

function PageEdit() {
  const { spaceSlug, pageSlug } = Route.useParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [parentId, setParentId] = useState<string>("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["wiki-page-edit", spaceSlug, pageSlug],
    queryFn: async () => {
      const { data: space } = await supabase
        .from("wiki_spaces").select("id").eq("slug", spaceSlug).maybeSingle();
      if (!space) return null;
      const { data: page } = await supabase
        .from("wiki_pages").select("*").eq("space_id", space.id).eq("slug", pageSlug).maybeSingle();
      if (!page) return null;
      const { data: siblings } = await supabase
        .from("wiki_pages").select("id, title").eq("space_id", space.id).neq("id", page.id).order("title");
      return { page, siblings: siblings ?? [] };
    },
  });

  useEffect(() => {
    if (!data?.page) return;
    setTitle(data.page.title);
    setContent(data.page.content);
    setExcerpt(data.page.excerpt ?? "");
    setStatus((data.page.status as "draft" | "published") ?? "draft");
    setParentId(data.page.parent_id ?? "");
  }, [data?.page]);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data?.page) return <div className="text-sm text-muted-foreground">Page not found.</div>;

  const canEdit = isAdmin || data.page.created_by === user?.id;
  if (!canEdit) {
    return <div className="text-sm text-muted-foreground">You don't have permission to edit this page.</div>;
  }

  const pageId = data.page.id;
  const persist = async (v: { title: string; content: string; excerpt: string; status: "draft" | "published"; parentId: string }) => {
    if (!v.title.trim()) throw new Error("Title required");
    const { error } = await supabase
      .from("wiki_pages")
      .update({
        title: v.title.trim(),
        content: v.content,
        excerpt: v.excerpt.trim() || null,
        status: v.status,
        parent_id: v.parentId || null,
        updated_by: user?.id,
      })
      .eq("id", pageId);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["wiki-page-edit", spaceSlug, pageSlug] });
    qc.invalidateQueries({ queryKey: ["wiki-space-pages"] });
  };

  const autosave = useAutosave(
    { title, content, excerpt, status, parentId },
    persist,
    { enabled: canEdit && !!data.page },
  );

  const done = async () => {
    try {
      await persist({ title, content, excerpt, status, parentId });
    } catch (e: any) {
      return toast.error(e?.message ?? "Save failed");
    }
    router.navigate({
      to: "/wiki/$spaceSlug/$pageSlug",
      params: { spaceSlug, pageSlug: data.page.slug },
    });
  };

  return (
    <div className="py-2">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
        <div className="flex items-center gap-1 bg-paper-soft rounded-md p-0.5">
          <button
            onClick={() => setView("edit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-widest rounded transition ${
              view === "edit" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Edit3 className="h-3 w-3" /> Edit
          </button>
          <button
            onClick={() => setView("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-widest rounded transition ${
              view === "preview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Eye className="h-3 w-3" /> Preview
          </button>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={autosave.status} />
          <Button size="sm" onClick={done} className="gap-1.5">
            <Check className="h-3.5 w-3.5" /> Done
          </Button>
        </div>
      </div>


      <div className="space-y-4">
        <div>
          <Label className="text-xs">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 text-lg font-display font-semibold h-12"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "published")}
              className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Parent page</Label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
            >
              <option value="">— Top level —</option>
              {data.siblings.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label className="text-xs">Excerpt (optional)</Label>
          <Input
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            className="mt-1"
            placeholder="One-line summary shown in search results"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">Content (Markdown)</Label>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Supports GitHub-flavored markdown
            </span>
          </div>
          {view === "edit" ? (
            <ImageTextarea
              value={content}
              onValueChange={setContent}
              className="mt-1 font-mono text-sm min-h-[500px]"
              placeholder="# Heading&#10;&#10;Write your knowledge here…"
            />
          ) : (
            <div className="mt-1 border border-border rounded-md p-6 min-h-[500px] bg-paper">
              {content.trim() === "" ? (
                <p className="text-sm text-muted-foreground italic">Nothing to preview yet.</p>
              ) : (
                <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-semibold prose-pre:bg-paper-soft prose-pre:border prose-pre:border-border">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
