export const PIPELINE_STAGES = [
  { id: "lead", label: "Lead", hint: "Opportunity identified" },
  { id: "proposal", label: "Proposal", hint: "Scope or quote sent" },
  { id: "active", label: "Active", hint: "Work in progress" },
  { id: "review", label: "Review", hint: "Awaiting client sign-off" },
  { id: "delivered", label: "Delivered", hint: "Wrapped and handed off" },
  { id: "lost", label: "Lost", hint: "Did not proceed" },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["id"];

export const isPipelineStage = (s: string): s is PipelineStage =>
  PIPELINE_STAGES.some((x) => x.id === s);
