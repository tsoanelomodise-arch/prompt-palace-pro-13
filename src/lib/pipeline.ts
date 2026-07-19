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

// ---- Date helpers -----------------------------------------------------------

export type DateFilter = "all" | "overdue" | "week" | "month" | "none";

export const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "week", label: "Due this week" },
  { id: "month", label: "Due this month" },
  { id: "none", label: "No due date" },
];

/** Parse a YYYY-MM-DD string as a local-midnight Date (avoids TZ off-by-one). */
export const parseDateOnly = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Days between due and today (negative = overdue). */
export const daysUntil = (due: string | null | undefined): number | null => {
  const d = parseDateOnly(due);
  if (!d) return null;
  const today = startOfDay(new Date());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
};

export const isOverdue = (due: string | null | undefined): boolean => {
  const n = daysUntil(due);
  return n !== null && n < 0;
};

export const matchesDateFilter = (
  due: string | null | undefined,
  filter: DateFilter,
): boolean => {
  if (filter === "all") return true;
  if (filter === "none") return !due;
  const n = daysUntil(due);
  if (n === null) return false;
  if (filter === "overdue") return n < 0;
  if (filter === "week") return n >= 0 && n <= 7;
  if (filter === "month") return n >= 0 && n <= 31;
  return true;
};

export const formatShortDate = (s: string | null | undefined): string => {
  const d = parseDateOnly(s);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// ---- Currency (ZAR) ---------------------------------------------------------

const ZAR_FORMATTER = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

const ZAR_FORMATTER_CENTS = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number as South African Rand (R 12 345). Null/undefined → em dash. */
export const formatZAR = (n: number | null | undefined, opts?: { cents?: boolean }): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (opts?.cents ? ZAR_FORMATTER_CENTS : ZAR_FORMATTER).format(n);
};

/** Compact ZAR for tight UI: R 1.2k, R 3.4m. */
export const formatZARCompact = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n) || n === 0) return "R 0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`;
  if (abs >= 1_000) return `${sign}R ${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}R ${abs.toFixed(0)}`;
};

/** Rough win-probability by pipeline stage — used for weighted forecast totals. */
export const STAGE_WIN_PROBABILITY: Record<PipelineStage, number> = {
  lead: 0.1,
  proposal: 0.35,
  active: 0.7,
  review: 0.9,
  delivered: 1,
  lost: 0,
};


