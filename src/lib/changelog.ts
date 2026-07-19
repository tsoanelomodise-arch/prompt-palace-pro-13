export type ChangelogEntry = {
  date: string; // YYYY-MM-DD
  version?: string;
  tag: "feature" | "improvement" | "fix" | "security";
  title: string;
  details?: string[];
};

// Newest first. Add entries at the top as the system evolves.
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-07-19",
    tag: "feature",
    title: "Change log",
    details: [
      "New /changelog page tracking every shipped update.",
      "Grouped by month with tags for features, improvements, fixes and security.",
    ],
  },
  {
    date: "2026-07-18",
    tag: "improvement",
    title: "Remove projects from implementation",
    details: [
      "Hover a card on /implementation and click ✕ to remove.",
      "\"Remove from implementation\" button on the project task view.",
      "Tasks are preserved — only impl_stage is cleared.",
    ],
  },
  {
    date: "2026-07-17",
    tag: "feature",
    title: "Opportunity value (ZAR) & pipeline forecast dashboard",
    details: [
      "Editable rand value on each pipeline project via inline coin pill.",
      "Dashboard: total open pipeline, weighted forecast, delivered YTD.",
      "Per-stage bar charts formatted in South African Rand.",
    ],
  },
  {
    date: "2026-07-16",
    tag: "improvement",
    title: "Show / hide Delivered on the pipeline",
    details: ["Filter toggle collapses the Delivered column from the board grid."],
  },
  {
    date: "2026-07-15",
    tag: "feature",
    title: "Projects ↔ Pipeline relationship",
    details: [
      "Pipeline-stage picker on project cards in Client detail.",
      "Project status stays in sync with the shared pipeline stages.",
    ],
  },
  {
    date: "2026-07-14",
    tag: "feature",
    title: "Wiki drag-and-drop reordering",
    details: ["Reorder and reparent pages in the sidebar; changes persist."],
  },
  {
    date: "2026-07-13",
    tag: "feature",
    title: "WYSIWYG image cropping & resizing",
    details: [
      "Crop dialog on image upload / paste / drop.",
      "S / M / L / Full resize toolbar on inserted images.",
      "Sticky WYSIWYG toolbar while editing wiki pages.",
    ],
  },
  {
    date: "2026-07-12",
    tag: "feature",
    title: "Wiki space concertina",
    details: ["Recursive accordion sidebar replaces the flat page list."],
  },
  {
    date: "2026-07-11",
    tag: "feature",
    title: "Implementation kanban & dashboard",
    details: [
      "Kanban across kickoff → build → QA → launch → done.",
      "Per-project task board (todo / doing / blocked / done).",
      "Workload by assignee and per-client rollups.",
    ],
  },
  {
    date: "2026-07-10",
    tag: "feature",
    title: "Wiki WYSIWYG editor",
    details: ["TipTap-powered Rich / Markdown / Preview toggle."],
  },
  {
    date: "2026-07-09",
    tag: "feature",
    title: "Delete projects everywhere",
    details: ["Delete action on Pipeline, Recurring and Client detail views."],
  },
  {
    date: "2026-07-08",
    tag: "feature",
    title: "Pipeline date tracking",
    details: [
      "start_date, due_date, delivered_at and next_occurrence_date on projects.",
      "Date filters and colour-coded pills across dashboards.",
      "Work-in-progress panel on Pipeline surfaces active / review projects.",
    ],
  },
  {
    date: "2026-07-07",
    tag: "feature",
    title: "Recurring project dashboard",
    details: [
      "Dedicated /recurring board grouped by cadence.",
      "Work-in-progress column with clickable stage pills.",
      "\"Deliver + queue next\" advances the series to the next occurrence.",
    ],
  },
  {
    date: "2026-07-06",
    tag: "feature",
    title: "Standalone Logins page",
    details: ["Aggregated credential vault at /logins with search and admin controls."],
  },
  {
    date: "2026-07-05",
    tag: "feature",
    title: "CRM pipeline (kanban)",
    details: [
      "Drag-and-drop stages on /pipeline.",
      "Automation clones recurring projects back to Lead on delivery.",
    ],
  },
  {
    date: "2026-07-04",
    tag: "feature",
    title: "Improve with AI",
    details: [
      "AI polish for prompts, notes, conversations and wiki pages.",
      "Diff-view comparison with custom instructions support.",
    ],
  },
  {
    date: "2026-07-03",
    tag: "feature",
    title: "@-mention cross references",
    details: [
      "Reference prompts, notes, conversations and wiki pages inside any editor.",
      "Inserts markdown links to internal entities.",
    ],
  },
  {
    date: "2026-07-02",
    tag: "feature",
    title: "Autosave everywhere",
    details: ["useAutosave hook + SaveStatus indicator on prompts, notes, wikis and conversations."],
  },
  {
    date: "2026-07-01",
    tag: "feature",
    title: "Prompt categories & tag autocomplete",
    details: ["Reuse existing categories and tags in the prompt editor."],
  },
  {
    date: "2026-06-30",
    tag: "feature",
    title: "Team invitations",
    details: ["Admins can invite team members with a role assignment."],
  },
  {
    date: "2026-06-29",
    tag: "feature",
    title: "Inline image uploads",
    details: [
      "Paste, drag or upload images inside prompts, notes and wikis.",
      "Downscaling, signed URLs, lightbox and preview strip.",
    ],
  },
  {
    date: "2026-06-28",
    tag: "feature",
    title: "Client conversations",
    details: ["Timeline of subject, summary, participants and dates per client."],
  },
  {
    date: "2026-06-27",
    tag: "security",
    title: "Database hardening",
    details: [
      "Sensitive credential handling reviewed.",
      "Revoked EXECUTE on SECURITY DEFINER functions from public roles.",
    ],
  },
  {
    date: "2026-06-26",
    tag: "feature",
    title: "Duplicate prompt",
    details: ["Clone a prompt and land straight in the edit screen of the copy."],
  },
  {
    date: "2026-06-25",
    tag: "feature",
    title: "Internal wiki",
    details: [
      "Markdown wiki with spaces and nested pages.",
      "Bidirectional links to clients, projects and prompts.",
    ],
  },
  {
    date: "2026-06-24",
    tag: "feature",
    title: "CRM Lite: clients, projects, credentials, roles",
    details: [
      "Clients, projects, contacts, client notes and credentials.",
      "Encrypted credentials via pgsodium and role-based access control.",
      "/clients index, detail with tabs, and /team management page.",
    ],
  },
  {
    date: "2026-06-23",
    tag: "feature",
    title: "Prompt management (v1)",
    details: [
      "CRUD prompts with variable templating.",
      "Google + email/password auth.",
      "Paper & Ink design system with Space Grotesk + DM Sans.",
    ],
  },
];
