import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";

type ClientLite = { id: string; name: string };

export function ProjectClientPopover({
  projectId,
  projectIds,
  currentClientId,
  trigger,
  align = "end",
  onReassigned,
}: {
  projectId: string;
  projectIds?: string[];
  currentClientId: string;
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  onReassigned?: (newClientId: string) => void;
}) {
  const qc = useQueryClient();
  const ids = projectIds && projectIds.length > 0 ? projectIds : [projectId];
  const isSeries = ids.length > 1;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentClientId);
  const [saving, setSaving] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", "lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return data as ClientLite[];
    },
  });

  const save = async () => {
    if (selected === currentClientId) {
      setOpen(false);
      return;
    }
    setSaving(true);

    // Expand to full recurring series so every occurrence moves together.
    // A "series" = same current client + same name + repeat_interval != 'none'.
    let targetIds = [...ids];
    if (!isSeries) {
      const { data: proj } = await supabase
        .from("projects")
        .select("name, repeat_interval, client_id")
        .eq("id", projectId)
        .single();
      if (proj && proj.repeat_interval && proj.repeat_interval !== "none") {
        const { data: siblings } = await supabase
          .from("projects")
          .select("id")
          .eq("client_id", proj.client_id)
          .eq("name", proj.name)
          .neq("repeat_interval", "none");
        if (siblings && siblings.length > 0) {
          targetIds = siblings.map((s) => s.id);
        }
      }
    }

    const { error } = await supabase
      .from("projects")
      .update({ client_id: selected })
      .in("id", targetIds);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const movedSeries = targetIds.length > 1;
    toast.success(movedSeries
      ? `Series reassigned (${targetIds.length} occurrences moved)`
      : "Project reassigned to a different client");
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["client", currentClientId] });
    qc.invalidateQueries({ queryKey: ["client", selected] });
    onReassigned?.(selected);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setSelected(currentClientId);
      }}
    >
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-72 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-widest">
              Reassign {isSeries ? "series" : "project"}
            </span>
          </div>
          <div>
            <Label htmlFor={`pc-client-${projectId}`} className="text-xs">Client</Label>
            <Select
              value={selected}
              onValueChange={setSelected}
              disabled={isLoading || saving}
            >
              <SelectTrigger id={`pc-client-${projectId}`} className="mt-1.5 h-9">
                <SelectValue placeholder="Pick a client…" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isSeries
              ? `Moves all ${ids.length} project occurrences in this recurring series and their linked records to the selected client.`
              : "Moves this project to the selected client. If it's part of a recurring series, every occurrence in the series moves together — a project belongs to exactly one client."}
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={saving || selected === currentClientId}>
              {saving ? "Saving…" : "Reassign"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
