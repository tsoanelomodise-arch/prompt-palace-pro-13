import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CHANGELOG, type ChangelogEntry } from "@/lib/changelog";
import { Sparkles, Wrench, Bug, ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/changelog")({
  component: ChangelogPage,
  head: () => ({
    meta: [
      { title: "Change log · Agency CRM" },
      { name: "description", content: "Every shipped update to the internal Agency CRM." },
    ],
  }),
});

function ChangelogPage() {
  const grouped = useMemo(() => {
    const map = new Map<string, ChangelogEntry[]>();
    for (const e of CHANGELOG) {
      const d = new Date(e.date + "T00:00:00");
      const key = d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>

      <div className="mt-4 pb-8 mb-8 border-b border-border">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {CHANGELOG.length} entries
        </p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold leading-[0.95] tracking-tight">
          Change log.
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl">
          A running record of what has shipped in the Agency CRM — features, improvements,
          fixes and security work.
        </p>
      </div>

      <div className="space-y-12">
        {grouped.map(([month, entries]) => (
          <section key={month}>
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 sticky top-16 bg-paper/90 backdrop-blur py-1">
              {month}
            </h2>
            <ol className="relative border-l border-border pl-6 space-y-8">
              {entries.map((e) => (
                <li key={e.date + e.title} className="relative">
                  <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-foreground ring-4 ring-paper" />
                  <div className="flex flex-wrap items-baseline gap-2 mb-1">
                    <time className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(e.date + "T00:00:00").toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                    <Tag tag={e.tag} />
                  </div>
                  <h3 className="font-display text-lg font-semibold leading-snug">{e.title}</h3>
                  {e.details && e.details.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {e.details.map((d, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-muted-foreground/40 mt-1.5 h-1 w-1 rounded-full bg-current shrink-0" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function Tag({ tag }: { tag: ChangelogEntry["tag"] }) {
  const cfg = {
    feature: { icon: <Sparkles className="h-2.5 w-2.5" />, label: "Feature", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    improvement: { icon: <Wrench className="h-2.5 w-2.5" />, label: "Improvement", cls: "border-border bg-paper-soft text-muted-foreground" },
    fix: { icon: <Bug className="h-2.5 w-2.5" />, label: "Fix", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    security: { icon: <ShieldCheck className="h-2.5 w-2.5" />, label: "Security", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
  }[tag];
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
