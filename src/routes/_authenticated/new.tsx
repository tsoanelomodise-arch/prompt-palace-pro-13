import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageTextarea } from "@/components/ui/image-textarea";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import { extractVariables } from "@/lib/prompt-template";

type Search = { clientId?: string };

export const Route = createFileRoute("/_authenticated/new")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    clientId: typeof s.clientId === "string" ? s.clientId : undefined,
  }),
  component: NewPrompt,
});

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(140),
  description: z.string().trim().max(280).optional(),
  category: z.string().trim().max(60).optional(),
  tagsRaw: z.string().max(200).optional(),
  content: z.string().trim().min(1, "Content is required").max(20000),
});

function NewPrompt() {
  const router = useRouter();
  const { user } = useAuth();
  const { clientId: initialClient } = Route.useSearch();
  const [form, setForm] = useState({ title: "", description: "", category: "", tagsRaw: "", content: "" });
  const [clientId, setClientId] = useState<string>(initialClient ?? "");
  const [projectId, setProjectId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-select", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,name").eq("client_id", clientId).order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => { setProjectId(""); }, [clientId]);

  const vars = extractVariables(form.content);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const tags = (form.tagsRaw || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const { data, error } = await supabase
      .from("prompts")
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        category: parsed.data.category || null,
        tags,
        content: parsed.data.content,
        client_id: clientId || null,
        project_id: projectId || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Prompt saved");
    router.navigate({ to: "/$id", params: { id: data.id } });
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <button
        onClick={() => router.history.back()}
        className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">New entry</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Add a prompt to the shelf.</h1>

      <form onSubmit={save} className="mt-8 space-y-6">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5 h-11" placeholder="e.g. Brand voice rewrite" />
        </div>

        <div>
          <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5 h-11" placeholder="What this prompt is for" />
        </div>

        <PromptTaxonomyFields
          category={form.category}
          tagsRaw={form.tagsRaw}
          onCategoryChange={(v) => setForm({ ...form, category: v })}
          onTagsRawChange={(v) => setForm({ ...form, tagsRaw: v })}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="client">Client <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <select
              id="client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— None —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="project">Project <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <select
              id="project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={!clientId || projects.length === 0}
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">— None —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="content">Prompt</Label>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Use <code className="px-1 bg-paper-soft rounded">{`{{variable}}`}</code> for placeholders
            </span>
          </div>
          <ImageTextarea
            id="content"
            required
            value={form.content}
            onValueChange={(v) => setForm({ ...form, content: v })}
            className="mt-1.5 font-mono text-sm min-h-[280px] resize-y"
            placeholder={"You are a senior copywriter for {{brand}}.\n\nWrite a {{tone}} hero headline about {{topic}}."}
          />
          {vars.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Detected:
              </span>
              {vars.map((v) => (
                <code key={v} className="font-mono text-xs px-2 py-0.5 rounded bg-paper-soft border border-border">{v}</code>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button type="submit" disabled={saving} className="h-11 px-6">
            {saving ? "Saving…" : "Save prompt"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.history.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
