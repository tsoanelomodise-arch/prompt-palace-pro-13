import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/pipeline";
import { GripVertical, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

type ClientRow = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  status: string;
  updated_at: string;
};

function PipelinePage() {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PipelineStage | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", "pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,industry,website,status,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const grouped = useMemo(() => {
    const map: Record<PipelineStage, ClientRow[]> = {
      lead: [], contacted: [], proposal: [], active: [], won: [], lost: [],
    };
    for (const c of clients) {
      if (c.status in map) map[c.status as PipelineStage].push(c);
    }
    return map;
  }, [clients]);

  const offPipelineCount = clients.filter(
    (c) => !(c.status in ({ lead: 1, contacted: 1, proposal: 1, active: 1, won: 1, lost: 1 } as Record<string, number>)),
  ).length;

  const move = async (clientId: string, stage: PipelineStage) => {
    const current = clients.find((c) => c.id === clientId);
    if (!current || current.status === stage) return;

    // optimistic update
    qc.setQueryData<ClientRow[]>(["clients", "pipeline"], (old) =>
      (old ?? []).map((c) => (c.id === clientId ? { ...c, status: stage } : c)),
    );

    const { error } = await supabase.from("clients").update({ status: stage }).eq("id", clientId);
    if (error) {
      toast.error("Could not move client");
      qc.invalidateQueries({ queryKey: ["clients", "pipeline"] });
    } else {
      qc.invalidateQueries({ queryKey: ["clients"] });
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {clients.length} clients · {offPipelineCount} off pipeline
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold leading-[0.95] tracking-tight">
            Pipeline.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Drag a client card between stages to update their status. Paused and archived clients don't appear here.
          </p>
        </div>
        <Link to="/clients/new">
          <Button className="h-11 gap-1.5"><Plus className="h-4 w-4" /> New client</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading pipeline…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const items = grouped[stage.id];
            const isOver = overStage === stage.id;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverStage(null);
                  if (dragId) move(dragId, stage.id);
                  setDragId(null);
                }}
                className={`rounded-lg border bg-card flex flex-col min-h-[300px] transition ${
                  isOver ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {stage.label}
                    </div>
                    <div className="text-xs text-muted-foreground/70">{stage.hint}</div>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground bg-paper-soft rounded-full px-2 py-0.5">
                    {items.length}
                  </span>
                </div>
                <div className="p-2 flex-1 flex flex-col gap-2">
                  {items.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/60 px-2 py-6 text-center border border-dashed border-border rounded-md">
                      Drop here
                    </div>
                  ) : (
                    items.map((c) => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => setDragId(c.id)}
                        onDragEnd={() => { setDragId(null); setOverStage(null); }}
                        className={`group border border-border rounded-md p-3 bg-background hover:border-foreground/50 transition cursor-grab active:cursor-grabbing ${
                          dragId === c.id ? "opacity-40" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <Link
                              to="/clients/$clientId"
                              params={{ clientId: c.id }}
                              className="font-display font-semibold text-sm hover:underline underline-offset-4 truncate block"
                            >
                              {c.name}
                            </Link>
                            {c.industry && (
                              <div className="text-[11px] text-muted-foreground truncate">{c.industry}</div>
                            )}
                            {c.website && (
                              <a
                                href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                              >
                                {c.website.replace(/^https?:\/\//, "")}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
