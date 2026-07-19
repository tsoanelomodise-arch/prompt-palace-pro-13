import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PIPELINE_STAGES, REPEAT_INTERVALS, repeatLabel, DATE_FILTERS, matchesDateFilter, daysUntil, formatShortDate, formatZAR, formatZARCompact, STAGE_WIN_PROBABILITY, type PipelineStage, type RepeatInterval, type DateFilter } from "@/lib/pipeline";
import { PipelineTabs } from "./recurring";
import { GripVertical, Briefcase, Plus, Repeat, Archive, ArchiveRestore, ChevronDown, ChevronRight, CalendarClock, CalendarCheck2, CalendarDays, AlertTriangle, CalendarPlus, Eye, EyeOff, Coins, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { ProjectDatesPopover } from "@/components/ProjectDatesPopover";
import { ProjectValuePopover } from "@/components/ProjectValuePopover";
import { ProjectClientPopover } from "@/components/ProjectClientPopover";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PROJECT_TYPES } from "@/lib/project-types";


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
  repeat_interval: string;
  archived_at: string | null;
  start_date: string | null;
  due_date: string | null;
  delivered_at: string | null;
  next_occurrence_date: string | null;
  opportunity_value: number | null;
};


type ClientLite = { id: string; name: string };

function PipelinePage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PipelineStage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showDelivered, setShowDelivered] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", "pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,notes,client_id,updated_at,repeat_interval,archived_at,start_date,due_date,delivered_at,next_occurrence_date,opportunity_value")
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

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived_at), [projects]);
  const archivedProjects = useMemo(() => projects.filter((p) => !!p.archived_at), [projects]);

  const filteredActive = useMemo(
    () => activeProjects.filter((p) => matchesDateFilter(p.due_date, dateFilter)),
    [activeProjects, dateFilter],
  );

  const boardProjects = useMemo(
    () => (showDelivered ? filteredActive : filteredActive.filter((p) => p.status !== "delivered")),
    [filteredActive, showDelivered],
  );

  const grouped = useMemo(() => {
    const map: Record<PipelineStage, ProjectRow[]> = {
      lead: [], proposal: [], active: [], review: [], delivered: [], lost: [],
    };
    for (const p of boardProjects) {
      if (p.status in map) map[p.status as PipelineStage].push(p);
    }
    return map;
  }, [boardProjects]);

  const validStages = new Set<string>(PIPELINE_STAGES.map((s) => s.id));
  const offPipeline = filteredActive.filter((p) => !validStages.has(p.status));
  const overdueCount = useMemo(
    () => activeProjects.filter((p) => (daysUntil(p.due_date) ?? 0) < 0).length,
    [activeProjects],
  );

  const wipItems = useMemo(
    () =>
      filteredActive
        .filter((p) => p.status === "active" || p.status === "review")
        .sort((a, b) => {
          const ad = daysUntil(a.due_date);
          const bd = daysUntil(b.due_date);
          if (ad === null && bd === null) return 0;
          if (ad === null) return 1;
          if (bd === null) return -1;
          return ad - bd;
        }),
    [filteredActive],
  );
  const wipOverdue = wipItems.filter((p) => (daysUntil(p.due_date) ?? 0) < 0).length;

  const move = async (projectId: string, stage: PipelineStage) => {
    const current = projects.find((p) => p.id === projectId);
    if (!current || current.status === stage) return;

    qc.setQueryData<ProjectRow[]>(["projects", "pipeline"], (old) =>
      (old ?? []).map((p) => (p.id === projectId ? { ...p, status: stage } : p)),
    );

    const nowIso = new Date().toISOString();
    const updates: { status: PipelineStage; delivered_at?: string | null } = { status: stage };
    if (stage === "delivered" && !current.delivered_at) updates.delivered_at = nowIso;
    if (stage !== "delivered" && current.delivered_at) updates.delivered_at = null;

    const { error } = await supabase.from("projects").update(updates).eq("id", projectId);
    if (error) {
      toast.error("Could not move project");
      qc.invalidateQueries({ queryKey: ["projects", "pipeline"] });
      return;
    }

    // Auto-create the next occurrence when a repeating project is delivered
    if (stage === "delivered" && current.repeat_interval && current.repeat_interval !== "none") {
      const nextDue = current.next_occurrence_date ?? null;
      const { error: cloneErr } = await supabase.from("projects").insert({
        client_id: current.client_id,
        name: current.name,
        status: "lead",
        notes: current.notes,
        repeat_interval: current.repeat_interval,
        due_date: nextDue,
        created_by: user?.id ?? null,
      });
      if (cloneErr) {
        toast.error(`Delivered, but could not queue next: ${cloneErr.message}`);
      } else {
        toast.success(`Delivered · queued next ${repeatLabel(current.repeat_interval).toLowerCase()} occurrence`);
        qc.invalidateQueries({ queryKey: ["projects", "pipeline"] });
        qc.invalidateQueries({ queryKey: ["projects", current.client_id] });
      }
    }
  };

  const setArchived = async (projectId: string, archived: boolean) => {
    qc.setQueryData<ProjectRow[]>(["projects", "pipeline"], (old) =>
      (old ?? []).map((p) =>
        p.id === projectId ? { ...p, archived_at: archived ? new Date().toISOString() : null } : p,
      ),
    );
    const { error } = await supabase
      .from("projects")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", projectId);
    if (error) {
      toast.error(archived ? "Could not archive" : "Could not restore");
      qc.invalidateQueries({ queryKey: ["projects", "pipeline"] });
      return;
    }
    toast.success(archived ? "Archived" : "Restored");
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {activeProjects.length} active · {archivedProjects.length} archived · {offPipeline.length} off pipeline
            {overdueCount > 0 && (
              <> · <span className="text-destructive">{overdueCount} overdue</span></>
            )}
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold leading-[0.95] tracking-tight">
            Pipeline.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Drag a project card between stages to update its status. Projects with legacy statuses appear below.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PipelineTabs current="pipeline" />
          <NewProjectButton clients={clients} />
        </div>
      </div>

      <PipelineValueDashboard projects={activeProjects} />

      <div className="flex flex-wrap items-center gap-2 mb-6">

        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mr-1">Due</span>
        {DATE_FILTERS.map((f) => {
          const isActive = dateFilter === f.id;
          const count =
            f.id === "all"
              ? activeProjects.length
              : activeProjects.filter((p) => matchesDateFilter(p.due_date, f.id)).length;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setDateFilter(f.id)}
              className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1.5 ${
                isActive
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
              }`}
            >
              {f.id === "overdue" && <AlertTriangle className="h-3 w-3" />}
              {f.label}
              <span className={`tabular-nums ${isActive ? "opacity-80" : "opacity-60"}`}>{count}</span>
            </button>
          );
        })}
        <span className="w-px h-4 bg-border mx-1" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setShowDelivered((v) => !v)}
          className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1.5 ${
            showDelivered
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
          }`}
          title={showDelivered ? "Hide delivered projects from the board" : "Show delivered projects on the board"}
        >
          {showDelivered ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          Delivered
          <span className={`tabular-nums ${showDelivered ? "opacity-80" : "opacity-60"}`}>
            {grouped.delivered.length}
          </span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading pipeline…</div>
      ) : (
        <>
          {wipItems.length > 0 && (
            <div className="mb-6 border border-border rounded-lg bg-card">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Work in progress
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground bg-paper-soft rounded-full px-2 py-0.5">
                    {wipItems.length}
                  </span>
                  {wipOverdue > 0 && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border border-destructive/40 bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" /> {wipOverdue} overdue
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Active + review
                </span>
              </div>
              <ul className="divide-y divide-border">
                {wipItems.map((p) => {
                  const meta = PIPELINE_STAGES.find((s) => s.id === p.status);
                  const d = daysUntil(p.due_date);
                  const overdue = d !== null && d < 0;
                  return (
                    <li
                      key={p.id}
                      className="px-4 py-2.5 flex items-center gap-3 hover:bg-paper-soft/40 transition"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          router.navigate({
                            to: "/clients/$clientId",
                            params: { clientId: p.client_id },
                            hash: "projects",
                          })
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="font-display font-semibold text-sm truncate hover:underline underline-offset-4">
                          {p.name}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                          {clientName.get(p.client_id) ?? "—"}
                        </div>
                      </button>
                      {meta && (
                        <span
                          className={`font-mono text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 ${
                            p.status === "review"
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {meta.label}
                        </span>
                      )}
                      <ProjectDatesPopover
                        project={p}
                        align="end"
                        trigger={
                          <button
                            type="button"
                            className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 cursor-pointer hover:border-foreground ${
                              p.due_date
                                ? overdue
                                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                                  : "border-border bg-paper-soft"
                                : "border-dashed border-border text-muted-foreground"
                            }`}
                            title={
                              p.due_date
                                ? overdue
                                  ? `Overdue by ${Math.abs(d!)}d`
                                  : d !== null
                                    ? `Due in ${d}d`
                                    : undefined
                                : "Set due date"
                            }
                          >
                            {p.due_date ? (
                              <>
                                <CalendarClock className="h-2.5 w-2.5" />
                                {formatShortDate(p.due_date)}
                                {overdue && <AlertTriangle className="h-2.5 w-2.5" />}
                              </>
                            ) : (
                              <>
                                <CalendarPlus className="h-2.5 w-2.5" /> Set due
                              </>
                            )}
                          </button>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${showDelivered ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
            {(showDelivered ? PIPELINE_STAGES : PIPELINE_STAGES.filter((s) => s.id !== "delivered")).map((stage) => {
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
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                <ProjectValuePopover
                                  projectId={p.id}
                                  value={p.opportunity_value}
                                  trigger={
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border rounded-full px-1.5 py-0.5 cursor-pointer hover:border-foreground transition ${
                                        p.opportunity_value != null && p.opportunity_value > 0
                                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                          : "border-dashed border-border text-muted-foreground"
                                      }`}
                                      title={p.opportunity_value != null ? formatZAR(p.opportunity_value) : "Set opportunity value"}
                                    >
                                      <Coins className="h-2.5 w-2.5" />
                                      {p.opportunity_value != null && p.opportunity_value > 0
                                        ? formatZARCompact(p.opportunity_value)
                                        : "Set value"}
                                    </button>
                                  }
                                />
                                {p.start_date && <DatePill icon="start" date={p.start_date} />}
                                {p.due_date && <DatePill icon="due" date={p.due_date} />}
                                {p.status === "delivered" && p.delivered_at && (
                                  <DatePill icon="delivered" date={p.delivered_at} />
                                )}
                                {p.repeat_interval !== "none" && p.next_occurrence_date && (
                                  <DatePill icon="next" date={p.next_occurrence_date} />
                                )}
                              </div>
                              {p.repeat_interval && p.repeat_interval !== "none" && (

                                <div className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
                                  <Repeat className="h-2.5 w-2.5" /> {repeatLabel(p.repeat_interval)}
                                </div>
                              )}
                              {p.notes && (
                                <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">{p.notes}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-center gap-1 shrink-0">
                              <ProjectDatesPopover
                                project={p}
                                trigger={
                                  <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground"
                                    title="Edit dates"
                                    aria-label="Edit project dates"
                                  >
                                    <CalendarPlus className="h-3.5 w-3.5" />
                                  </button>
                                }
                              />
                              <ProjectClientPopover
                                projectId={p.id}
                                currentClientId={p.client_id}
                                trigger={
                                  <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground"
                                    title="Reassign client"
                                    aria-label="Reassign client"
                                  >
                                    <Users className="h-3.5 w-3.5" />
                                  </button>
                                }
                              />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setArchived(p.id, true); }}
                                className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground"
                                title="Archive"
                                aria-label="Archive project"
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </button>
                              <DeleteProjectButton
                                projectIds={p.id}
                                projectName={p.name}
                                clientId={p.client_id}
                                trigger={
                                  <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                                    title="Delete project"
                                    aria-label="Delete project"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                }
                              />
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

          {archivedProjects.length > 0 && (
            <div className="mt-10">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground mb-3"
              >
                {showArchived ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <Archive className="h-3 w-3" /> Archived · {archivedProjects.length}
              </button>
              {showArchived && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {archivedProjects.map((p) => (
                    <div
                      key={p.id}
                      className="group border border-border rounded-md px-3 py-2 bg-card/50 hover:border-foreground/50 transition flex items-start gap-2"
                    >
                      <Briefcase className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() =>
                            router.navigate({
                              to: "/clients/$clientId",
                              params: { clientId: p.client_id },
                              hash: "projects",
                            })
                          }
                          className="text-sm font-semibold truncate block text-left hover:underline underline-offset-4 w-full"
                        >
                          {p.name}
                        </button>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                          {clientName.get(p.client_id) ?? "—"} · {p.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setArchived(p.id, false)}
                          className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground"
                          title="Restore"
                          aria-label="Restore project"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        </button>
                        <DeleteProjectButton
                          projectIds={p.id}
                          projectName={p.name}
                          clientId={p.client_id}
                          trigger={
                            <button
                              type="button"
                              className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                              title="Delete project"
                              aria-label="Delete project"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
  const [repeatInterval, setRepeatInterval] = useState<RepeatInterval>("none");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [nextOccurrenceDate, setNextOccurrenceDate] = useState("");
  const [opportunityValue, setOpportunityValue] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setClientId("");
    setName("");
    setStatus("lead");
    setNotes("");
    setRepeatInterval("none");
    setStartDate("");
    setDueDate("");
    setNextOccurrenceDate("");
    setOpportunityValue("");
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
    const stamp = status === "delivered" ? new Date().toISOString() : null;
    const parsedValue = opportunityValue.trim() === "" ? null : Number(opportunityValue);
    const { error } = await supabase.from("projects").insert({
      client_id: clientId,
      name: name.trim(),
      status,
      notes: notes.trim() || null,
      repeat_interval: repeatInterval,
      start_date: startDate || null,
      due_date: dueDate || null,
      next_occurrence_date: repeatInterval === "none" ? null : nextOccurrenceDate || null,
      opportunity_value: Number.isFinite(parsedValue) && (parsedValue as number) >= 0 ? parsedValue : null,
      delivered_at: stamp,
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
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); else if (clients.length === 0) setAddingClient(true); }}>
      <DialogTrigger asChild>
        <Button className="h-11 gap-1.5">
          <Plus className="h-4 w-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add project</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="np-client" className="text-xs">Client</Label>
              <button
                type="button"
                onClick={() => setAddingClient((v) => !v)}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                {addingClient ? "Pick existing" : "+ New client"}
              </button>
            </div>
            {addingClient ? (
              <div className="mt-1.5 flex gap-2">
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Client name"
                  className="h-10"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={creatingClient || !newClientName.trim()}
                  onClick={async () => {
                    if (!user) return;
                    setCreatingClient(true);
                    const { data, error } = await supabase
                      .from("clients")
                      .insert({ name: newClientName.trim(), status: "active", created_by: user.id })
                      .select("id,name")
                      .single();
                    setCreatingClient(false);
                    if (error) { toast.error(error.message); return; }
                    toast.success("Client added");
                    qc.invalidateQueries({ queryKey: ["clients", "lite"] });
                    qc.invalidateQueries({ queryKey: ["clients"] });
                    setClientId(data.id);
                    setNewClientName("");
                    setAddingClient(false);
                  }}
                >
                  {creatingClient ? "Adding…" : "Add"}
                </Button>
              </div>
            ) : (
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
            )}
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
            <Label htmlFor="np-repeat" className="text-xs">Repeats</Label>
            <select
              id="np-repeat"
              value={repeatInterval}
              onChange={(e) => setRepeatInterval(e.target.value as RepeatInterval)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {REPEAT_INTERVALS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Repeating projects auto-queue a fresh Lead when moved to Delivered.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="np-start" className="text-xs">Start date</Label>
              <Input
                id="np-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 h-10"
              />
            </div>
            <div>
              <Label htmlFor="np-due" className="text-xs">Due date</Label>
              <Input
                id="np-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 h-10"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="np-value" className="text-xs">Opportunity value (ZAR)</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">R</span>
              <Input
                id="np-value"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={opportunityValue}
                onChange={(e) => setOpportunityValue(e.target.value)}
                placeholder="0"
                className="h-10"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Estimated deal size in South African Rand — used for pipeline totals.
            </p>
          </div>

          {repeatInterval !== "none" && (
            <div>
              <Label htmlFor="np-next" className="text-xs">Next occurrence date</Label>
              <Input
                id="np-next"
                type="date"
                value={nextOccurrenceDate}
                onChange={(e) => setNextOccurrenceDate(e.target.value)}
                className="mt-1.5 h-10"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Used as the due date for the next auto-queued occurrence.
              </p>
            </div>
          )}
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

function DatePill({ icon, date }: { icon: "start" | "due" | "delivered" | "next"; date: string }) {
  const isDue = icon === "due";
  const days = isDue ? daysUntil(date) : null;
  const overdue = isDue && days !== null && days < 0;
  const soon = isDue && days !== null && days >= 0 && days <= 3;

  const Icon =
    icon === "start" ? CalendarDays :
    icon === "due" ? CalendarClock :
    icon === "delivered" ? CalendarCheck2 :
    Repeat;

  const label =
    icon === "start" ? "Start" :
    icon === "due" ? "Due" :
    icon === "delivered" ? "Delivered" :
    "Next";

  const cls = overdue
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : soon
      ? "border-foreground/40 bg-paper-soft text-foreground"
      : "border-border text-muted-foreground";

  const display = icon === "delivered"
    ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : formatShortDate(date);

  return (
    <span
      title={
        icon === "due" && days !== null
          ? overdue ? `Overdue by ${Math.abs(days)}d` : `Due in ${days}d`
          : undefined
      }
      className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border rounded-full px-1.5 py-0.5 ${cls}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label} · {display}
      {overdue && <AlertTriangle className="h-2.5 w-2.5" />}
    </span>
  );
}

function PipelineValueDashboard({ projects }: { projects: ProjectRow[] }) {
  const { totalOpen, weighted, wonYtd, byStage, activeCount, withValue } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const byStage: Record<PipelineStage, { total: number; count: number }> = {
      lead: { total: 0, count: 0 },
      proposal: { total: 0, count: 0 },
      active: { total: 0, count: 0 },
      review: { total: 0, count: 0 },
      delivered: { total: 0, count: 0 },
      lost: { total: 0, count: 0 },
    };
    let totalOpen = 0;
    let weighted = 0;
    let wonYtd = 0;
    let withValue = 0;
    for (const p of projects) {
      const stage = (p.status in byStage ? p.status : null) as PipelineStage | null;
      if (!stage) continue;
      const v = p.opportunity_value ?? 0;
      byStage[stage].count += 1;
      byStage[stage].total += v;
      if (v > 0) withValue += 1;
      if (stage !== "delivered" && stage !== "lost") {
        totalOpen += v;
        weighted += v * STAGE_WIN_PROBABILITY[stage];
      }
      if (stage === "delivered" && p.delivered_at) {
        const d = new Date(p.delivered_at);
        if (d.getFullYear() === year) wonYtd += v;
      }
    }
    const activeCount = projects.filter((p) => p.status !== "delivered" && p.status !== "lost").length;
    return { totalOpen, weighted, wonYtd, byStage, activeCount, withValue };
  }, [projects]);

  const maxStageTotal = Math.max(
    1,
    ...PIPELINE_STAGES.filter((s) => s.id !== "lost").map((s) => byStage[s.id].total),
  );

  return (
    <div className="mb-8 border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Opportunity value · ZAR
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          {withValue}/{activeCount} priced
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <div className="px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Open pipeline</div>
          <div className="mt-1 font-display text-2xl md:text-3xl font-semibold tabular-nums">
            {formatZAR(totalOpen)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Lead → Review, unweighted
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Weighted forecast</div>
          <div className="mt-1 font-display text-2xl md:text-3xl font-semibold tabular-nums">
            {formatZAR(weighted)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Value × stage win probability
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Delivered · {new Date().getFullYear()}
          </div>
          <div className="mt-1 font-display text-2xl md:text-3xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatZAR(wonYtd)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Year to date</div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 border-t border-border">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          By stage
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PIPELINE_STAGES.map((s) => {
            const { total, count } = byStage[s.id];
            const pct = s.id === "lost" ? 0 : Math.round((total / maxStageTotal) * 100);
            const barCls =
              s.id === "delivered"
                ? "bg-emerald-500/70"
                : s.id === "lost"
                  ? "bg-muted-foreground/30"
                  : "bg-foreground/70";
            return (
              <div key={s.id} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                    {s.label}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                    {count}
                  </span>
                </div>
                <div className="mt-1 font-display text-sm font-semibold tabular-nums truncate" title={formatZAR(total)}>
                  {formatZARCompact(total)}
                </div>
                <div className="mt-1 h-1 rounded-full bg-paper-soft overflow-hidden">
                  <div className={`h-full ${barCls} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



