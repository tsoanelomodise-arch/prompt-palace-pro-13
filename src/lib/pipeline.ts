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

export const REPEAT_INTERVALS = [
  { id: "none", label: "Does not repeat" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly", label: "Yearly" },
] as const;

export type RepeatInterval = (typeof REPEAT_INTERVALS)[number]["id"];

export const repeatLabel = (r: string): string =>
  REPEAT_INTERVALS.find((x) => x.id === r)?.label ?? "Does not repeat";
