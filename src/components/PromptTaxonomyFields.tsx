import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo } from "react";

type Props = {
  category: string;
  tagsRaw: string;
  onCategoryChange: (v: string) => void;
  onTagsRawChange: (v: string) => void;
  excludeId?: string;
};

function parseTags(raw: string): string[] {
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

export function PromptTaxonomyFields({ category, tagsRaw, onCategoryChange, onTagsRawChange, excludeId }: Props) {
  const { data } = useQuery({
    queryKey: ["prompt-taxonomy"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prompts").select("id,category,tags");
      if (error) throw error;
      return data as { id: string; category: string | null; tags: string[] }[];
    },
    staleTime: 60_000,
  });

  const { categories, tags } = useMemo(() => {
    const rows = (data ?? []).filter((r) => r.id !== excludeId);
    const cats = new Set<string>();
    const tgs = new Map<string, number>();
    for (const r of rows) {
      if (r.category) cats.add(r.category);
      for (const t of r.tags ?? []) tgs.set(t, (tgs.get(t) ?? 0) + 1);
    }
    return {
      categories: [...cats].sort((a, b) => a.localeCompare(b)),
      tags: [...tgs.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
    };
  }, [data, excludeId]);

  const selectedTags = parseTags(tagsRaw);
  const selectedSet = new Set(selectedTags.map((t) => t.toLowerCase()));

  function toggleTag(t: string) {
    const exists = selectedSet.has(t.toLowerCase());
    const next = exists
      ? selectedTags.filter((x) => x.toLowerCase() !== t.toLowerCase())
      : [...selectedTags, t];
    onTagsRawChange(next.join(", "));
  }

  const listId = "prompt-category-suggestions";

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <Label>Category</Label>
        <Input
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="mt-1.5 h-11"
          list={listId}
          placeholder="Copywriting"
        />
        <datalist id={listId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {categories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {categories.slice(0, 10).map((c) => {
              const active = c.toLowerCase() === category.trim().toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCategoryChange(active ? "" : c)}
                  className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border rounded-full transition-colors ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "border-border hover:border-foreground"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div>
        <Label>Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
        <Input
          value={tagsRaw}
          onChange={(e) => onTagsRawChange(e.target.value)}
          className="mt-1.5 h-11"
          placeholder="gpt-5, brand, hero"
        />
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.slice(0, 20).map((t) => {
              const active = selectedSet.has(t.toLowerCase());
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border rounded-full transition-colors ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "border-border hover:border-foreground"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
