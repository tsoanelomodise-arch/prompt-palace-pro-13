import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { IMPL_STAGES, type ImplStage } from "@/lib/implementation";
import { daysUntil, formatShortDate } from "@/lib/pipeline";
import { PipelineTabs } from "./recurring";
import { listTeamDirectory } from "@/lib/team-directory.functions";
import {
  Briefcase,
  CalendarClock,
  AlertTriangle,
  ArrowRight,
  Users,
  Layers,
  Hourglass,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/implementation")({
  component: ImplementationPage,
});

type ProjectRow = {
  id: string;
  name: string;
  client_id: string;
  status: string;
  impl_stage: string | null;
  due_date: string | null;
  updated_at: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  status: string;
  assignee_id: string | null;
  due_date: string | null;
};

type ClientLite = { id: string; name: string };
type Member = { id: string; email: string };

function ImplementationPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<ImplStage | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", "implementation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,client_id,status,impl_stage,due_date,updated_at")
        .is("archived_at", null)
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

  const { data: tasks = [] } = useQuery({
    queryKey: ["project_tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("id,project_id,title,status,assignee_id,due_date");
      if (error) throw error;
      return data as TaskRow[];
    },
  });

  const teamFn = useServerFn(listTeamDirectory);
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["team", "directory"],
    queryFn: () => teamFn(),
  });

  const clientName = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const memberLabel = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => m.set(x.id, x.email.split("@")[0]));
    return m;
  }, [members]);

  const implProjects = useMemo(
    () => projects.filter((p) => p.impl_stage),
    [projects],
  );
  const candidateProjects = useMemo(
    () => projects.filter((p) => !p.impl_stage),
    [projects],
  );

  const grouped = useMemo(() => {
    const map: Record<ImplStage, ProjectRow[]> = {
      kickoff: [], build: [], qa: [], launch: [], done: [],
    };
    for (const p of implProjects) {
      if (p.impl_stage && p.impl_stage in map) map[p.impl_stage as ImplStage].push(p);
    }
    return map;
  }, [implProjects]);

  const tasksByProject = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of tasks) {
      const arr = m.get(t.project_id) ?? [];
      arr.push(t);
      m.set(t.project_id, arr);
    }
    return m;
  }, [tasks]);

  // Only surface tasks that live under an implementing project
  const implProjectIds = useMemo(() => new Set(implProjects.map((p) => p.id)), [implProjects]);
  const implTasks = useMemo(
    () => tasks.filter((t) => implProjectIds.has(t.project_id)),
    [tasks, implProjectIds],
  );

  const openTasks = implTasks.filter((t) => t.status !== "done");
  const overdueTasks = openTasks.filter((t) => (daysUntil(t.due_date) ?? 0) < 0);
  const weekTasks = openTasks.filter((t) => {
    const d = daysUntil(t.due_date);
    return d !== null && d >= 0 && d <= 7;
  });

  // Dashboard rollups
  const workloadByAssignee = useMemo(() => {
    const m = new Map<string | null, { doing: number; todo: number; blocked: number }>();
    for (const t of openTasks) {
      const key = t.assignee_id;
      const cur = m.get(key) ?? { doing: 0, todo: 0, blocked: 0 };
      if (t.status === "doing") cur.doing++;
      else if (t.status === "blocked") cur.blocked++;
      else if (t.status === "todo") cur.todo++;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({
        id,
        label: id ? memberLabel.get(id) ?? "member" : "Unassigned",
        ...v,
        total: v.doing + v.todo + v.blocked,
      }))
      .sort((a, b) => b.total - a.total);
  }, [openTasks, memberLabel]);

  const byClient = useMemo(() => {
    const m = new Map<string, { projects: number; open: number; overdue: number }>();
    for (const p of implProjects) {
      const cur = m.get(p.client_id) ?? { projects: 0, open: 0, overdue: 0 };
      cur.projects++;
      const ts = tasksByProject.get(p.id) ?? [];
      for (const t of ts) {
        if (t.status !== "done") {
          cur.open++;
          if ((daysUntil(t.due_date) ?? 0) < 0) cur.overdue++;
        }
      }
      m.set(p.client_id, cur);
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, name: clientName.get(id) ?? "—", ...v }))
      .sort((a, b) => b.open - a.open || b.projects - a.projects);
  }, [implProjects, tasksByProject, clientName]);

  const setStage = async (projectId: string, stage: ImplStage | null) => {
    const prev = projects.find((p) => p.id === projectId);
    qc.setQueryData<ProjectRow[]>(["projects", "implementation"], (old) =>
      (old ?? []).map((p) => (p.id === projectId ? { ...p, impl_stage: stage } : p)),
    );
    const { error } = await supabase
      .from("projects")
      .update({ impl_stage: stage })
      .eq("id", projectId);
    if (error) {
      toast.error("Could not update stage");
      qc.invalidateQueries({ queryKey: ["projects", "implementation"] });
      return;
    }
    toast.success(stage ? `Moved to ${stage}` : `Removed from implementation`);
    void prev;
  };

  const addToImplementation = async (projectId: string) => {
    await setStage(projectId, "kickoff");
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {implProjects.length} implementing · {openTasks.length} open tasks
            {overdueTasks.length > 0 && (
              <> · <span className="text-destructive">{overdueTasks.length} overdue</span></>
            )}
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold leading-[0.95] tracking-tight">
            Implementation.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Drag projects between delivery stages. Click a project to open its task kanban.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PipelineTabs current="implementation" />
        </div>
      </div>

      {/* Add existing project */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Add project to implementation</h2>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {candidateProjects.length} available
          </span>
        </div>
        {candidateProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All active projects are already on the board. Create one from{" "}
            <Link to="/pipeline" className="underline">Pipeline</Link>.
          </p>
        ) : (
          <div className="flex items-center gap-2 max-w-xl">
            <Select
              onValueChange={(v) => addToImplementation(v)}
              value=""
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Pick a project to start implementing…" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {candidateProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {clientName.get(p.client_id) ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Layers className="h-4 w-4" />} label="Stage throughput">
          <div className="mt-2 space-y-1.5">
            {IMPL_STAGES.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-mono tabular-nums">{grouped[s.id].length}</span>
              </div>
            ))}
          </div>
        </StatCard>

        <StatCard icon={<Hourglass className="h-4 w-4" />} label="Upcoming & overdue">
          <div className="mt-2 space-y-1.5 text-sm">
            <Row label="Overdue" value={overdueTasks.length} tone={overdueTasks.length ? "danger" : undefined} />
            <Row label="Due this week" value={weekTasks.length} />
            <Row label="Open total" value={openTasks.length} />
            <Row label="Done" value={implTasks.length - openTasks.length} tone="muted" />
          </div>
        </StatCard>

        <StatCard icon={<Users className="h-4 w-4" />} label="Workload by assignee">
          {workloadByAssignee.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No open tasks yet.</p>
          ) : (
            <div className="mt-2 space-y-1.5 text-sm max-h-[9rem] overflow-y-auto pr-1">
              {workloadByAssignee.slice(0, 8).map((w) => (
                <div key={w.id ?? "unassigned"} className="flex items-center justify-between gap-2">
                  <span className="truncate text-muted-foreground">{w.label}</span>
                  <span className="font-mono text-[11px] tabular-nums flex items-center gap-1">
                    {w.doing > 0 && <Pill tone="active">{w.doing} doing</Pill>}
                    {w.blocked > 0 && <Pill tone="danger">{w.blocked} blk</Pill>}
                    {w.todo > 0 && <Pill>{w.todo} todo</Pill>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </StatCard>

        <StatCard icon={<Briefcase className="h-4 w-4" />} label="Per-client rollup">
          {byClient.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No implementing projects yet.</p>
          ) : (
            <div className="mt-2 space-y-1.5 text-sm max-h-[9rem] overflow-y-auto pr-1">
              {byClient.slice(0, 8).map((c) => (
                <Link
                  key={c.id}
                  to="/clients/$clientId"
                  params={{ clientId: c.id }}
                  hash="projects"
                  className="flex items-center justify-between gap-2 hover:underline underline-offset-4"
                >
                  <span className="truncate">{c.name}</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground flex items-center gap-1.5">
                    {c.projects}p · {c.open} open
                    {c.overdue > 0 && <Pill tone="danger">{c.overdue}</Pill>}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </StatCard>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {IMPL_STAGES.map((stage) => {
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
                  if (dragId) setStage(dragId, stage.id);
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
                    items.map((p) => {
                      const ts = tasksByProject.get(p.id) ?? [];
                      const open = ts.filter((t) => t.status !== "done").length;
                      const done = ts.length - open;
                      const overdue = ts.filter(
                        (t) => t.status !== "done" && (daysUntil(t.due_date) ?? 0) < 0,
                      ).length;
                      const projDue = daysUntil(p.due_date);
                      const projOverdue = projDue !== null && projDue < 0;
                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={() => setDragId(p.id)}
                          onDragEnd={() => { setDragId(null); setOverStage(null); }}
                          className="group rounded-md border border-border bg-paper hover:border-foreground transition p-2.5"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              router.navigate({
                                to: "/implementation/$projectId",
                                params: { projectId: p.id },
                              })
                            }
                            className="text-left w-full"
                          >
                            <div className="font-display font-semibold text-sm leading-snug group-hover:underline underline-offset-4">
                              {p.name}
                            </div>
                            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate mt-0.5">
                              {clientName.get(p.client_id) ?? "—"}
                            </div>
                          </button>
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <Pill tone={open > 0 ? "active" : "muted"}>{open} open</Pill>
                            {done > 0 && <Pill tone="muted">{done} done</Pill>}
                            {overdue > 0 && <Pill tone="danger">{overdue} overdue</Pill>}
                            {p.due_date && (
                              <span
                                className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 ${
                                  projOverdue
                                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                                    : "border-border bg-paper-soft text-muted-foreground"
                                }`}
                              >
                                <CalendarClock className="h-2.5 w-2.5" />
                                {formatShortDate(p.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {void user}
    </div>
  );
}

function StatCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone?: "danger" | "muted" }) {
  return (
    <div className="flex items-center justify-between">
      <span className={tone === "muted" ? "text-muted-foreground/70" : "text-muted-foreground"}>{label}</span>
      <span
        className={`font-mono tabular-nums ${
          tone === "danger" && value > 0 ? "text-destructive font-semibold" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "active" | "danger" | "muted";
}) {
  const cls =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "active"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : tone === "muted"
          ? "border-border text-muted-foreground/70"
          : "border-border bg-paper-soft text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center font-mono text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 ${cls}`}
    >
      {children}
    </span>
  );
}
