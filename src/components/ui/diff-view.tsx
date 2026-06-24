import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Op = { type: "eq" | "add" | "del"; text: string };

// Word-level LCS diff. Keeps whitespace tokens as separators.
function tokenize(s: string): string[] {
  return s.split(/(\s+)/).filter((t) => t.length > 0);
}

function diffWords(a: string, b: string): Op[] {
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length;
  const m = B.length;
  // LCS table — cap size to avoid huge allocations on big docs.
  if (n * m > 1_500_000) {
    return [
      { type: "del", text: a },
      { type: "add", text: b },
    ];
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  const push = (type: Op["type"], text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += text;
    else ops.push({ type, text });
  };
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push("eq", A[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("del", A[i++]);
    } else {
      push("add", B[j++]);
    }
  }
  while (i < n) push("del", A[i++]);
  while (j < m) push("add", B[j++]);
  return ops;
}

export function DiffView({ original, improved }: { original: string; improved: string }) {
  const ops = useMemo(() => diffWords(original, improved), [original, improved]);
  return (
    <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-4 font-mono text-sm leading-relaxed">
      {ops.map((op, i) => (
        <span
          key={i}
          className={cn(
            op.type === "add" && "rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
            op.type === "del" && "rounded bg-rose-500/15 text-rose-700 line-through dark:text-rose-300",
          )}
        >
          {op.text}
        </span>
      ))}
    </div>
  );
}
