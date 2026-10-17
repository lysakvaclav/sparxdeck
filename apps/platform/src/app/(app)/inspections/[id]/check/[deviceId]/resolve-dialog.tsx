"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { IssueClosedIcon } from "@/components/icons";
import { DefectRef, SeverityBadge } from "@/components/app/defect-badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { OpenDefect } from "./device-check";

/**
 * After a passed check of a device with open defects: were they fixed? The
 * chosen ones are resolved with a note (the app requires one for resolving).
 */
export function ResolveDialog({
  defects,
  pending,
  onResolve,
  onKeep,
}: {
  defects: OpenDefect[];
  pending: boolean;
  onResolve: (ids: string[], note: string) => void;
  onKeep: () => void;
}) {
  const t = useTranslations("inspections.resolve");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(defects.map((defect) => defect.id)),
  );
  const [note, setNote] = useState(() =>
    t("defaultNote", { date: format.dateTime(new Date(), { dateStyle: "medium" }) }),
  );

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onKeep()}
      title={t("title")}
      icon={IssueClosedIcon}
      closeLabel={tCommon("close")}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onResolve([...chosen], note);
        }}
      >
        <p className="text-ui">{t("body")}</p>
        <ul className="space-y-1.5">
          {defects.map((defect) => (
            <li key={defect.id}>
              <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md p-2 shadow-[inset_0_0_0_1px_var(--border)]">
                <Checkbox
                  className="mt-0.5"
                  checked={chosen.has(defect.id)}
                  onCheckedChange={(value) =>
                    setChosen((current) => {
                      const next = new Set(current);
                      if (value) next.add(defect.id);
                      else next.delete(defect.id);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">
                      <DefectRef number={defect.number} />
                    </span>
                    <SeverityBadge severity={defect.severity} />
                  </span>
                  <span className="block text-ui-sm break-words text-muted-foreground">
                    {defect.description}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <Field id="resolve-note" label={t("note")}>
          <Textarea
            rows={2}
            maxLength={2000}
            autoCapitalize="sentences"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onKeep}>
            {t("keep")}
          </Button>
          <Button type="submit" disabled={pending || chosen.size === 0 || !note.trim()}>
            {pending && <Spinner size={16} />}
            {t("submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
