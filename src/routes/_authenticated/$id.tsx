import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Copy, Pencil, Save, Trash2, X, Sparkles, Check } from "lucide-react";
import { extractVariables, fillTemplate } from "@/lib/prompt-template";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/$id")({
  component: PromptDetail,
});

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  category: string | null;
  tags: string[];
  updated_at: string;
  created_at: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
};

type ClientLite = { id: string; name: string };

function PromptDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: prompt, isLoading } = useQuery({
    queryKey: ["prompts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("prompts").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Prompt;
    },
  });

  const { data: linkedClient } = useQuery({
    queryKey: ["prompt-client", prompt?.client_id],
    enabled: !!prompt?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").eq("id", prompt!.client_id!).single();
      if (error) throw error;
      return data as ClientLite;
    },
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; category: string; tagsRaw: string; content: string }>({
    title: "", description: "", category: "", tagsRaw: "", content: "",
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (prompt) {
      setForm({
        title: prompt.title,
        description: prompt.description ?? "",
        category: prompt.category ?? "",
        tagsRaw: prompt.tags.join(", "),
        content: prompt.content,
      });
    }
  }, [prompt]);

  const vars = useMemo(() => extractVariables(prompt?.content ?? ""), [prompt?.content]);
  const filled = useMemo(() => prompt ? fillTemplate(prompt.content, values) : "", [prompt, values]);
  const isOwner = user?.id === prompt?.user_id;

  const copyFilled = async () => {
    await navigator.clipboard.writeText(filled);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const save = async () => {
    if (!prompt) return;
    const tags = form.tagsRaw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const { error } = await supabase.from("prompts").update({
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      tags,
      content: form.content,
    }).eq("id", prompt.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["prompts"] });
    qc.invalidateQueries({ queryKey: ["prompts", id] });
  };

  const del = async () => {
    if (!prompt) return;
    const { error } = await supabase.from("prompts").delete().eq("id", prompt.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["prompts"] });
    router.navigate({ to: "/" });
  };

  if (isLoading || !prompt) {
    return <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <button
        onClick={() => router.navigate({ to: "/" })}
        className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Library
      </button>

      {/* Header */}
      <div className="pb-8 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              {prompt.category && (
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {prompt.category}
                </p>
              )}
              {linkedClient && (
                <Link to="/clients/$clientId" params={{ clientId: linkedClient.id }} className="font-mono text-xs uppercase tracking-widest text-foreground hover:underline">
                  · {linkedClient.name}
                </Link>
              )}
            </div>
            {editing ? (
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="text-3xl h-auto py-2 font-display font-semibold" />
            ) : (
              <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight">{prompt.title}</h1>
            )}
            {!editing && prompt.description && (
              <p className="mt-3 text-muted-foreground max-w-2xl">{prompt.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOwner && !editing && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this prompt?</AlertDialogTitle>
                      <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            {editing && (
              <>
                <Button size="sm" onClick={save} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="gap-1.5"><X className="h-3.5 w-3.5" /> Cancel</Button>
              </>
            )}
          </div>
        </div>

        {!editing && (
          <div className="mt-4 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            {prompt.tags.map((t) => (
              <Badge key={t} variant="secondary" className="font-mono text-[10px] font-normal">{t}</Badge>
            ))}
            <span className="font-mono text-[10px] uppercase tracking-widest">
              Updated {formatDistanceToNow(new Date(prompt.updated_at), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      {editing ? (
        <div className="mt-8 space-y-5">
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5 h-11" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1.5 h-11" />
            </div>
            <div>
              <Label>Tags</Label>
              <Input value={form.tagsRaw} onChange={(e) => setForm({ ...form, tagsRaw: e.target.value })} className="mt-1.5 h-11" />
            </div>
          </div>
          <div>
            <Label>Prompt</Label>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="mt-1.5 font-mono text-sm min-h-[320px]" />
          </div>
        </div>
      ) : (
        <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-8">
          {/* Prompt preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {vars.length > 0 ? "Filled output" : "Prompt"}
              </p>
              <Button size="sm" variant="outline" onClick={copyFilled} className="gap-1.5 h-8">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="font-mono text-sm whitespace-pre-wrap bg-card border border-border rounded-lg p-6 leading-relaxed">
              {filled}
            </pre>
          </div>

          {/* Variables fill panel */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {vars.length > 0 ? (
              <div className="bg-paper-soft/50 border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4" />
                  <h3 className="font-display font-semibold">Fill the blanks</h3>
                </div>
                <div className="space-y-3">
                  {vars.map((v) => (
                    <div key={v}>
                      <Label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                        {v}
                      </Label>
                      <Textarea
                        value={values[v] ?? ""}
                        onChange={(e) => setValues({ ...values, [v]: e.target.value })}
                        className="mt-1 font-mono text-sm min-h-[64px] resize-y bg-card"
                        placeholder={`value for ${v}`}
                      />
                    </div>
                  ))}
                </div>
                {Object.keys(values).length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setValues({})} className="mt-4 w-full">
                    Clear all
                  </Button>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-lg p-5 text-sm text-muted-foreground">
                <p className="font-display font-semibold text-foreground mb-1">No variables</p>
                This prompt has no <code className="font-mono text-xs">{`{{placeholders}}`}</code>. Copy it as-is.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
