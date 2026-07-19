export type ImageSize = "small" | "medium" | "large" | "full";

export const IMAGE_SIZES: ImageSize[] = ["small", "medium", "large", "full"];

export const SIZE_LABEL: Record<ImageSize, string> = {
  small: "S",
  medium: "M",
  large: "L",
  full: "Full",
};

// Rendered max widths (px), except "full" which stretches to container.
export const SIZE_MAX_WIDTH: Record<ImageSize, string> = {
  small: "240px",
  medium: "480px",
  large: "800px",
  full: "100%",
};

const DEFAULT_SIZE: ImageSize = "full";

/** Parse `alt|size` markdown alt text into a plain alt + size hint.
 *  Legacy images without a size hint fall back to "full" so they render at
 *  container width (matching pre-sizing behavior). */
export function parseImageAlt(raw: string): { alt: string; size: ImageSize } {
  const m = raw.match(/^(.*)\|(small|medium|large|full)\s*$/i);
  if (!m) return { alt: raw, size: DEFAULT_SIZE };
  return { alt: m[1].trim(), size: m[2].toLowerCase() as ImageSize };
}

/** Build a raw alt string that encodes a size hint. */
export function encodeImageAlt(alt: string, size: ImageSize): string {
  const cleanAlt = alt.replace(/\|(small|medium|large|full)\s*$/i, "").trim();
  return `${cleanAlt}|${size}`;
}

/** Rewrite a single `![alt](url)` markdown token to use the given size. */
export function rewriteImageMarkdownSize(match: string, size: ImageSize): string {
  const m = match.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
  if (!m) return match;
  const nextAlt = encodeImageAlt(m[1], size);
  return `![${nextAlt}](${m[2]})`;
}

/** Inline style for a rendered <img> given its size hint. */
export function imageStyleForSize(size: ImageSize): React.CSSProperties {
  if (size === "full") return { width: "100%", height: "auto" };
  return { maxWidth: SIZE_MAX_WIDTH[size], width: "100%", height: "auto" };
}
