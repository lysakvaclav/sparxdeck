"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  DownloadIcon,
  DuplicateIcon,
  EditIcon,
  MoreIcon,
  StarIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { ProtocolTemplateStatus } from "@/lib/supabase/database.types";
import {
  archiveProtocolTemplate,
  createProtocolTemplate,
  setDefaultProtocolTemplate,
  unarchiveProtocolTemplate,
} from "./actions";

// What an owner or admin does with one template from the list (part 22,
// stage D): edit it, copy it, make it the default, archive or restore it,
// take it away as a file.

export function TemplateRowMenu({
  id,
  name,
  status,
  isDefault,
}: {
  id: string;
  name: string;
  status: ProtocolTemplateStatus;
  isDefault: boolean;
}) {
  const t = useTranslations("protocolTemplates.row");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [archiving, setArchiving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [copyError, setCopyError] = useState<string>();

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const result = await action();
      if (!result.ok) {
        toast(tErr((result.error ?? "unexpected") as "unexpected"), "danger");
        return;
      }
      toast(done, "success");
      setArchiving(false);
      router.refresh();
    });

  const copy = () =>
    start(async () => {
      setCopyError(undefined);
      const result = await createProtocolTemplate({ name: copyName, from: id });
      if (!result.ok) {
        setCopyError(tErr(result.fieldErrors?.name ?? result.error));
        return;
      }
      router.push(`/protocol-templates/${result.data.id}`);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="iconSm" aria-label={t("actions", { name })}>
            <MoreIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status !== "archived" && (
            <DropdownMenuItem asChild>
              <Link href={`/protocol-templates/${id}`}>
                <EditIcon />
                {t("edit")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setCopyName(t("copyName", { name }).slice(0, 120));
              setCopying(true);
            }}
          >
            <DuplicateIcon />
            {t("copy")}
          </DropdownMenuItem>
          {status === "published" && !isDefault && (
            <DropdownMenuItem onSelect={() => run(() => setDefaultProtocolTemplate(id), t("defaultDone", { name }))}>
              <StarIcon />
              {t("makeDefault")}
            </DropdownMenuItem>
          )}
          {status !== "draft" && (
            <DropdownMenuItem asChild>
              <a href={`/protocol-templates/${id}/export`} download>
                <DownloadIcon />
                {t("export")}
              </a>
            </DropdownMenuItem>
          )}
          {status === "archived" ? (
            <DropdownMenuItem onSelect={() => run(() => unarchiveProtocolTemplate(id), t("unarchiveDone", { name }))}>
              <ArchiveRestoreIcon />
              {t("unarchive")}
            </DropdownMenuItem>
          ) : (
            !isDefault && (
              <DropdownMenuItem onSelect={() => setArchiving(true)}>
                <ArchiveIcon />
                {t("archive")}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={t("archiveTitle", { name })}
        description={t("archiveDescription")}
        confirmLabel={t("archive")}
        cancelLabel={tCommon("cancel")}
        pending={pending}
        onConfirm={() => run(() => archiveProtocolTemplate(id), t("archiveDone", { name }))}
      />
      <Dialog open={copying} onOpenChange={setCopying} title={t("copyTitle")} icon={DuplicateIcon} closeLabel={tCommon("close")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            copy();
          }}
        >
          <Field id={`copy-name-${id}`} label={t("copyLabel")} error={copyError}>
            <Input value={copyName} maxLength={120} required autoFocus onChange={(event) => setCopyName(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCopying(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || copyName.trim() === ""}>
              {t("copySubmit")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
