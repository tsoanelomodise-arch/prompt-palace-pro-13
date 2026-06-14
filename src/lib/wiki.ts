export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "untitled";
}

export type EntityType = "client" | "project" | "prompt";

export const ENTITY_LABELS: Record<EntityType, string> = {
  client: "Client",
  project: "Project",
  prompt: "Prompt",
};
