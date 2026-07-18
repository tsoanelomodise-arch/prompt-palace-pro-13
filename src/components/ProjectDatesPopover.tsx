import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export type ProjectDates = {
  id: string;
  start_date: string | null;
  due_date: string | null;
  next_occurrence_date: string | null;
  repeat_interval: string;
};

export function ProjectDatesPopover({
  project,
  trigger,
  align = "end",
}: {
  project: ProjectDates;
  trigger: ReactNode;
  align?: "start" | "center" | "end";
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(project.start_date ?? "");
  const [due, setDue] = useState(project.due_date ?? "");
  const [next, setNext] = useState(project.next_occurrence_date ?? "");
  const [saving, setSaving] = useState(false);
  const isRepeating = project.repeat_interval && project.repeat_interval !== "none";

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        start_date: start || null,
        due_date: due || null,
        next_occurrence_date: isRepeating ? (next || null) : null,
      })
      .eq("id", project.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Dates updated");
    qc.invalidateQueries({ queryKey: ["projects"] });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) {
        setStart(project.start_date ?? "");
        setDue(project.due_date ?? "");
        setNext(project.next_occurrence_date ?? "");
      }
    }}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-72 p-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor={`pd-start-${project.id}`} className="text-xs">Start date</Label>
            <Input
              id={`pd-start-${project.id}`}
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1.5 h-9"
            />
          </div>
          <div>
            <Label htmlFor={`pd-due-${project.id}`} className="text-xs">Due date</Label>
            <Input
              id={`pd-due-${project.id}`}
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-1.5 h-9"
            />
          </div>
          {isRepeating && (
            <div>
              <Label htmlFor={`pd-next-${project.id}`} className="text-xs">Next occurrence</Label>
              <Input
                id={`pd-next-${project.id}`}
                type="date"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="mt-1.5 h-9"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Used as the due date for the next auto-queued occurrence.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => { setStart(""); setDue(""); setNext(""); }}
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" size="sm" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
