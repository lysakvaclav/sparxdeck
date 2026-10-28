"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  ListBulletedIcon,
  ListNumberedIcon,
  TextLinkIcon,
  TextUnlinkIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fromEditor, toEditor, type EditorNode } from "@/lib/protocol-template/rich-text";
import { safeLink, type RichText } from "@/lib/protocol-template/schema";
import { cn } from "@/lib/utils";
import { VariableMenu } from "./variable-menu";

// The formatted text of a protocol template (part 22, stage C): TipTap with
// only what the template knows (paragraphs, headings 2–3, lists, bold,
// italic, links). What it produces is turned into the template's own tree
// (rich-text.ts), so a paste can't bring anything else in.

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "primary" : "ghost"}
      size="iconSm"
      aria-label={label}
      aria-pressed={active ?? undefined}
      title={label}
      // Keep the editor's selection: the button doesn't take the focus.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const t = useTranslations("protocolTemplates.richText");
  const [href, setHref] = useState(() => String(editor.getAttributes("link").href ?? "https://"));
  const valid = safeLink.safeParse(href.trim()).success;
  const apply = () => {
    if (!valid) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
    onDone();
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border p-1.5">
      <label htmlFor="rich-link" className="sr-only">
        {t("linkAddress")}
      </label>
      <Input
        id="rich-link"
        className="min-w-0 flex-1"
        value={href}
        autoFocus
        aria-invalid={valid ? undefined : true}
        onChange={(event) => setHref(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
          if (event.key === "Escape") onDone();
        }}
      />
      <Button type="button" size="sm" disabled={!valid} onClick={apply}>
        {t("linkApply")}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onDone}>
        {t("linkCancel")}
      </Button>
      {!valid && <p className="w-full text-ui-sm text-destructive-text">{t("linkInvalid")}</p>}
    </div>
  );
}

export function RichTextEditor({
  id,
  label,
  hint,
  content,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  content: RichText;
  onChange: (content: RichText) => void;
}) {
  const t = useTranslations("protocolTemplates.richText");
  const labelId = useId();
  const [linking, setLinking] = useState(false);
  const editor = useEditor({
    // Drawn in the browser only (Next renders the page on the server first).
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        protocols: [],
        validate: (href) => safeLink.safeParse(href).success,
      }),
    ],
    content: toEditor(content),
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        ...(hint ? { "aria-describedby": `${id}-hint` } : {}),
        class: "rich-text min-h-32 px-2.5 py-2 text-ui outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onChange(fromEditor(current.getJSON() as EditorNode)),
  });

  // A change from elsewhere (undo, the phone's other view) replaces the text.
  useEffect(() => {
    if (!editor) return;
    const shown = fromEditor(editor.getJSON() as EditorNode);
    if (JSON.stringify(shown) !== JSON.stringify(content))
      editor.commands.setContent(toEditor(content), false);
  }, [content, editor]);

  const run = (action: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) =>
    editor && action(editor.chain().focus()).run();

  return (
    <div className="space-y-[5px]">
      <span id={labelId} className="block text-ui">
        {label}
      </span>
      <div className="overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_var(--border-strong)] focus-within:shadow-[inset_0_0_0_2px_var(--ring)]">
        <div role="toolbar" aria-label={t("toolbar")} className="flex flex-wrap items-center gap-0.5 border-b border-border p-1">
          <ToolbarButton label={t("bold")} active={editor?.isActive("bold")} onClick={() => run((c) => c.toggleBold())}>
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton label={t("italic")} active={editor?.isActive("italic")} onClick={() => run((c) => c.toggleItalic())}>
            <ItalicIcon />
          </ToolbarButton>
          <ToolbarButton label={t("heading2")} active={editor?.isActive("heading", { level: 2 })} onClick={() => run((c) => c.toggleHeading({ level: 2 }))}>
            <Heading2Icon />
          </ToolbarButton>
          <ToolbarButton label={t("heading3")} active={editor?.isActive("heading", { level: 3 })} onClick={() => run((c) => c.toggleHeading({ level: 3 }))}>
            <Heading3Icon />
          </ToolbarButton>
          <ToolbarButton label={t("bulletList")} active={editor?.isActive("bulletList")} onClick={() => run((c) => c.toggleBulletList())}>
            <ListBulletedIcon />
          </ToolbarButton>
          <ToolbarButton label={t("orderedList")} active={editor?.isActive("orderedList")} onClick={() => run((c) => c.toggleOrderedList())}>
            <ListNumberedIcon />
          </ToolbarButton>
          {editor?.isActive("link") ? (
            <ToolbarButton label={t("unlink")} onClick={() => run((c) => c.extendMarkRange("link").unsetLink())}>
              <TextUnlinkIcon />
            </ToolbarButton>
          ) : (
            <ToolbarButton label={t("link")} onClick={() => setLinking(true)}>
              <TextLinkIcon />
            </ToolbarButton>
          )}
          <span className="ms-auto">
            <VariableMenu label={t("variable")} onPick={(token) => run((c) => c.insertContent(token))} />
          </span>
        </div>
        {editor && linking && <LinkForm editor={editor} onDone={() => setLinking(false)} />}
        <EditorContent editor={editor} className={cn(!editor && "min-h-32")} />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-ui-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
