import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Sparkles, Plus } from "lucide-react";
import { extractVariables } from "@/lib/prompt-template";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/")({
  component: PromptsList,
});

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  category: string | null;
  tags: string[];
  updated_at: string;
  user_id: string;
  client_id: string | null;
};

function PromptsList() {
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeClient, setActiveClient] = useState<string | null>(null);

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Prompt[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });
  const clientName = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    prompts.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [prompts]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return prompts.filter((p) => {
      if (activeCat && p.category !== activeCat) return false;
      if (activeClient && p.client_id !== activeClient) return false;
      if (!ql) return true;
      return (
        p.title.toLowerCase().includes(ql) ||
        p.description?.toLowerCase().includes(ql) ||
        p.content.toLowerCase().includes(ql) ||
        p.tags.some((t) => t.toLowerCase().includes(ql))
      );
    });
  }, [prompts, q, activeCat, activeClient]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 mb-10 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Volume 01 · {prompts.length} prompts
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold leading-[0.95] tracking-tight">
            The Library.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Every prompt the team has written. Search, filter by client, refine, and fill in the blanks.
          </p>
        </div>
        <Link to="/new">
          <Button className="h-11 gap-1.5">
            <Plus className="h-4 w-4" /> New prompt
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts, tags, content…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip active={!activeCat} onClick={() => setActiveCat(null)}>All categories</Chip>
            {categories.map((c) => (
              <Chip key={c} active={activeCat === c} onClick={() => setActiveCat(c)}>{c}</Chip>
            ))}
          </div>
        )}
      </div>

      {clients.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <Chip active={!activeClient} onClick={() => setActiveClient(null)}>All clients</Chip>
          {clients.map((c) => (
            <Chip key={c.id} active={activeClient === c.id} onClick={() => setActiveClient(c.id)}>{c.name}</Chip>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState hasPrompts={prompts.length > 0} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => <PromptCard key={p.id} p={p} clientName={p.client_id ? clientName[p.client_id] : undefined} />)}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border transition ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PromptCard({ p, clientName }: { p: Prompt; clientName?: string }) {
  const router = useRouter();
  const vars = extractVariables(p.content);
  return (
    <button
      onClick={() => router.navigate({ to: "/$id", params: { id: p.id } })}
      className="group text-left bg-card border border-border rounded-lg p-5 hover:border-foreground/60 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-col gap-1">
          {p.category && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{p.category}</span>
          )}
          {clientName && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-foreground">· {clientName}</span>
          )}
        </div>
        {vars.length > 0 && (
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3 w-3" /> {vars.length} var{vars.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <h3 className="font-display text-xl font-semibold leading-tight mb-2 group-hover:underline underline-offset-4 decoration-1">
        {p.title}
      </h3>
      {p.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{p.description}</p>
      )}
      <p className="font-mono text-xs text-muted-foreground/80 line-clamp-3 mb-4 bg-paper-soft/50 p-2 rounded">
        {p.content}
      </p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-1">
          {p.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="font-mono text-[10px] font-normal">{t}</Badge>
          ))}
        </div>
        <span className="font-mono text-[10px]">{formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</span>
      </div>
    </button>
  );
}

function EmptyState({ hasPrompts }: { hasPrompts: boolean }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-12 text-center">
      <FileText className="h-10 w-10 mx-auto text-muted-foreground/60" />
      <h3 className="mt-4 font-display text-xl font-semibold">
        {hasPrompts ? "No matches" : "An empty shelf"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasPrompts ? "Try a different search or filter." : "Add the first prompt to get the library going."}
      </p>
      {!hasPrompts && (
        <Link to="/new" className="mt-5 inline-block">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Create the first prompt
          </span>
        </Link>
      )}
    </div>
  );
}
