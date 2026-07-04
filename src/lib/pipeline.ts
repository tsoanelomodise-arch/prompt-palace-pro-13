export const PIPELINE_STAGES = [
  { id: "lead", label: "Lead", hint: "New interest, unqualified" },
  { id: "contacted", label: "Contacted", hint: "Conversation started" },
  { id: "proposal", label: "Proposal", hint: "Scope or quote sent" },
  { id: "active", label: "Active", hint: "Live client, work in progress" },
  { id: "won", label: "Won", hint: "Closed deal" },
  { id: "lost", label: "Lost", hint: "Did not proceed" },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["id"];

export const CLIENT_STATUS_OPTIONS = [
  ...PIPELINE_STAGES.map((s) => ({ id: s.id, label: s.label })),
  { id: "paused", label: "Paused" },
  { id: "archived", label: "Archived" },
] as const;

export const isPipelineStage = (s: string): s is PipelineStage =>
  PIPELINE_STAGES.some((x) => x.id === s);
