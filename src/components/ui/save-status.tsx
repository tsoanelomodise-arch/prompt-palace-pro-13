import { Check, CircleAlert, Loader2 } from "lucide-react";
import type { AutosaveStatus } from "@/hooks/use-autosave";

export function SaveStatus({ status, className = "" }: { status: AutosaveStatus; className?: string }) {
  const base = "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest";
  if (status === "saving") {
    return (
      <span className={`${base} text-muted-foreground ${className}`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className={`${base} text-muted-foreground ${className}`}>
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={`${base} text-destructive ${className}`}>
        <CircleAlert className="h-3 w-3" /> Save failed
      </span>
    );
  }
  return <span className={`${base} text-muted-foreground/60 ${className}`}>Autosave on</span>;
}
