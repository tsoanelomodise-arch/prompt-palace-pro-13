import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  PIPELINE_STAGES,
  REPEAT_INTERVALS,
  repeatLabel,
  type PipelineStage,
  type RepeatInterval,
} from "@/lib/pipeline";
import { Repeat, CheckCircle2, KanbanSquare, Briefcase, CalendarClock, AlertTriangle, CalendarPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { daysUntil, formatShortDate } from "@/lib/pipeline";
import { ProjectDatesPopover } from "@/components/ProjectDatesPopover";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";

export const Route = createFileRoute("/_authenticated/recurring")({
  component: RecurringDashboard,
});

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  client_id: string;
  created_at: string;
  updated_at: string;
  repeat_interval: string;
  archived_at: string | null;
  start_date: string | null;
  due_date: string | null;
  delivered_at: string | null;
  next_occurrence_date: string | null;
};

type ClientLite = { id: string; name: string };

const CADENCES: RepeatInterval[] = ["weekly", "monthly", "quarterly", "yearly"];

const stageMeta = (s: string) => PIPELINE_STAGES.find((x) => x.id === s);

function RecurringDashboard() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", "recurring"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,notes,client_id,created_at,updated_at,repeat_interval,archived_at,start_date,due_date,delivered_at,next_occurrence_date")
        .neq("repeat_interval", "none")
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

  // A "series" = same client + same project name. Compute totals + last delivered.
  type Series = {
    key: string;
    clientId: string;
    name: string;
    interval: RepeatInterval;
    current: ProjectRow | null;
    wip: ProjectRow[];
    occurrences: number;
    lastDeliveredAt: string | null;
    nextDate: string | null;
    allIds: string[];
  };

  const WIP_STAGES = new Set<string>(["active", "review"]);

  const seriesList = useMemo<Series[]>(() => {
    const byKey = new Map<string, ProjectRow[]>();
    for (const p of projects) {
      if (p.archived_at) continue;
      const k = `${p.client_id}::${p.name.toLowerCase().trim()}`;
      const arr = byKey.get(k) ?? [];
      arr.push(p);
      byKey.set(k, arr);
    }
    const out: Series[] = [];
    for (const [, rows] of byKey) {
      const inFlight = rows
        .filter((r) => r.status !== "delivered" && r.status !== "lost")
        .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))[0];
      const anyRow =
        inFlight ?? rows.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))[0];
      const deliveredRows = rows
        .filter((r) => r.status === "delivered")
        .sort((a, b) => {
          const ad = a.delivered_at ?? a.updated_at;
          const bd = b.delivered_at ?? b.updated_at;
          return +new Date(bd) - +new Date(ad);
        });
      const wip = rows
        .filter((r) => WIP_STAGES.has(r.status))
        .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
      // Prefer the next_occurrence_date on any current/wip row; else the due_date of the earliest in-flight.
      const nextDate =
        inFlight?.next_occurrence_date ??
        wip[0]?.next_occurrence_date ??
        inFlight?.due_date ??
        deliveredRows[0]?.next_occurrence_date ??
        null;
      out.push({
        key: `${anyRow.client_id}::${anyRow.name.toLowerCase().trim()}`,
        clientId: anyRow.client_id,
        name: anyRow.name,
        interval: anyRow.repeat_interval as RepeatInterval,
        current: inFlight ?? null,
        wip,
        occurrences: rows.length,
        lastDeliveredAt: deliveredRows[0]?.delivered_at ?? deliveredRows[0]?.updated_at ?? null,
        nextDate,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const nextDueForSeries = (s: Series): string | null => s.nextDate;

  const grouped = useMemo(() => {
    const g: Record<RepeatInterval, Series[]> = {
      none: [],
      weekly: [],
      monthly: [],
      quarterly: [],
      yearly: [],
    };
    for (const s of seriesList) {
      if (s.interval in g) g[s.interval].push(s);
    }
    return g;
  }, [seriesList]);

  const totals = {
    series: seriesList.length,
    inFlight: seriesList.filter((s) => s.current).length,
    wip: seriesList.reduce((n, s) => n + s.wip.length, 0),
    dueNext: seriesList.filter((s) => !s.current).length,
  };

  const markDelivered = async (s: Series) => {
    if (!s.current) {
      // No in-flight occurrence — queue a new lead directly.
      const { error } = await supabase.from("projects").insert({
        client_id: s.clientId,
        name: s.name,
        status: "lead",
        repeat_interval: s.interval,
        due_date: nextDueForSeries(s),
        created_by: user?.id ?? null,
      });
      if (error) {
        toast.error(`Could not queue next: ${error.message}`);
        return;
      }
      toast.success(`Queued next ${repeatLabel(s.interval).toLowerCase()} occurrence`);
      qc.invalidateQueries({ queryKey: ["projects"] });
      return;
    }

    const current = s.current;
    const { error } = await supabase
      .from("projects")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", current.id);
    if (error) {
      toast.error("Could not mark delivered");
      return;
    }
    const { error: cloneErr } = await supabase.from("projects").insert({
      client_id: current.client_id,
      name: current.name,
      status: "lead",
      notes: current.notes,
      repeat_interval: current.repeat_interval,
      due_date: current.next_occurrence_date ?? nextDueForSeries(s),
      created_by: user?.id ?? null,
    });
    if (cloneErr) {
      toast.error(`Delivered, but could not queue next: ${cloneErr.message}`);
    } else {
      toast.success(`Delivered · queued next ${repeatLabel(current.repeat_interval).toLowerCase()}`);
    }
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-6 pb-8 border-b border-border">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {totals.series} series · {totals.wip} in progress · {totals.inFlight} in flight · {totals.dueNext} awaiting next
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold leading-[0.95] tracking-tight">
            Recurring.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Retainers and repeating engagements grouped by cadence. Mark an occurrence delivered to
            queue the next one automatically.
          </p>
        </div>
        <PipelineTabs current="recurring" />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading recurring work…</div>
      ) : seriesList.length === 0 ? (
        <div className="mt-6 border border-dashed border-border rounded-lg p-12 text-center">
          <Repeat className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <h3 className="mt-4 font-display text-xl font-semibold">No recurring projects yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Set a project's <span className="font-mono">Repeat</span> interval on the pipeline to
            see it here.
          </p>
          <Link to="/pipeline" className="mt-5 inline-block">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md border border-border hover:border-foreground transition">
              <KanbanSquare className="h-3.5 w-3.5" /> Go to pipeline
            </span>
          </Link>
        </div>
      ) : (
        <div className="space-y-10 mt-8">
          {CADENCES.map((cad) => {
            const rows = grouped[cad];
            if (rows.length === 0) return null;
            return (
              <section key={cad}>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    {repeatLabel(cad)}
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {rows.length} series
                  </span>
                </div>
                <div className="border border-border rounded-lg overflow-hidden bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-paper-soft/50 border-b border-border">
                      <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3">Current stage</th>
                        <th className="px-4 py-3">Next occurrence</th>
                        <th className="px-4 py-3">Work in progress</th>
                        <th className="px-4 py-3">Last delivered</th>
                        <th className="px-4 py-3 text-center">Occurrences</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => {
                        const meta = s.current ? stageMeta(s.current.status) : null;
                        return (
                          <tr
                            key={s.key}
                            className="border-b border-border last:border-0 hover:bg-paper-soft/40 transition"
                          >
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() =>
                                  s.current
                                    ? router.navigate({
                                        to: "/clients/$clientId",
                                        params: { clientId: s.clientId },
                                        hash: "projects",
                                      })
                                    : router.navigate({
                                        to: "/clients/$clientId",
                                        params: { clientId: s.clientId },
                                        hash: "projects",
                                      })
                                }
                                className="font-display font-semibold text-left hover:underline underline-offset-4"
                              >
                                {s.name}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                to="/clients/$clientId"
                                params={{ clientId: s.clientId }}
                                className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                              >
                                {clientName.get(s.clientId) ?? "—"}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              {meta ? (
                                <StagePill stage={meta.id} label={meta.label} />
                              ) : (
                                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                  awaiting next
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {(() => {
                                const target = s.current ?? s.wip[0] ?? null;
                                const pill = s.nextDate ? (() => {
                                  const d = daysUntil(s.nextDate);
                                  const overdue = d !== null && d < 0;
                                  return (
                                    <span
                                      title={overdue ? `Overdue by ${Math.abs(d!)}d` : d !== null ? `In ${d}d` : undefined}
                                      className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 ${
                                        overdue
                                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                                          : "border-border text-foreground bg-paper-soft"
                                      }`}
                                    >
                                      <CalendarClock className="h-2.5 w-2.5" />
                                      {formatShortDate(s.nextDate!)}
                                      {overdue && <AlertTriangle className="h-2.5 w-2.5" />}
                                    </span>
                                  );
                                })() : (
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border border-dashed border-border rounded-full px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-foreground">
                                    <CalendarPlus className="h-2.5 w-2.5" /> Set date
                                  </span>
                                );
                                return target ? (
                                  <ProjectDatesPopover
                                    project={target}
                                    align="start"
                                    trigger={<button type="button" className="cursor-pointer">{pill}</button>}
                                  />
                                ) : (
                                  <span className="text-muted-foreground/60">—</span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3">
                              {s.wip.length === 0 ? (
                                <span className="text-muted-foreground/60">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {s.wip.map((w) => {
                                    const wm = stageMeta(w.status);
                                    const dd = daysUntil(w.due_date);
                                    const wOverdue = dd !== null && dd < 0;
                                    return (
                                      <span key={w.id} className="inline-flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            router.navigate({
                                              to: "/clients/$clientId",
                                              params: { clientId: w.client_id },
                                              hash: "projects",
                                            })
                                          }
                                          title={`Updated ${formatDistanceToNow(new Date(w.updated_at), { addSuffix: true })}${w.due_date ? ` · Due ${formatShortDate(w.due_date)}` : ""}`}
                                          className="inline-flex items-center gap-1"
                                        >
                                          {wm && <StagePill stage={wm.id} label={wm.label} />}
                                        </button>
                                        <ProjectDatesPopover
                                          project={w}
                                          align="start"
                                          trigger={
                                            <button
                                              type="button"
                                              className={`inline-flex items-center gap-0.5 font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-full border cursor-pointer hover:border-foreground ${
                                                w.due_date
                                                  ? wOverdue
                                                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                                                    : "border-border text-muted-foreground"
                                                  : "border-dashed border-border text-muted-foreground"
                                              }`}
                                              title="Edit dates"
                                            >
                                              {w.due_date ? (
                                                <>
                                                  <CalendarClock className="h-2.5 w-2.5" />
                                                  {formatShortDate(w.due_date)}
                                                </>
                                              ) : (
                                                <>
                                                  <CalendarPlus className="h-2.5 w-2.5" /> Date
                                                </>
                                              )}
                                            </button>
                                          }
                                        />
                                      </span>
                                    );
                                  })}
                                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground self-center">
                                    ×{s.wip.length}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {s.lastDeliveredAt ? (
                                <span title={format(new Date(s.lastDeliveredAt), "PPp")}>
                                  {formatDistanceToNow(new Date(s.lastDeliveredAt), {
                                    addSuffix: true,
                                  })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-xs tabular-nums">
                              {s.occurrences}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => markDelivered(s)}
                                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-md border border-border hover:border-foreground hover:bg-paper-soft transition"
                                title={
                                  s.nextDate
                                    ? s.current
                                      ? `Deliver current and queue next lead due ${formatShortDate(s.nextDate)}`
                                      : `Queue next lead due ${formatShortDate(s.nextDate)}`
                                    : s.current
                                      ? "Mark current occurrence delivered and queue next (no next date set)"
                                      : "Queue next occurrence as a lead (no next date set)"
                                }
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {s.current ? "Deliver + queue" : "Queue next"}
                                {s.nextDate && (
                                  <span className="text-muted-foreground normal-case tracking-normal">
                                    → {formatShortDate(s.nextDate)}
                                  </span>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {/* Any repeating project with an interval outside the canonical set */}
          {seriesList.some((s) => !CADENCES.includes(s.interval)) && (
            <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
              <Briefcase className="inline h-3 w-3 mr-1" />
              Some series use an unknown cadence — edit their repeat interval on the pipeline.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PipelineTabs({ current }: { current: "pipeline" | "recurring" }) {
  const base =
    "font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md border transition inline-flex items-center gap-1.5";
  const active = "bg-foreground text-background border-foreground";
  const idle = "border-border text-muted-foreground hover:text-foreground hover:border-foreground";
  return (
    <div className="flex items-center gap-2">
      <Link to="/pipeline" className={`${base} ${current === "pipeline" ? active : idle}`}>
        <KanbanSquare className="h-3.5 w-3.5" /> Pipeline
      </Link>
      <Link to="/recurring" className={`${base} ${current === "recurring" ? active : idle}`}>
        <Repeat className="h-3.5 w-3.5" /> Recurring
      </Link>
    </div>
  );
}

function StagePill({ stage, label }: { stage: PipelineStage; label: string }) {
  const cls =
    stage === "delivered"
      ? "bg-foreground text-background"
      : stage === "lost"
        ? "bg-transparent text-muted-foreground border border-border"
        : "bg-paper-soft text-foreground border border-border";
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${cls}`}
    >
      {label}
    </span>
  );
}
