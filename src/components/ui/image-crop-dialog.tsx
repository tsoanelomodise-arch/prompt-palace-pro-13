import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crop, SkipForward, X } from "lucide-react";

type Props = {
  file: File | null;
  onCancel: () => void;
  onResolved: (file: File) => void;
};

type Rect = { x: number; y: number; w: number; h: number };

/** Simple drag-to-select crop dialog. Returns a new File (or the original on skip). */
export function ImageCropDialog({ file, onCancel, onResolved }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState<null | { startX: number; startY: number }>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      setNatural(null);
      setRect(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    setRect(null);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const relPoint = (e: React.PointerEvent | PointerEvent) => {
    const el = imgRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!imgRef.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = relPoint(e);
    setDragging({ startX: p.x, startY: p.y });
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const p = relPoint(e);
    setRect({
      x: Math.min(dragging.startX, p.x),
      y: Math.min(dragging.startY, p.y),
      w: Math.abs(p.x - dragging.startX),
      h: Math.abs(p.y - dragging.startY),
    });
  };

  const onPointerUp = () => setDragging(null);

  const skip = useCallback(() => {
    if (file) onResolved(file);
  }, [file, onResolved]);

  const apply = useCallback(async () => {
    if (!file || !imgRef.current || !natural || !rect || rect.w < 5 || rect.h < 5) {
      skip();
      return;
    }
    const displayed = imgRef.current.getBoundingClientRect();
    const sx = natural.w / displayed.width;
    const sy = natural.h / displayed.height;
    const cw = Math.round(rect.w * sx);
    const ch = Math.round(rect.h * sy);
    const cx = Math.round(rect.x * sx);
    const cy = Math.round(rect.y * sy);
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return skip();
    ctx.drawImage(bitmap, cx, cy, cw, ch, 0, 0, cw, ch);
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), outType, 0.9));
    if (!blob) return skip();
    const nameBase = file.name.replace(/\.[^.]+$/, "");
    const ext = outType === "image/png" ? "png" : "jpg";
    const cropped = new File([blob], `${nameBase}-cropped.${ext}`, { type: outType });
    onResolved(cropped);
  }, [file, natural, rect, onResolved, skip]);

  const reset = () => setRect(null);

  const open = !!file;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Crop image</DialogTitle>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Drag on the image to select a region — or skip to insert as-is
          </p>
        </DialogHeader>

        <div
          ref={wrapRef}
          className="relative bg-paper-soft border border-border rounded-md overflow-hidden max-h-[65vh] flex items-center justify-center select-none"
        >
          {url && (
            <div className="relative inline-block">
              <img
                ref={imgRef}
                src={url}
                alt="To crop"
                draggable={false}
                onLoad={(e) => {
                  const t = e.currentTarget;
                  setNatural({ w: t.naturalWidth, h: t.naturalHeight });
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="block max-h-[60vh] max-w-full cursor-crosshair touch-none"
                style={{ userSelect: "none" }}
              />
              {rect && rect.w > 2 && rect.h > 2 && (
                <>
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        `linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45))`,
                      WebkitMaskImage:
                        `linear-gradient(#000,#000), linear-gradient(#000,#000)`,
                      WebkitMaskComposite: "xor",
                      maskComposite: "exclude",
                      clipPath: `polygon(
                        0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                        ${rect.x}px ${rect.y}px,
                        ${rect.x}px ${rect.y + rect.h}px,
                        ${rect.x + rect.w}px ${rect.y + rect.h}px,
                        ${rect.x + rect.w}px ${rect.y}px,
                        ${rect.x}px ${rect.y}px
                      )`,
                    }}
                  />
                  <div
                    className="absolute border-2 border-foreground/90 pointer-events-none shadow"
                    style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!rect}>
              <X className="h-3.5 w-3.5 mr-1.5" /> Clear selection
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={skip}>
              <SkipForward className="h-3.5 w-3.5 mr-1.5" /> Skip crop
            </Button>
            <Button type="button" size="sm" onClick={apply} disabled={!rect || rect.w < 5 || rect.h < 5}>
              <Crop className="h-3.5 w-3.5 mr-1.5" /> Crop &amp; insert
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
