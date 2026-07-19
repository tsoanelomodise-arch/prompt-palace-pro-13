import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  IMPL_STAGES,
  TASK_STATUSES,
  type ImplStage,
  type TaskStatus,
} from "@/lib/implementation";
import { daysUntil, formatShortDate } from "@/lib/pipeline";
import { listTeamDirectory } from "@/lib/team-directory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectClientPopover } from "@/components/ProjectClientPopover";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CalendarClock,
  AlertTriangle,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/implementation/$projectId")({
  component: ProjectTasksPage,
});

type ProjectRow = {
  id: string;
  name: string;
  client_id: string;
  impl_stage: string | null;
  due_date: string | null;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  created_by: string | null;
};

type ClientLite = { id: string; name: string };
type Member = { id: string; email: string };

function ProjectTasksPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,client_id,impl_stage,due_date")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data as ProjectRow;
    },
  });

  const { data: client } = useQuery<ClientLite | null>({
    queryKey: ["client", project?.client_id],
    enabled: !!project?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name")
        .eq("id", project!.client_id)
        .single();
      if (error) throw error;
      return data as ClientLite;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["project_tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TaskRow[];
    },
  });

  const teamFn = useServerFn(listTeamDirectory);
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["team", "directory"],
    queryFn: () => teamFn(),
  });
  const memberLabel = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => m.set(x.id, x.email.split("@")[0]));
    return m;
  }, [members]);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, TaskRow[]> = { todo: [], doing: [], blocked: [], done: [] };
    for (const t of tasks) {
      if (t.status in map) map[t.status as TaskStatus].push(t);
    }
    return map;
  }, [tasks]);

  const moveTask = async (taskId: string, status: TaskStatus) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.status === status) return;
    qc.setQueryData<TaskRow[]>(["project_tasks", projectId], (old) =>
      (old ?? []).map((x) => (x.id === taskId ? { ...x, status } : x)),
    );
    qc.invalidateQueries({ queryKey: ["project_tasks", "all"] });
    const { error } = await supabase
      .from("project_tasks")
      .update({ status })
      .eq("id", taskId);
    if (error) {
      toast.error("Could not move task");
      qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
    }
  };

  const setImplStage = async (stage: ImplStage) => {
    if (!project) return;
    qc.setQueryData(["project", projectId], { ...project, impl_stage: stage });
    const { error } = await supabase.from("projects").update({ impl_stage: stage }).eq("id", projectId);
    if (error) {
      toast.error("Could not change stage");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      return;
    }
    qc.invalidateQueries({ queryKey: ["projects", "implementation"] });
    toast.success(`Moved to ${stage}`);
  };

  const removeTask = async (taskId: string) => {
    qc.setQueryData<TaskRow[]>(["project_tasks", projectId], (old) =>
      (old ?? []).filter((x) => x.id !== taskId),
    );
    qc.invalidateQueries({ queryKey: ["project_tasks", "all"] });
    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Could not delete");
      qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
    }
  };

  const editingTask = editId ? tasks.find((t) => t.id === editId) ?? null : null;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.navigate({ to: "/implementation" })}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to board
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6 mb-8 pb-8 border-b border-border">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {client ? (
              <Link
                to="/clients/$clientId"
                params={{ clientId: client.id }}
                hash="projects"
                className="hover:underline"
              >
                {client.name}
              </Link>
            ) : (
              "—"
            )}{" "}
            · {tasks.length} tasks
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold leading-[0.95] tracking-tight truncate">
            {project?.name ?? "…"}
          </h1>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Stage
            </span>
            <Select
              value={project?.impl_stage ?? "kickoff"}
              onValueChange={(v) => setImplStage(v as ImplStage)}
            >
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPL_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={async () => {
              if (!project) return;
              if (!confirm(`Remove "${project.name}" from implementation? Tasks will be preserved but the project will no longer appear on the implementation board.`)) return;
              const { error } = await supabase.from("projects").update({ impl_stage: null }).eq("id", projectId);
              if (error) { toast.error(error.message); return; }
              qc.invalidateQueries({ queryKey: ["projects", "implementation"] });
              toast.success("Removed from implementation");
              router.navigate({ to: "/implementation" });
            }}
          >
            Remove from implementation
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TASK_STATUSES.map((col) => {
          const items = grouped[col.id];
          const isOver = overStatus === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setOverStatus(col.id); }}
              onDragLeave={() => setOverStatus((s) => (s === col.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOverStatus(null);
                if (dragId) moveTask(dragId, col.id);
                setDragId(null);
              }}
              className={`rounded-lg border bg-card flex flex-col min-h-[300px] transition ${
                isOver ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {col.label}
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
                  items.map((t) => {
                    const d = daysUntil(t.due_date);
                    const overdue = t.status !== "done" && d !== null && d < 0;
                    const canDelete = isAdmin || t.created_by === user?.id;
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => { setDragId(null); setOverStatus(null); }}
                        className="group rounded-md border border-border bg-paper hover:border-foreground transition p-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => setEditId(t.id)}
                          className="text-left w-full"
                        >
                          <div className="text-sm leading-snug group-hover:underline underline-offset-4">
                            {t.title}
                          </div>
                        </button>
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {t.assignee_id && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border border-border bg-paper-soft rounded-full px-2 py-0.5 text-muted-foreground">
                              <User className="h-2.5 w-2.5" />
                              {memberLabel.get(t.assignee_id) ?? "member"}
                            </span>
                          )}
                          {t.due_date && (
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 ${
                                overdue
                                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                                  : "border-border bg-paper-soft text-muted-foreground"
                              }`}
                            >
                              <CalendarClock className="h-2.5 w-2.5" />
                              {formatShortDate(t.due_date)}
                              {overdue && <AlertTriangle className="h-2.5 w-2.5" />}
                            </span>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => removeTask(t.id)}
                              className="ml-auto opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
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

      <TaskDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        projectId={projectId}
        members={members}
      />
      <TaskDialog
        open={!!editingTask}
        onOpenChange={(v) => !v && setEditId(null)}
        projectId={projectId}
        members={members}
        task={editingTask}
      />
    </div>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  projectId,
  members,
  task,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  members: Member[];
  task?: TaskRow | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEdit = !!task;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>((task?.status as TaskStatus) ?? "todo");
  const [assignee, setAssignee] = useState<string>(task?.assignee_id ?? "unassigned");
  const [dueDate, setDueDate] = useState<string>(task?.due_date ?? "");
  const [saving, setSaving] = useState(false);

  // Reset form on open/task change
  useMemo(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus((task?.status as TaskStatus) ?? "todo");
      setAssignee(task?.assignee_id ?? "unassigned");
      setDueDate(task?.due_date ?? "");
    }
  }, [open, task]);

  const save = async () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      assignee_id: assignee === "unassigned" ? null : assignee,
      due_date: dueDate || null,
    };
    if (isEdit && task) {
      const { error } = await supabase.from("project_tasks").update(payload).eq("id", task.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("project_tasks").insert({
        ...payload,
        project_id: projectId,
        created_by: user?.id ?? null,
      });
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
    qc.invalidateQueries({ queryKey: ["project_tasks", "all"] });
    toast.success(isEdit ? "Task updated" : "Task added");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assignee</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-due">Due</Label>
              <Input
                id="t-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{isEdit ? "Save" : "Add task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
