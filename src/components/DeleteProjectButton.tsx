import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  projectIds: string | string[];
  projectName: string;
  description?: string;
  trigger?: ReactNode;
  onDeleted?: () => void;
  clientId?: string;
};

export function DeleteProjectButton({
  projectIds,
  projectName,
  description,
  trigger,
  onDeleted,
  clientId,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ids = Array.isArray(projectIds) ? projectIds : [projectIds];

  const handleDelete = async () => {
    setBusy(true);
    const { error } = await supabase.from("projects").delete().in("id", ids);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(ids.length > 1 ? `Deleted ${ids.length} projects` : "Project deleted");
    qc.invalidateQueries({ queryKey: ["projects"] });
    if (clientId) qc.invalidateQueries({ queryKey: ["projects", clientId] });
    setOpen(false);
    onDeleted?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ?? (
          <button
            type="button"
            title="Delete project"
            aria-label="Delete project"
            className="text-muted-foreground hover:text-destructive transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {ids.length > 1 ? `Delete "${projectName}" series?` : `Delete "${projectName}"?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description ??
              (ids.length > 1
                ? `This permanently removes ${ids.length} projects in this recurring series, including any credentials, notes, and conversations linked to them. This cannot be undone.`
                : "This permanently removes the project and any credentials, notes, and conversations linked to it. This cannot be undone.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
