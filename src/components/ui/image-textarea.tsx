import { forwardRef, useRef, useImperativeHandle, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
        {toolbar && (
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>Paste or drop images · Markdown</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
              {busy ? "Adding…" : "Add image"}
            </Button>
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
