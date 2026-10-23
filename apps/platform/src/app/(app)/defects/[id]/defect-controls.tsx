"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CameraIcon, EditIcon, IssueClosedIcon, PlayIcon, UndoIcon } from "@/components/icons";
import { SeverityPicker } from "@/components/app/severity-picker";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { compressImage } from "@/lib/client/image";
import type { ActionResult, ErrorCode } from "@/lib/errors";
import type { DefectSeverity, DefectStatus } from "@/lib/supabase/database.types";
import {
  changeDefectSeverity,
  changeDefectStatus,
  commentDefect,
  editDefectDescription,
} from "../actions";
import { uploadDefectPhotos } from "../new/defect-form";

/** Runs an action, refreshes the page on success and reports errors as a toast. */
function useRun() {
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast(tErr(result.error), "danger");
        return;
      }
      after?.();
      router.refresh();
    });
  return { pending, run };
}

/** Status buttons (work on it, resolve with a note, reopen) and the severity. */
export function DefectStatusControls({
  id,
  status,
  severity,
}: {
  id: string;
  status: DefectStatus;
  severity: DefectSeverity;
}) {
  const t = useTranslations("defects.detail");
  const tDefects = useTranslations("defects");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const { pending, run } = useRun();
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<ErrorCode>();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {status === "open" && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => changeDefectStatus(id, "in_progress", null))}
          >
            <PlayIcon />
            {t("start")}
          </Button>
        )}
        {status !== "resolved" ? (
          <Button disabled={pending} onClick={() => setResolving(true)}>
            <IssueClosedIcon />
            {t("resolve")}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => changeDefectStatus(id, "open", null))}
          >
            <UndoIcon />
            {t("reopen")}
          </Button>
        )}
        {pending && <Spinner size={16} className="self-center" />}
      </div>
      <div className="space-y-1.5">
        <p className="text-ui font-medium">{tDefects("columns.severity")}</p>
        <SeverityPicker
          value={severity}
          label={t("changeSeverity")}
          disabled={pending}
          onChange={(next) => next && run(() => changeDefectSeverity(id, next))}
        />
      </div>

      <Dialog
        open={resolving}
        onOpenChange={setResolving}
        title={t("resolveTitle")}
        icon={IssueClosedIcon}
        closeLabel={tCommon("close")}
      >
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!note.trim()) {
              setNoteError("resolutionRequired");
              return;
            }
            run(
              () => changeDefectStatus(id, "resolved", note),
              () => {
                setResolving(false);
                setNote("");
              },
            );
          }}
        >
          <Field
            id="resolution-note"
            label={t("resolveNote")}
            error={noteError ? tErr(noteError) : undefined}
          >
            <Textarea
              rows={3}
              autoFocus
              placeholder={t("resolveNotePlaceholder")}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteError(undefined);
              }}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setResolving(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("resolve")}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

/** The description, editable in place. */
export function DescriptionEditor({ id, description }: { id: string; description: string }) {
  const t = useTranslations("defects.detail");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const { pending, run } = useRun();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description);

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-ui-lg break-words whitespace-pre-line">{description}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("editDescription")}
          onClick={() => {
            setValue(description);
            setEditing(true);
          }}
        >
          <EditIcon />
        </Button>
      </div>
    );
  }
  return (
    <form
      noValidate
      className="space-y-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () => editDefectDescription(id, { description: value }),
          () => setEditing(false),
        );
      }}
    >
      <label htmlFor="defect-description" className="sr-only">
        {t("description")}
      </label>
      <Textarea
        id="defect-description"
        rows={4}
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {!value.trim() && <p className="text-ui-sm text-destructive-text">{tErr("required")}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setEditing(false)}>
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={pending || !value.trim()}>
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}

/** A note in the history ("ordered a new seal"). */
export function CommentForm({ id }: { id: string }) {
  const t = useTranslations("defects.detail");
  const { pending, run } = useRun();
  const [note, setNote] = useState("");
  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!note.trim()) return;
        run(
          () => commentDefect(id, { note }),
          () => setNote(""),
        );
      }}
    >
      <label htmlFor="defect-comment" className="sr-only">
        {t("comment")}
      </label>
      <Textarea
        id="defect-comment"
        rows={2}
        placeholder={t("commentPlaceholder")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={pending || !note.trim()}>
          {t("addComment")}
        </Button>
      </div>
    </form>
  );
}

/** Adds a photo to the defect (compressed in the browser first). */
export function AddDefectPhoto({ id, organizationId }: { id: string; organizationId: string }) {
  const t = useTranslations("defects.detail");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function add(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const ok = await uploadDefectPhotos(organizationId, id, [blob]);
      if (!ok) toast(tErr("photoFailed"), "danger");
      router.refresh();
    } catch {
      toast(tErr("photoFailed"), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md surface-button px-3.5 text-ui font-medium whitespace-nowrap transition-colors hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] pointer-coarse:min-h-11 pointer-coarse:px-4">
      {busy ? <Spinner size={16} /> : <CameraIcon className="text-[var(--btn-icon)]" />}
      {t("addPhoto")}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={busy}
        data-testid="defect-add-photo"
        onChange={(event) => {
          void add(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </label>
  );
}
