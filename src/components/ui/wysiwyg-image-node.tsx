import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { cn } from "@/lib/utils";
import {
  IMAGE_SIZES,
  SIZE_LABEL,
  parseImageAlt,
  encodeImageAlt,
  imageStyleForSize,
  type ImageSize,
} from "@/lib/image-size";

function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const src = node.attrs.src as string;
  const rawAlt = (node.attrs.alt as string) ?? "";
  const { alt, size } = parseImageAlt(rawAlt);

  const setSize = (next: ImageSize) => {
    updateAttributes({ alt: encodeImageAlt(alt, next) });
  };

  return (
    <NodeViewWrapper
      className="relative my-3 inline-block max-w-full"
      data-selected={selected ? "true" : "false"}
      style={{ width: size === "full" ? "100%" : "auto" }}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        src={src}
        alt={alt}
        style={imageStyleForSize(size)}
        className={cn(
          "rounded-md border border-border transition",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
        draggable
      />
      {selected && (
        <div
          contentEditable={false}
          className="absolute left-1/2 top-1 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-popover/95 px-1 py-1 shadow-md backdrop-blur"
        >
          {IMAGE_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setSize(s);
              }}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition",
                size === s
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-paper-soft hover:text-foreground",
              )}
              title={`Size: ${s}`}
            >
              {SIZE_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
