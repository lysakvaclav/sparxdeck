"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SendIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { publishProtocolTemplate } from "../actions";

// Publishing a template's draft as its next version (part 22, stage D), with
// a short note on what changed. What is left to fix keeps it from being
// published; protocols issued earlier keep the version they were drawn by.

export function PublishDialog({
  templateId,
  issues,
  saveFirst,
  disabled,
}: {
  templateId: string;
  /** What keeps the draft from being published, in words. */
  issues: string[];
  /** Saves the draft now (the editor saves a moment after each change). */
  saveFirst: () => Promise<boolean>;
  disabled: boolean;
}) {
  const t = useTranslations("protocolTemplates.publish");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const publish = () =>
    start(async () => {
      setError(undefined);
      if (!(await saveFirst())) {
        setError(tErr("unexpected"));
        return;
      }
      const result = await publishProtocolTemplate(templateId, note);
      if (!result.ok) {
        setError(tErr(result.fieldErrors?.note ?? result.error));
        return;
      }
      setOpen(false);
      setNote("");
      toast(t("done", { version: result.data.version }), "success");
      router.refresh();
    });

  return (
    <>
      <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <SendIcon />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={t("title")} icon={SendIcon} closeLabel={tCommon("close")}>
        {issues.length > 0 ? (
          <div className="space-y-3">
            <Alert>{t("blocked")}</Alert>
            <ul className="list-disc space-y-1 ps-5 text-ui">
              {issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {tCommon("close")}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              publish();
            }}
          >
            <p className="text-ui text-muted-foreground">{t("explain")}</p>
            <Field id="publish-note" label={t("note")} hint={t("noteHint")} error={error}>
              <Textarea
                value={note}
                maxLength={500}
                rows={3}
                required
                autoFocus
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={pending || note.trim() === ""}>
                {t("confirm")}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
