import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Building2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/")({
  component: ClientsList,
});

type ClientRow = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  status: string;
  updated_at: string;
};

function ClientsList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,industry,website,status,updated_at")
        .order("name");
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["clients-counts"],
    queryFn: async () => {
      const [projects, creds, prompts] = await Promise.all([
        supabase.from("projects").select("client_id"),
        supabase.from("credentials").select("client_id"),
        supabase.from("prompts").select("client_id"),
      ]);
      const out: Record<string, { p: number; c: number; pr: number }> = {};
      const bump = (id: string | null, k: "p" | "c" | "pr") => {
        if (!id) return;
        out[id] ??= { p: 0, c: 0, pr: 0 };
        out[id][k]++;
      };
      projects.data?.forEach((r) => bump(r.client_id, "p"));
      creds.data?.forEach((r) => bump(r.client_id, "c"));
      prompts.data?.forEach((r) => bump(r.client_id, "pr"));
      return out;
    },
  });

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return clients.filter((c) => {
      if (status && c.status !== status) return false;
      if (!ql) return true;
      return (
        c.name.toLowerCase().includes(ql) ||
        c.industry?.toLowerCase().includes(ql) ||
        c.website?.toLowerCase().includes(ql)
      );
    });
  }, [clients, q, status]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 mb-10 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {clients.length} clients on the roster
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold leading-[0.95] tracking-tight">
            Clients.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Everyone the agency works with. Projects, people, logins, and prompts — all in one shelf.
          </p>
        </div>
        <Link to="/clients/new">
          <Button className="h-11 gap-1.5">
            <Plus className="h-4 w-4" /> New client
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["active", "paused", "archived"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(status === s ? null : s)}
              className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border transition ${
                status === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <h3 className="mt-4 font-display text-xl font-semibold">
            {clients.length === 0 ? "No clients yet" : "No matches"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients.length === 0 ? "Add your first client to start building the CRM." : "Try a different filter."}
          </p>
          {clients.length === 0 && (
            <Link to="/clients/new" className="mt-5 inline-block">
              <Button>Create the first client</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-paper-soft/50 border-b border-border">
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 hidden md:table-cell">Industry</th>
                <th className="px-4 py-3 text-center">Projects</th>
                <th className="px-4 py-3 text-center">Logins</th>
                <th className="px-4 py-3 text-center">Prompts</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const n = counts[c.id] ?? { p: 0, c: 0, pr: 0 };
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-paper-soft/40 transition">
                    <td className="px-4 py-3">
                      <Link to="/clients/$clientId" params={{ clientId: c.id }} className="font-display font-semibold hover:underline underline-offset-4">
                        {c.name}
                      </Link>
                      {c.website && (
                        <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground">
                          {c.website.replace(/^https?:\/\//, "")} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.industry ?? "—"}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{n.p}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{n.c}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{n.pr}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={c.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-foreground text-background"
      : status === "paused"
        ? "bg-paper-soft text-foreground border border-border"
        : "bg-transparent text-muted-foreground border border-border";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${cls}`}>
      {status}
    </span>
  );
}
