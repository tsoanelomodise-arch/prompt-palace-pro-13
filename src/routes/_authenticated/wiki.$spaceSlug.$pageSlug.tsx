import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Clock, Copy } from "lucide-react";
import { slugify } from "@/lib/wiki";
import { Markdown } from "@/components/ui/markdown";
import { formatDistanceToNow } from "date-fns";
import { LinkedEntities } from "@/components/wiki/LinkedEntities";

export const Route = createFileRoute("/_authenticated/wiki/$spaceSlug/$pageSlug")({
  component: PageView,
});

function PageView() {
  const { spaceSlug, pageSlug } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [duplicating, setDuplicating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wiki-page", spaceSlug, pageSlug],
    queryFn: async () => {
      const { data: space, error: e1 } = await supabase
        .from("wiki_spaces")
        .select("id")
        .eq("slug", spaceSlug)
        .maybeSingle();
      if (e1) throw e1;
      if (!space) return null;
      const { data: page, error: e2 } = await supabase
        .from("wiki_pages")
        .select("*")
        .eq("space_id", space.id)
        .eq("slug", pageSlug)
        .maybeSingle();
      if (e2) throw e2;
      return page;
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (!data) {
    return <div className="text-sm text-muted-foreground">Page not found.</div>;
  }

  const canEdit = isAdmin || data.created_by === user?.id;



  const duplicate = async () => {
    setDuplicating(true);
    try {
      const baseTitle = `${data.title} (copy)`;
      const baseSlug = slugify(baseTitle);
      const { data: existing, error: e1 } = await supabase
        .from("wiki_pages")
        .select("slug")
        .eq("space_id", data.space_id)
        .like("slug", `${baseSlug}%`);
      if (e1) throw e1;
      const taken = new Set((existing ?? []).map((r) => r.slug));
      let slug = baseSlug;
      let n = 2;
      while (taken.has(slug)) slug = `${baseSlug}-${n++}`;
      let title = baseTitle;
      if (n > 2) title = `${data.title} (copy ${n - 1})`;
      const { data: created, error: e2 } = await supabase
        .from("wiki_pages")
        .insert({
          space_id: data.space_id,
          parent_id: data.parent_id,
          title,
          slug,
          content: data.content,
          excerpt: data.excerpt,
          status: "draft",
          created_by: user?.id,
          updated_by: user?.id,
        })
        .select("slug")
        .single();
      if (e2) throw e2;
      toast.success("Duplicated");
      qc.invalidateQueries({ queryKey: ["wiki-space-pages"] });
      qc.invalidateQueries({ queryKey: ["wiki-recent"] });
      router.navigate({
        to: "/wiki/$spaceSlug/$pageSlug/edit",
        params: { spaceSlug, pageSlug: created.slug },
      });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to duplicate");
    } finally {
      setDuplicating(false);
    }
  };

  const del = async () => {
    const { error } = await supabase.from("wiki_pages").delete().eq("id", data.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["wiki-space-pages"] });
    qc.invalidateQueries({ queryKey: ["wiki-recent"] });
    router.navigate({ to: "/wiki/$spaceSlug", params: { spaceSlug } });
  };

  return (
    <article className="py-2">
      <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {data.status === "draft" && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">draft</span>
            )}
            <Clock className="h-3 w-3" />
            updated {formatDistanceToNow(new Date(data.updated_at), { addSuffix: true })}
          </div>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold leading-tight break-words">
            {data.title}
          </h1>
        </div>
        {canEdit && (
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.navigate({
                to: "/wiki/$spaceSlug/$pageSlug/edit",
                params: { spaceSlug, pageSlug },
              })}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={duplicate}
              disabled={duplicating}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> {duplicating ? "Duplicating…" : "Duplicate"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this page?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{data.title}" and its revision history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {data.content.trim() === "" ? (
        <p className="mt-8 text-sm text-muted-foreground italic">
          This page is empty. {canEdit && "Click Edit to add content."}
        </p>
      ) : (
        <Markdown className="mt-8 text-base">{data.content}</Markdown>
      )}

      <div className="mt-10">
        <LinkedEntities pageId={data.id} canEdit={canEdit} />
      </div>
    </article>
  );
}
