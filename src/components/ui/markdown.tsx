import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed",
        "prose-headings:font-display prose-headings:font-semibold",
        "prose-pre:bg-paper-soft prose-pre:border prose-pre:border-border",
        "prose-img:rounded-md prose-img:border prose-img:border-border",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
