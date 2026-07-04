import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PIPELINE_STAGES, REPEAT_INTERVALS, repeatLabel, type PipelineStage, type RepeatInterval } from "@/lib/pipeline";
import { GripVertical, Briefcase, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  client_id: string;
  updated_at: string;
};

type ClientLite = { id: string; name: string };

function PipelinePage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PipelineStage | null>(null);
  const [dragging, setDragging] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", "pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,notes,client_id,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ProjectRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return data as ClientLite[];
    },
  });

  const clientName = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const grouped = useMemo(() => {
    const map: Record<PipelineStage, ProjectRow[]> = {
      lead: [], proposal: [], active: [], review: [], delivered: [], lost: [],
    };
    for (const p of projects) {
      if (p.status in map) map[p.status as PipelineStage].push(p);
    }
    return map;
  }, [projects]);

  const validStages = new Set<string>(PIPELINE_STAGES.map((s) => s.id));
  const offPipeline = projects.filter((p) => !validStages.has(p.status));

  const move = async (projectId: string, stage: PipelineStage) => {
    const current = projects.find((p) => p.id === projectId);
    if (!current || current.status === stage) return;

    qc.setQueryData<ProjectRow[]>(["projects", "pipeline"], (old) =>
      (old ?? []).map((p) => (p.id === projectId ? { ...p, status: stage } : p)),
    );

    const { error } = await supabase.from("projects").update({ status: stage }).eq("id", projectId);
    if (error) {
      toast.error("Could not move project");
      qc.invalidateQueries({ queryKey: ["projects", "pipeline"] });
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {projects.length} projects · {offPipeline.length} off pipeline
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold leading-[0.95] tracking-tight">
            Pipeline.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Drag a project card between stages to update its status. Projects with legacy statuses appear below.
          </p>
        </div>
        <NewProjectButton clients={clients} />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading pipeline…</div>
      ) : (
        <>
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
                      items.map((p) => (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={() => { setDragId(p.id); setDragging(true); }}
                          onDragEnd={() => { setDragId(null); setOverStage(null); setTimeout(() => setDragging(false), 0); }}
                          onClick={() => {
                            if (dragging) return;
                            router.navigate({
                              to: "/clients/$clientId",
                              params: { clientId: p.client_id },
                              hash: "projects",
                            });
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.navigate({
                                to: "/clients/$clientId",
                                params: { clientId: p.client_id },
                                hash: "projects",
                              });
                            }
                          }}
                          className={`group border border-border rounded-md p-3 bg-background hover:border-foreground/50 transition cursor-pointer active:cursor-grabbing ${
                            dragId === p.id ? "opacity-40" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-display font-semibold text-sm truncate group-hover:underline underline-offset-4">{p.name}</div>
                              <Link
                                to="/clients/$clientId"
                                params={{ clientId: p.client_id }}
                                onClick={(e) => e.stopPropagation()}
                                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground truncate block"
                              >
                                {clientName.get(p.client_id) ?? "—"}
                              </Link>
                              {p.notes && (
                                <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">{p.notes}</p>
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

          {offPipeline.length > 0 && (
            <div className="mt-10">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                Off pipeline · drag onto a stage to bring into flow
              </div>
              <div className="flex flex-wrap gap-2">
                {offPipeline.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    className={`border border-border rounded-md px-3 py-2 bg-card cursor-grab active:cursor-grabbing hover:border-foreground/50 transition ${
                      dragId === p.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-semibold">{p.name}</div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {clientName.get(p.client_id) ?? "—"} · {p.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {projects.length === 0 && (
            <div className="mt-6 border border-dashed border-border rounded-lg p-12 text-center">
              <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/60" />
              <h3 className="mt-4 font-display text-xl font-semibold">No projects yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add a project from a client's page to see it in the pipeline.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewProjectButton({ clients }: { clients: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<PipelineStage>("lead");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setClientId("");
    setName("");
    setStatus("lead");
    setNotes("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!clientId) {
      toast.error("Pick a client");
      return;
    }
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("projects").insert({
      client_id: clientId,
      name: name.trim(),
      status,
      notes: notes.trim() || null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project added");
    qc.invalidateQueries({ queryKey: ["projects", "pipeline"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="h-11 gap-1.5" disabled={clients.length === 0}>
          <Plus className="h-4 w-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add project</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="np-client" className="text-xs">Client</Label>
            <select
              id="np-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="np-name" className="text-xs">Project name</Label>
            <Input
              id="np-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Website redesign"
              className="mt-1.5 h-10"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="np-status" className="text-xs">Stage</Label>
            <select
              id="np-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as PipelineStage)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="np-notes" className="text-xs">Notes (optional)</Label>
            <Textarea
              id="np-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 min-h-[80px]"
              placeholder="Scope, budget, key dates…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
