"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { DownloadIcon, HistoryIcon, UndoIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { useToast } from "@/components/ui/toast";
import { diffTemplates, isEmptyDiff } from "@/lib/protocol-template/diff";
import type { ProtocolTemplate, TemplateBlock } from "@/lib/protocol-template/schema";
import { restoreProtocolTemplateVersion } from "../actions";

// A template's history (part 22, stage D): its published versions (who, when,
// the note), any of them back as the draft or as a file, two of them (or one
// and the draft) compared, and everything done with the template.

export type HistoryVersion = {
  id: string;
  version: number;
  note: string;
  by: string | null;
  at: string;
  content: ProtocolTemplate;
};

export type HistoryEvent = {
  kind: string;
  version: number | null;
  note: string | null;
  by: string | null;
  at: string;
};

const DRAFT = "draft";

export function HistoryDialog({
  templateId,
  versions,
  events,
  draft,
  hasDraft,
  archived,
}: {
  templateId: string;
  versions: HistoryVersion[];
  events: HistoryEvent[];
  /** The draft as the editor has it now. */
  draft: ProtocolTemplate;
  hasDraft: boolean;
  archived: boolean;
}) {
  const t = useTranslations("protocolTemplates.history");
  const tBlocks = useTranslations("protocolTemplates.blocks");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState<HistoryVersion | null>(null);
  const [pending, start] = useTransition();
  const newest = versions[0];
  const [left, setLeft] = useState(versions[1]?.id ?? newest?.id ?? DRAFT);
  const [right, setRight] = useState(hasDraft || versions.length < 2 ? DRAFT : (newest?.id ?? DRAFT));

  const contentOf = (choice: string) =>
    choice === DRAFT ? draft : (versions.find((version) => version.id === choice)?.content ?? draft);
  const diff = useMemo(() => diffTemplates(contentOf(left), contentOf(right)), [left, right, versions, draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (block: TemplateBlock) => {
    const kind = tBlocks(`types.${block.type}`);
    return "title" in block && block.title ? `${kind}: ${block.title}` : kind;
  };
  const when = (at: string) => format.dateTime(new Date(at), { dateStyle: "medium", timeStyle: "short" });
  const choices = [
    { value: DRAFT, label: t("draft") },
    ...versions.map((version) => ({ value: version.id, label: t("versionLabel", { version: version.version }) })),
  ];

  const restore = () =>
    start(async () => {
      if (!restoring) return;
      const result = await restoreProtocolTemplateVersion(restoring.id);
      if (!result.ok) {
        toast(tErr(result.error), "danger");
        return;
      }
      toast(t("restored", { version: restoring.version }), "success");
      setRestoring(null);
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HistoryIcon />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={t("title")} icon={HistoryIcon} closeLabel={tCommon("close")} className="max-w-[760px]">
        <div className="space-y-6">
          <section aria-labelledby="history-versions">
            <h3 id="history-versions" className="mb-2 text-ui font-semibold">
              {t("versions")}
            </h3>
            {versions.length === 0 ? (
              <p className="text-ui text-muted-foreground">{t("noVersions")}</p>
            ) : (
              <ol className="divide-y divide-border rounded-lg shadow-[inset_0_0_0_1px_var(--border)]">
                {versions.map((version) => (
                  <li key={version.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <span className="font-semibold tabular-nums">{t("versionLabel", { version: version.version })}</span>
                    <span className="min-w-0 flex-1 text-ui">{version.note}</span>
                    <span className="text-ui-sm text-muted-foreground">
                      {[version.by, when(version.at)].filter(Boolean).join(" · ")}
                    </span>
                    <span className="flex gap-1">
                      <Button asChild variant="ghost" size="iconSm" aria-label={t("export", { version: version.version })} title={t("export", { version: version.version })}>
                        <a href={`/protocol-templates/${templateId}/export?version=${version.version}`} download>
                          <DownloadIcon />
                        </a>
                      </Button>
                      {!archived && (
                        <Button variant="ghost" size="iconSm" aria-label={t("restore", { version: version.version })} title={t("restore", { version: version.version })} onClick={() => setRestoring(version)}>
                          <UndoIcon />
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {(versions.length > 1 || (versions.length > 0 && hasDraft)) && (
            <section aria-labelledby="history-compare" className="space-y-2">
              <h3 id="history-compare" className="text-ui font-semibold">
                {t("compare")}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="compare-left" className="sr-only">
                  {t("compareFrom")}
                </label>
                <NativeSelect id="compare-left" className="w-auto" value={left} onChange={(event) => setLeft(event.target.value)}>
                  {choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </NativeSelect>
                <span aria-hidden>→</span>
                <label htmlFor="compare-right" className="sr-only">
                  {t("compareTo")}
                </label>
                <NativeSelect id="compare-right" className="w-auto" value={right} onChange={(event) => setRight(event.target.value)}>
                  {choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {isEmptyDiff(diff) ? (
                <p className="text-ui text-muted-foreground">{t("same")}</p>
              ) : (
                <ul className="list-disc space-y-1 ps-5 text-ui" aria-live="polite">
                  {diff.added.map((block) => (
                    <li key={`a-${block.id}`}>{t("added", { block: name(block) })}</li>
                  ))}
                  {diff.removed.map((block) => (
                    <li key={`r-${block.id}`}>{t("removed", { block: name(block) })}</li>
                  ))}
                  {diff.changed.map((change) => (
                    <li key={`c-${change.after.id}`}>{t("changed", { block: name(change.after) })}</li>
                  ))}
                  {diff.reordered && <li>{t("reordered")}</li>}
                  {diff.settings.map((setting) => (
                    <li key={setting}>{t(`settings.${setting}`)}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section aria-labelledby="history-events">
            <h3 id="history-events" className="mb-2 text-ui font-semibold">
              {t("events")}
            </h3>
            <ol className="space-y-1.5 text-ui">
              {events.map((event, index) => (
                <li key={index} className="flex flex-wrap gap-x-2">
                  <span className="text-muted-foreground tabular-nums">{when(event.at)}</span>
                  <span>
                    {t(`kinds.${event.kind}` as "kinds.created", { version: event.version ?? 0 })}
                    {event.note ? `: ${event.note}` : ""}
                  </span>
                  {event.by && <span className="text-muted-foreground">({event.by})</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </Dialog>
      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(value) => !value && setRestoring(null)}
        title={t("restoreTitle", { version: restoring?.version ?? 0 })}
        description={hasDraft ? t("restoreReplaces") : t("restoreDescription")}
        confirmLabel={t("restoreConfirm")}
        cancelLabel={tCommon("cancel")}
        pending={pending}
        onConfirm={restore}
      />
    </>
  );
}
