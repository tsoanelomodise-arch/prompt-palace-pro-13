import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatZAR } from "@/lib/pipeline";
import { toast } from "sonner";

export function ProjectValuePopover({
  projectId,
  value,
  trigger,
  align = "start",
}: {
  projectId: string;
  value: number | null;
  trigger: ReactNode;
  align?: "start" | "center" | "end";
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<string>(value != null ? String(value) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = input.trim();
    let next: number | null = null;
    if (trimmed !== "") {
      const parsed = Number(trimmed.replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error("Enter a positive amount in Rand");
        return;
      }
      next = Math.round(parsed * 100) / 100;
    }
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ opportunity_value: next })
      .eq("id", projectId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next === null ? "Value cleared" : `Value set to ${formatZAR(next)}`);
    qc.invalidateQueries({ queryKey: ["projects"] });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setInput(value != null ? String(value) : ""); }}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
        <Label htmlFor={`val-${projectId}`} className="text-xs">Opportunity value (ZAR)</Label>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">R</span>
          <Input
            id={`val-${projectId}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="100"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
            placeholder="0"
            className="h-9"
            autoFocus
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Estimated deal size in South African Rand.
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setInput("")}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
