import { forwardRef, useRef, useImperativeHandle, useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Eye, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const MAX_BYTES_AFTER = 1_800_000; // ~1.8MB cap on the data URL payload

async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Not an image");

  // SVGs: pass through unchanged
  if (file.type === "image/svg+xml") {
    return await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error("Read failed"));
      r.readAsDataURL(file);
    });
  }

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

  // Keep PNG for files with transparency, else compress to JPEG
  const outType = file.type === "image/png" || file.type === "image/gif" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(outType, JPEG_QUALITY);

  if (dataUrl.length > MAX_BYTES_AFTER * 1.37) {
    throw new Error("Image too large after compression — try a smaller one");
  }
  return dataUrl;
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

    const removeImage = (match: string) => {
      // Remove the markdown token and tidy surrounding blank lines.
      const next = value.replace(match, "").replace(/\n{3,}/g, "\n\n");
      onValueChange(next);
    };

    const insertAtCursor = (snippet: string) => {
      const el = innerRef.current;
      if (!el) {
        onValueChange(value + snippet);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + snippet + value.slice(end);
      onValueChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + snippet.length;
        el.setSelectionRange(pos, pos);
      });
    };

    const handleFiles = async (files: FileList | File[]) => {
      const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      setBusy(true);
      try {
        for (const f of images) {
          try {
            const url = await fileToDataUrl(f);
            const alt = f.name.replace(/\.[^.]+$/, "") || "image";
            insertAtCursor(`\n\n![${alt}](${url})\n\n`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Image failed");
          }
        }
      } finally {
        setBusy(false);
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
        void handleFiles(files);
      }
    };

    const onDrop: React.DragEventHandler<HTMLTextAreaElement> = (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0 && Array.from(files).some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        setDragOver(false);
        void handleFiles(files);
      }
    };

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
              <Markdown content={value} />
            ) : (
              <p className="text-muted-foreground italic">Nothing to preview yet.</p>
            )}
          </div>
        ) : (
          <Textarea
            ref={innerRef}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
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

        {!showPreview && images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div
                key={`${img.url.slice(0, 32)}-${i}`}
                className="group relative h-16 w-16 overflow-hidden rounded-md border border-border bg-muted"
                title={img.alt || "image"}
              >
                <img
                  src={img.url}
                  alt={img.alt}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.match)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 text-foreground opacity-0 shadow transition group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {toolbar && (
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>
              {showPreview
                ? "Preview"
                : `Paste or drop images · Markdown${images.length ? ` · ${images.length} image${images.length === 1 ? "" : "s"}` : ""}`}
            </span>
            <div className="flex items-center gap-1">
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
      </div>
    );
  },
);
ImageTextarea.displayName = "ImageTextarea";
