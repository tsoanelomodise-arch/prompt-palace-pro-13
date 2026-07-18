export const IMPL_STAGES = [
  { id: "kickoff", label: "Kickoff", hint: "Scope & align" },
  { id: "build", label: "Build", hint: "Implementation" },
  { id: "qa", label: "QA", hint: "Test & review" },
  { id: "launch", label: "Launch", hint: "Ship it" },
  { id: "done", label: "Done", hint: "Delivered" },
] as const;

export type ImplStage = (typeof IMPL_STAGES)[number]["id"];

export const isImplStage = (s: string | null | undefined): s is ImplStage =>
  !!s && IMPL_STAGES.some((x) => x.id === s);

export const TASK_STATUSES = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "Doing" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number]["id"];

export const taskStatusLabel = (s: string) =>
  TASK_STATUSES.find((x) => x.id === s)?.label ?? s;
