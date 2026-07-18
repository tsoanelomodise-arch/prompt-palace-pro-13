import { forwardRef, useRef, useImperativeHandle, useState, useMemo, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Eye, Pencil, X, AtSign, FileText, StickyNote, MessageSquare, BookOpen, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";
import { useServerFn } from "@tanstack/react-start";
import { searchReferences, type ReferenceItem, type ReferenceKind } from "@/lib/references.functions";
import { improveContent } from "@/lib/improve.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea as PlainTextarea } from "@/components/ui/textarea";
import { DiffView } from "@/components/ui/diff-view";
import { supabase } from "@/integrations/supabase/client";
import {
  IMAGE_SIZES,
  SIZE_LABEL,
  parseImageAlt,
  rewriteImageMarkdownSize,
  type ImageSize,
} from "@/lib/image-size";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 years

async function downscaleImage(file: File): Promise<Blob> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob: Blob | null = await new Promise((res) =>
    canvas.toBlob((b) => res(b), outType, JPEG_QUALITY),
  );
  if (!blob) throw new Error("Encode failed");
  return blob;
}

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  return "jpg";
}

async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Not an image");
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("You must be signed in to upload images");

  const blob = await downscaleImage(file);
  const ext = extFor(blob.type || file.type);
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("content-images")
    .upload(path, blob, {
      contentType: blob.type || file.type,
      cacheControl: "31536000",
      upsert: false,
    });
  if (upErr) throw new Error(upErr.message);

  const { data: signed, error: sErr } = await supabase.storage
    .from("content-images")
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "Sign failed");
  return signed.signedUrl;
}

export type ImageTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string;
  onValueChange: (next: string) => void;
  toolbar?: boolean;
};

export const ImageTextarea = forwardRef<HTMLTextAreaElement, ImageTextareaProps>(
  ({ value, onValueChange, toolbar = true, className, ...rest }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Parse out image markdown entries for inline thumbnails.
    const images = useMemo(() => {
      const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
      const out: { alt: string; url: string; match: string }[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(value)) !== null) {
        out.push({ alt: m[1], url: m[2], match: m[0] });
      }
      return out;
    }, [value]);

    // ---------- Display <-> real value transforms ----------
    // The textarea shows short tokens like `![alt](image#1)` instead of the
    // full signed URL so pasting an image doesn't dump a wall of URL text.
    // The real value (with actual URLs) is what we pass to onValueChange.
    const urlMap = useMemo(() => {
      const urls: string[] = [];
      const re = /!\[[^\]]*\]\(([^)\s]+)\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(value)) !== null) {
        if (!urls.includes(m[1])) urls.push(m[1]);
      }
      return urls;
    }, [value]);

    const displayValue = useMemo(() => {
      return value.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (full, alt, url) => {
        const idx = urlMap.indexOf(url);
        return idx >= 0 ? `![${alt}](image#${idx + 1})` : full;
      });
    }, [value, urlMap]);

    const displayToReal = (display: string, extra?: Record<number, string>): string => {
      return display.replace(/!\[([^\]]*)\]\(image#(\d+)\)/g, (m, alt, n) => {
        const i = Number(n) - 1;
        const url = extra?.[i] ?? urlMap[i];
        return url ? `![${alt}](${url})` : m;
      });
    };

    const removeImage = (match: string) => {
      // Remove the markdown token and tidy surrounding blank lines.
      const next = value.replace(match, "").replace(/\n{3,}/g, "\n\n");
      onValueChange(next);
    };



    // ---------- @-mention reference picker ----------
    const runSearch = useServerFn(searchReferences);
    const [mention, setMention] = useState<{
      open: boolean;
      query: string;
      anchorStart: number; // index of the '@' in the textarea value
      items: ReferenceItem[];
      loading: boolean;
      activeIndex: number;
    }>({ open: false, query: "", anchorStart: -1, items: [], loading: false, activeIndex: 0 });

    // Debounced search whenever the mention query changes.
    useEffect(() => {
      if (!mention.open) return;
      let cancelled = false;
      setMention((m) => ({ ...m, loading: true }));
      const t = setTimeout(async () => {
        try {
          const items = await runSearch({ data: { query: mention.query } });
          if (!cancelled) {
            setMention((m) =>
              m.open ? { ...m, items, loading: false, activeIndex: 0 } : m,
            );
          }
        } catch {
          if (!cancelled) setMention((m) => ({ ...m, loading: false, items: [] }));
        }
      }, 150);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [mention.open, mention.query, runSearch]);

    const closeMention = () =>
      setMention({ open: false, query: "", anchorStart: -1, items: [], loading: false, activeIndex: 0 });

    const selectReference = (item: ReferenceItem) => {
      const el = innerRef.current;
      if (!el || mention.anchorStart < 0) {
        closeMention();
        return;
      }
      const caret = el.selectionStart ?? displayValue.length;
      const before = displayValue.slice(0, mention.anchorStart);
      const after = displayValue.slice(caret);
      const safeLabel = item.label.replace(/[\[\]]/g, "");
      const snippet = `[${safeLabel}](${item.url})`;
      const nextDisplay = before + snippet + after;
      onValueChange(displayToReal(nextDisplay));
      const pos = before.length + snippet.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      });
      closeMention();
    };

    const onTextareaChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
      const displayed = e.target.value;
      onValueChange(displayToReal(displayed));
      const caret = e.target.selectionStart ?? displayed.length;
      // Look back from the caret for the most recent '@' that starts a token.
      const upto = displayed.slice(0, caret);
      const m = upto.match(/(?:^|\s)@([\w-]{0,40})$/);
      if (m) {
        const query = m[1];
        const anchorStart = caret - query.length - 1; // index of '@'
        setMention((prev) => ({
          ...prev,
          open: true,
          query,
          anchorStart,
        }));
      } else if (mention.open) {
        closeMention();
      }
    };

    const onTextareaKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
      if (!mention.open || mention.items.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention((m) => ({ ...m, activeIndex: (m.activeIndex + 1) % m.items.length }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention((m) => ({
          ...m,
          activeIndex: (m.activeIndex - 1 + m.items.length) % m.items.length,
        }));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectReference(mention.items[mention.activeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
      }
    };

    const kindIcon = (k: ReferenceKind) => {
      switch (k) {
        case "prompt": return <FileText className="h-3.5 w-3.5" />;
        case "note": return <StickyNote className="h-3.5 w-3.5" />;
        case "conversation": return <MessageSquare className="h-3.5 w-3.5" />;
        case "wiki": return <BookOpen className="h-3.5 w-3.5" />;
      }
    };
    // ---------- end mention picker ----------

    // ---------- Improve with AI ----------
    const runImprove = useServerFn(improveContent);
    const [improvePopoverOpen, setImprovePopoverOpen] = useState(false);
    const [improveMode, setImproveMode] = useState<"polish" | "custom">("polish");
    const [improveInstruction, setImproveInstruction] = useState("");
    const [improving, setImproving] = useState(false);
    const [diffOpen, setDiffOpen] = useState(false);
    const [improvedText, setImprovedText] = useState("");
    const [originalSnapshot, setOriginalSnapshot] = useState("");

    const doImprove = async () => {
      const content = value.trim();
      if (!content) {
        toast.error("Nothing to improve yet.");
        return;
      }
      if (improveMode === "custom" && !improveInstruction.trim()) {
        toast.error("Add an instruction or switch to Polish & Clarify.");
        return;
      }
      setImproving(true);
      try {
        const { improved } = await runImprove({
          data: {
            content: value,
            mode: improveMode,
            instruction: improveMode === "custom" ? improveInstruction.trim() : undefined,
          },
        });
        setOriginalSnapshot(value);
        setImprovedText(improved);
        setImprovePopoverOpen(false);
        setDiffOpen(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Improve failed");
      } finally {
        setImproving(false);
      }
    };

    const acceptImproved = () => {
      onValueChange(improvedText);
      setDiffOpen(false);
      toast.success("Improved version applied");
    };
    // ---------- end Improve with AI ----------




    const handleFiles = async (files: FileList | File[], source: "paste" | "drop" | "pick" = "pick") => {
      const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0) return;
      setBusy(true);
      let added = 0;
      // Accumulate real markdown locally so multiple images in one drop/paste
      // don't race on stale props between iterations.
      const el = innerRef.current;
      const displayCaret = el?.selectionStart ?? displayValue.length;
      const beforeReal = displayToReal(displayValue.slice(0, displayCaret));
      const afterReal = displayToReal(displayValue.slice(displayCaret));
      let insertion = "";
      try {
        for (const f of imgs) {
          try {
            const url = await uploadImage(f);
            const alt = f.name.replace(/\.[^.]+$/, "") || "image";
            insertion += `\n\n![${alt}](${url})\n\n`;
            added++;
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Image failed");
          }
        }
      } finally {
        setBusy(false);
      }
      if (added > 0) {
        onValueChange(beforeReal + insertion + afterReal);
      }
      if (added > 0 && source === "paste") {
        toast.success(added === 1 ? "Image pasted" : `${added} images pasted`);
      }
    };

    const onPaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of items) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void handleFiles(files, "paste");
      }
    };

    const onDrop: React.DragEventHandler<HTMLTextAreaElement> = (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0 && Array.from(files).some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        setDragOver(false);
        void handleFiles(files, "drop");
      }
    };

    const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);


    return (
      <div className="relative">
        {showPreview ? (
          <div
            className={cn(
              "min-h-[8rem] rounded-md border border-input bg-background px-3 py-2 text-sm",
              className,
            )}
          >
            {value.trim() ? (
              <Markdown>{value}</Markdown>
            ) : (
              <p className="text-muted-foreground italic">Nothing to preview yet.</p>
            )}
          </div>
        ) : (
          <Textarea
            ref={innerRef}
            value={displayValue}
            onChange={onTextareaChange}
            onKeyDown={onTextareaKeyDown}
            onBlur={() => setTimeout(closeMention, 150)}
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={(e) => {
              if (e.dataTransfer?.types?.includes("Files")) {
                e.preventDefault();
                setDragOver(true);
              }
            }}
            onDragLeave={() => setDragOver(false)}
            className={cn(dragOver && "ring-2 ring-primary ring-offset-2", className)}
            {...rest}
          />
        )}

        {!showPreview && mention.open && (
          <div className="absolute left-2 top-full z-50 mt-1 w-80 max-w-[calc(100%-1rem)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
            <div className="border-b border-border px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {mention.loading ? "Searching…" : mention.items.length > 0 ? `Reference @${mention.query}` : "No matches"}
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {mention.items.map((item, i) => (
                <li key={`${item.kind}-${item.id}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectReference(item);
                    }}
                    onMouseEnter={() => setMention((m) => ({ ...m, activeIndex: i }))}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm",
                      i === mention.activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    )}
                  >
                    <span className="mt-0.5 text-muted-foreground">{kindIcon(item.kind)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.label}</span>
                      {item.sublabel && (
                        <span className="block truncate text-xs text-muted-foreground">{item.sublabel}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}


        {!showPreview && images.length > 0 && (
          <div className="mt-3 rounded-md border border-border bg-paper-soft/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Embedded images · {images.length}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Click to enlarge
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <div
                  key={`${img.url.slice(0, 32)}-${i}`}
                  className="group relative h-32 w-32 overflow-hidden rounded-md border border-border bg-muted shadow-sm"
                  title={img.alt || "image"}
                >
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: img.url, alt: img.alt })}
                    className="block h-full w-full"
                  >
                    <img
                      src={img.url}
                      alt={img.alt}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(img.match)}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground opacity-0 shadow transition group-hover:opacity-100"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {lightbox && (
          <Dialog open onOpenChange={(o) => !o && setLightbox(null)}>
            <DialogContent className="max-w-4xl p-2">
              <img
                src={lightbox.url}
                alt={lightbox.alt}
                className="mx-auto max-h-[80vh] w-auto rounded"
              />
            </DialogContent>
          </Dialog>
        )}


        {toolbar && (
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>
              {showPreview
                ? "Preview"
                : `Type @ to reference · Paste or drop images${images.length ? ` · ${images.length} image${images.length === 1 ? "" : "s"}` : ""}`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                disabled={showPreview}
                onClick={() => {
                  const el = innerRef.current;
                  if (!el) return;
                  el.focus();
                  const caret = el.selectionStart ?? displayValue.length;
                  const before = displayValue.slice(0, caret);
                  const after = displayValue.slice(caret);
                  const needsSpace = before.length > 0 && !/\s$/.test(before);
                  const insert = (needsSpace ? " " : "") + "@";
                  onValueChange(displayToReal(before + insert + after));
                  const newCaret = caret + insert.length;
                  requestAnimationFrame(() => {
                    el.focus();
                    el.setSelectionRange(newCaret, newCaret);
                    setMention({
                      open: true,
                      query: "",
                      anchorStart: newCaret - 1,
                      items: [],
                      loading: true,
                      activeIndex: 0,
                    });
                  });
                }}
              >
                <AtSign className="h-3 w-3" />
                Reference
              </Button>
              <Popover open={improvePopoverOpen} onOpenChange={setImprovePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5"
                    disabled={improving || showPreview}
                  >
                    {improving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {improving ? "Improving…" : "Improve with AI"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Improve with AI</p>
                      <p className="text-xs text-muted-foreground">Generates a revised version. You'll review a diff before anything changes.</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={improveMode === "polish" ? "default" : "outline"}
                        className="h-7 flex-1"
                        onClick={() => setImproveMode("polish")}
                      >
                        Polish & Clarify
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={improveMode === "custom" ? "default" : "outline"}
                        className="h-7 flex-1"
                        onClick={() => setImproveMode("custom")}
                      >
                        Custom
                      </Button>
                    </div>
                    {improveMode === "custom" && (
                      <PlainTextarea
                        value={improveInstruction}
                        onChange={(e) => setImproveInstruction(e.target.value)}
                        placeholder="e.g. Make it more technical and add bullet points"
                        rows={3}
                        className="text-sm"
                      />
                    )}
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      disabled={improving}
                      onClick={doImprove}
                    >
                      {improving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1.5 h-3 w-3" />}
                      Improve
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showPreview ? "Edit" : "Preview"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                disabled={busy || showPreview}
                onClick={() => fileInputRef.current?.click()}
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                {busy ? "Adding…" : "Add image"}
              </Button>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Review AI improvements</DialogTitle>
              <DialogDescription>
                Additions are highlighted in green, removals in red. Accept to apply the new version.
              </DialogDescription>
            </DialogHeader>
            <DiffView original={originalSnapshot} improved={improvedText} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setDiffOpen(false)}>
                Reject
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={improving}
                onClick={async () => {
                  setImproving(true);
                  try {
                    const { improved } = await runImprove({
                      data: {
                        content: originalSnapshot,
                        mode: improveMode,
                        instruction: improveMode === "custom" ? improveInstruction.trim() : undefined,
                      },
                    });
                    setImprovedText(improved);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Improve failed");
                  } finally {
                    setImproving(false);
                  }
                }}
              >
                {improving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
                Regenerate
              </Button>
              <Button type="button" onClick={acceptImproved}>
                Accept
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
);
ImageTextarea.displayName = "ImageTextarea";
