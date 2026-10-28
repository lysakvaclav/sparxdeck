"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AddIcon, DocumentIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createProtocolTemplate } from "./actions";

// A new protocol template (part 22): a name and what it starts from (the
// default protocol or a copy of another template), then the editor.

export function NewTemplateButton({ sources }: { sources: { id: string; name: string }[] }) {
  const t = useTranslations("protocolTemplates.create");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(undefined);
      const result = await createProtocolTemplate({ name, from: from || null });
      if (!result.ok) {
        setError(tErr(result.fieldErrors?.name ?? result.error));
        return;
      }
      router.push(`/protocol-templates/${result.data.id}`);
    });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <AddIcon />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={t("title")} icon={DocumentIcon} closeLabel={tCommon("close")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field id="new-template-name" label={t("name")} error={error}>
            <Input value={name} maxLength={120} required autoFocus onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field id="new-template-from" label={t("from")} hint={t("fromHint")}>
            <NativeSelect value={from} onChange={(event) => setFrom(event.target.value)}>
              <option value="">{t("fromDefault")}</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {t("copyOf", { name: source.name })}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || name.trim() === ""}>
              {t("submit")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
