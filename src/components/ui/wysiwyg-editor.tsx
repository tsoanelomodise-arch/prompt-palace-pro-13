import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Undo, Redo, Link as LinkIcon, ImagePlus,
  Minus, CodeSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

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
  if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "URL failed");
  return signed.signedUrl;
}

type ToolButtonProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolButton({ onClick, active, disabled, title, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 inline-flex items-center justify-center rounded transition",
        "hover:bg-paper-soft text-muted-foreground hover:text-foreground",
        active && "bg-paper-soft text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const promptLink = useCallback(() => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const insertImage = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch (e: any) {
        toast.error(e?.message ?? "Upload failed");
      }
    };
    input.click();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5 bg-paper">
      <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
        <Bold className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
        <Italic className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code">
        <Code className="h-3.5 w-3.5" />
      </ToolButton>
      <div className="w-px h-5 bg-border mx-1" />
      <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
        <Heading1 className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
        <Heading2 className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
        <Heading3 className="h-3.5 w-3.5" />
      </ToolButton>
      <div className="w-px h-5 bg-border mx-1" />
      <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bulleted list">
        <List className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
        <Quote className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">
        <CodeSquare className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
        <Minus className="h-3.5 w-3.5" />
      </ToolButton>
      <div className="w-px h-5 bg-border mx-1" />
      <ToolButton onClick={promptLink} active={editor.isActive("link")} title="Link">
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={insertImage} title="Insert image">
        <ImagePlus className="h-3.5 w-3.5" />
      </ToolButton>
      <div className="w-px h-5 bg-border mx-1" />
      <ToolButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo className="h-3.5 w-3.5" />
      </ToolButton>
    </div>
  );
}

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

export function WysiwygEditor({ value, onValueChange, placeholder, className }: Props) {
  const lastEmitted = useRef<string>(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-4 py-4 min-h-[420px]",
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        (async () => {
          for (const file of files) {
            try {
              const url = await uploadImage(file);
              editor?.chain().focus().setImage({ src: url }).run();
            } catch (e: any) {
              toast.error(e?.message ?? "Upload failed");
            }
          }
        })();
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        (async () => {
          for (const file of files) {
            try {
              const url = await uploadImage(file);
              editor?.chain().focus().setImage({ src: url }).run();
            } catch (e: any) {
              toast.error(e?.message ?? "Upload failed");
            }
          }
        })();
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const md = (editor.storage.markdown.getMarkdown() as string) ?? "";
      lastEmitted.current = md;
      onValueChange(md);
    },
  });

  // Sync external value changes (e.g., AI improve replacing content, initial hydration).
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    editor.commands.setContent(value, { emitUpdate: false });
    lastEmitted.current = value;
  }, [value, editor]);

  useEffect(() => () => editor?.destroy(), [editor]);

  if (!editor) {
    return (
      <div className={cn("border border-border rounded-md bg-background", className)}>
        <div className="h-[460px]" />
      </div>
    );
  }

  return (
    <div className={cn("border border-border rounded-md bg-background overflow-hidden", className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
