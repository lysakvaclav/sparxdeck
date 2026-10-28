"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AddIcon, CrossIcon, RedoIcon, UndoIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useToast } from "@/components/ui/toast";
import {
  BLOCK_TYPES,
  addBlock,
  canAdd,
  duplicateBlock,
  moveBlock,
  record,
  redo,
  removeBlock,
  shiftBlock,
  startHistory,
  templateIssues,
  undo,
  updateBlock,
  type History,
} from "@/lib/protocol-template/editor";
import { TEMPLATE_LIMITS, type BlockOf, type ProtocolTemplate, type TemplateBlock } from "@/lib/protocol-template/schema";
import { cn } from "@/lib/utils";
import { discardProtocolTemplateDraft, renameProtocolTemplate, saveProtocolTemplateDraft } from "../actions";
import { BlockList, type BlockActions } from "./block-list";
import { BlockProperties, TextBody, type Placeholders } from "./block-properties";
import { PageProperties } from "./page-properties";
import { EditorEnvironmentContext, type EditorEnvironment } from "./editor-context";
import { PdfPreview } from "./pdf-preview";

// The protocol template editor (part 22, stage B): blocks on the left, the
// live preview in the middle, the selected block's (or the page's)
// properties on the right. Every change is kept as the template's draft a
// moment later; publishing it as a new version is stage D. On a phone: the
// preview and the texts only.

type SaveState = "saved" | "pending" | "saving" | "failed";
const SAVE_AFTER_MS = 1000;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function TemplateEditor({
  templateId,
  name: initialName,
  description: initialDescription,
  published,
  hasDraft,
  initial,
  placeholders,
  inspections,
  fileName,
  deviceTypes,
  logoUrls: initialLogoUrls,
}: {
  templateId: string;
  name: string;
  description: string;
  /** It has a published version to go back to. */
  published: boolean;
  hasDraft: boolean;
  initial: ProtocolTemplate;
  placeholders: Placeholders;
  inspections: { id: string; label: string }[];
  fileName: string;
  /** The company's device types (a block may show only for one). */
  deviceTypes: string[];
  /** Links to show the template's own logos, by their path. */
  logoUrls: Record<string, string>;
}) {
  const t = useTranslations("protocolTemplates.editor");
  const tBlocks = useTranslations("protocolTemplates.blocks");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [history, setHistory] = useState<History>(() => startHistory(initial));
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  const template = history.present;
  const [selected, setSelected] = useState<string | null>(null);
  const [inspection, setInspection] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"preview" | "texts">("preview");
  const [save, setSave] = useState<SaveState>("saved");
  const savedRef = useRef<ProtocolTemplate>(initial);
  const [draftExists, setDraftExists] = useState(hasDraft);
  const [discarding, setDiscarding] = useState(false);
  const [pendingDiscard, startDiscard] = useTransition();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [renaming, startRename] = useTransition();
  const [nameError, setNameError] = useState<string>();

  const [logoUrls, setLogoUrls] = useState(initialLogoUrls);
  const environment: EditorEnvironment = useMemo(
    () => ({
      templateId,
      deviceTypes,
      logoUrls,
      addLogoUrl: (path, url) => setLogoUrls((current) => ({ ...current, [path]: url })),
    }),
    [templateId, deviceTypes, logoUrls],
  );

  const change = useCallback((next: ProtocolTemplate, mergeKey: string | null = null) => {
    setHistory((current) => record(current, next, mergeKey));
  }, []);

  // ---- Saving the draft -----------------------------------------------------
  const saveNow = useCallback(async () => {
    const sent = historyRef.current.present;
    if (sent === savedRef.current) {
      setSave("saved");
      return;
    }
    setSave("saving");
    const result = await saveProtocolTemplateDraft(templateId, sent);
    if (!result.ok) {
      setSave("failed");
      return;
    }
    savedRef.current = sent;
    setDraftExists(true);
    setSave(historyRef.current.present === sent ? "saved" : "pending");
  }, [templateId]);

  useEffect(() => {
    if (template === savedRef.current) return;
    setSave("pending");
    const timer = window.setTimeout(() => void saveNow(), SAVE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [template, saveNow]);

  useEffect(() => {
    if (save === "saved") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  // ---- Blocks ---------------------------------------------------------------
  const actions: BlockActions = useMemo(
    () => ({
      select: (id) => setSelected((current) => (current === id ? null : id)),
      move: (from, to) => change(moveBlock(historyRef.current.present, from, to)),
      shift: (id, step) => change(shiftBlock(historyRef.current.present, id, step)),
      toggleHidden: (id) =>
        change(updateBlock(historyRef.current.present, id, (block) => ({ ...block, hidden: !block.hidden || undefined }))),
      duplicate: (id) => {
        const result = duplicateBlock(historyRef.current.present, id);
        change(result.template);
        if (result.id) setSelected(result.id);
      },
      remove: (id) => {
        change(removeBlock(historyRef.current.present, id));
        setSelected(null);
        toast(t("removed"));
      },
    }),
    [change, t, toast],
  );

  const add = (type: TemplateBlock["type"]) => {
    const result = addBlock(template, type, selected);
    change(result.template);
    if (result.id) setSelected(result.id);
  };

  const names = useMemo(() => {
    const seen = new Map<string, number>();
    const result: Record<string, string> = {};
    for (const block of template.blocks) {
      let base = tBlocks(`types.${block.type}`);
      if ("title" in block && block.title) base = block.title;
      else if (block.type === "text" && block.content[0] && block.content[0].type !== "list") {
        const words = block.content[0].content.map((inline) => inline.text).join("").trim();
        if (words) base = `${base}: ${words.length > 28 ? `${words.slice(0, 28)}…` : words}`;
      }
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      result[block.id] = count > 1 ? `${base} (${count})` : base;
    }
    return result;
  }, [template.blocks, tBlocks]);

  const issues = useMemo(() => templateIssues(template), [template]);
  const issueBlocks = useMemo(
    () => new Set(issues.flatMap((issue) => (issue.blockId ? [issue.blockId] : []))),
    [issues],
  );
  const selectedBlock = template.blocks.find((block) => block.id === selected) ?? null;

  // ---- Keyboard -------------------------------------------------------------
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        setHistory(undo);
      } else if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        setHistory(redo);
      } else if (mod && key === "s") {
        event.preventDefault();
        void saveNow();
      } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown") && selected && !isTyping(event.target)) {
        event.preventDefault();
        actions.shift(selected, event.key === "ArrowUp" ? -1 : 1);
      } else if (event.key === "Escape" && selected && !isTyping(event.target)) {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, saveNow, selected]);

  const changeBlock = (block: TemplateBlock, field: string) =>
    change(updateBlock(template, block.id, () => block), `${block.id}.${field}`);

  const rename = () =>
    startRename(async () => {
      setNameError(undefined);
      const result = await renameProtocolTemplate(templateId, { name, description });
      if (!result.ok) {
        setNameError(tErr(result.fieldErrors?.name ?? result.error));
        return;
      }
      toast(t("renamed"), "success");
      router.refresh();
    });

  const discard = () =>
    startDiscard(async () => {
      const result = await discardProtocolTemplateDraft(templateId);
      if (!result.ok) {
        toast(tErr(result.error), "danger");
        return;
      }
      setDiscarding(false);
      // The page comes back with the published version; the editor starts over
      // from it (its key follows the draft).
      savedRef.current = historyRef.current.present;
      router.refresh();
    });

  const saveLabel = {
    saved: draftExists ? t("save.saved") : t("save.unchanged"),
    pending: t("save.pending"),
    saving: t("save.saving"),
    failed: t("save.failed"),
  }[save];

  /** The protocol's own heading a block shows while its title is empty. */
  const defaultTitle = (type: TemplateBlock["type"]) =>
    ({
      header: placeholders.title,
      summary: placeholders.summary,
      devices: placeholders.devices,
      checklist: placeholders.checklist,
      defects: placeholders.defects,
      gallery: placeholders.gallery,
      notes: placeholders.notes,
    })[type as string];

  const textBlocks = template.blocks.filter(
    (block): block is TemplateBlock & { title: string | null } => "title" in block,
  );

  return (
    <EditorEnvironmentContext.Provider value={environment}>
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 px-4 py-1.5 shadow-[inset_0_-1px_0_var(--border)]">
        <Button variant="outline" size="iconSm" aria-label={t("undo")} title={t("undoShortcut")} disabled={history.past.length === 0} onClick={() => setHistory(undo)}>
          <UndoIcon />
        </Button>
        <Button variant="outline" size="iconSm" aria-label={t("redo")} title={t("redoShortcut")} disabled={history.future.length === 0} onClick={() => setHistory(redo)}>
          <RedoIcon />
        </Button>
        <p
          className={cn("min-w-0 flex-1 truncate text-ui", save === "failed" ? "text-destructive-text" : "text-muted-foreground")}
          role="status"
          aria-live="polite"
        >
          {saveLabel}
          {save === "failed" && (
            <Button variant="link" className="ms-2" onClick={() => void saveNow()}>
              {t("save.retry")}
            </Button>
          )}
        </p>
        {published && draftExists && (
          <Button variant="outline" size="sm" onClick={() => setDiscarding(true)}>
            <CrossIcon />
            {t("discard")}
          </Button>
        )}
        <label htmlFor="preview-source" className="sr-only">
          {t("previewSource")}
        </label>
        <NativeSelect
          id="preview-source"
          className="w-auto max-w-[280px]"
          value={inspection ?? ""}
          onChange={(event) => setInspection(event.target.value || null)}
        >
          <option value="">{t("sampleData")}</option>
          {inspections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <Alert className="m-3 lg:hidden">{t("mobileNotice")}</Alert>
      <div className="flex shrink-0 gap-1 px-3 lg:hidden" role="tablist" aria-label={t("mobileTabs")}>
        {(["preview", "texts"] as const).map((tab) => (
          <Button
            key={tab}
            role="tab"
            aria-selected={mobileTab === tab}
            variant={mobileTab === tab ? "primary" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setMobileTab(tab)}
          >
            {t(`tabs.${tab}`)}
          </Button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Blocks (desktop) */}
        <aside className="hidden min-h-0 w-[300px] shrink-0 flex-col shadow-[inset_-1px_0_0_var(--border)] lg:flex" aria-label={t("blocksLabel")}>
          <div className="flex min-h-10 items-center gap-2 px-3 shadow-[inset_0_-1px_0_var(--border)]">
            <h2 className="flex-1 text-ui font-semibold">{t("blocks")}</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <AddIcon />
                  {t("addBlock")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
                {BLOCK_TYPES.map((type) => (
                  <DropdownMenuItem key={type} disabled={!canAdd(template, type)} onSelect={() => add(type)}>
                    {tBlocks(`types.${type}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-3">
            <BlockList blocks={template.blocks} selected={selected} names={names} issues={issueBlocks} actions={actions} />
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-current={selected === null ? "true" : undefined}
              className={cn(
                "mt-3 flex min-h-10 w-full items-center rounded-lg px-3 text-start text-ui shadow-[inset_0_0_0_1px_var(--border)] outline-none focus-visible:underline",
                selected === null && "shadow-[inset_0_0_0_2px_var(--ring)]",
              )}
            >
              {t("pageAndFooter")}
            </button>
            {issues.length > 0 && (
              <section className="mt-4" aria-labelledby="template-issues">
                <h3 id="template-issues" className="mb-1.5 text-ui font-semibold text-destructive-text">
                  {t("issues")}
                </h3>
                <ul className="space-y-1">
                  {issues.map((issue, index) => (
                    <li key={index}>
                      <Button
                        variant="link"
                        className="text-start whitespace-normal"
                        onClick={() => setSelected(issue.blockId ?? null)}
                      >
                        {issue.kind === "invalid"
                          ? t("issue.invalid", { block: issue.blockId ? (names[issue.blockId] ?? "") : t("pageAndFooter") })
                          : issue.code === "unknownVariable"
                            ? t("issue.unknownVariable", {
                                variable: `{{${issue.variable}}}`,
                                block: issue.blockId ? (names[issue.blockId] ?? "") : t("pageAndFooter"),
                              })
                            : t(`issue.${issue.code}`)}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="mt-4 text-ui-sm text-muted-foreground">{t("shortcuts")}</p>
          </div>
        </aside>

        {/* Preview */}
        <section
          className={cn("flex min-h-[60dvh] min-w-0 flex-1 flex-col lg:min-h-0", mobileTab !== "preview" && "max-lg:hidden")}
          aria-label={t("previewLabel")}
        >
          <PdfPreview template={template} inspectionId={inspection} fileName={fileName} />
        </section>

        {/* Texts (phone) */}
        <section className={cn("space-y-4 p-3 lg:hidden", mobileTab !== "texts" && "hidden")} aria-label={t("tabs.texts")}>
          {textBlocks.map((block) => (
            <div key={block.id} className="space-y-2">
              <Field id={`m-${block.id}-title`} label={t("titleOf", { block: names[block.id] ?? "" })}>
                <Input
                  value={block.title ?? ""}
                  placeholder={defaultTitle(block.type)}
                  maxLength={TEMPLATE_LIMITS.title}
                  onChange={(event) =>
                    changeBlock({ ...block, title: event.target.value === "" ? null : event.target.value } as TemplateBlock, "title")
                  }
                />
              </Field>
              {block.type === "text" && <TextBody block={block as BlockOf<"text">} onChange={changeBlock} idPrefix="m-" />}
            </div>
          ))}
        </section>

        {/* Properties (desktop) */}
        <aside className="hidden min-h-0 w-[340px] shrink-0 flex-col shadow-[inset_1px_0_0_var(--border)] lg:flex" aria-label={t("propertiesLabel")}>
          <div className="flex min-h-10 items-center px-4 shadow-[inset_0_-1px_0_var(--border)]">
            <h2 className="truncate text-ui font-semibold">
              {selectedBlock ? names[selectedBlock.id] : t("pageAndFooter")}
            </h2>
          </div>
          <div className="min-h-0 flex-1 space-y-4 scrollbar-thin overflow-y-auto p-4">
            {selectedBlock ? (
              <BlockProperties key={selectedBlock.id} block={selectedBlock} onChange={changeBlock} placeholders={placeholders} />
            ) : (
              <>
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    rename();
                  }}
                >
                  <Field id="template-name" label={t("name")} error={nameError}>
                    <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
                  </Field>
                  <Field id="template-description" label={t("description")}>
                    <Input value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} />
                  </Field>
                  <Button type="submit" variant="outline" size="sm" disabled={renaming || (name === initialName && description === initialDescription)}>
                    {t("rename")}
                  </Button>
                </form>
                <PageProperties template={template} onChange={change} />
              </>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t("discardTitle")}
        description={t("discardDescription")}
        confirmLabel={t("discard")}
        cancelLabel={tCommon("cancel")}
        destructive
        pending={pendingDiscard}
        onConfirm={discard}
      />
    </div>
    </EditorEnvironmentContext.Provider>
  );
}
