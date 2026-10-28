"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AddIcon, DocumentIcon, FileImportIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SAMPLE_TEMPLATES, type SampleTemplate } from "@/lib/protocol-template/samples";
import { createProtocolTemplate, importProtocolTemplate } from "./actions";

// A new protocol template (part 22): a name and what it starts from (the
// default protocol, a sample, or a copy of another template), or a file
// exported from another company. It opens in the editor as a draft.

export function NewTemplateButton({ sources }: { sources: { id: string; name: string }[] }) {
  const t = useTranslations("protocolTemplates.create");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  const submit = () =>
    start(async () => {
      setError(undefined);
      const sample = from.startsWith("sample:") ? (from.slice(7) as SampleTemplate) : null;
      const result = await createProtocolTemplate({
        name,
        from: from && !sample ? from : null,
        sample,
      });
      if (!result.ok) {
        setError(tErr(result.fieldErrors?.name ?? result.error));
        return;
      }
      router.push(`/protocol-templates/${result.data.id}`);
    });

  const importFile = () =>
    start(async () => {
      setError(undefined);
      const chosen = file.current?.files?.[0];
      if (!chosen) {
        setError(tErr("templateFileInvalid"));
        return;
      }
      const form = new FormData();
      form.set("file", chosen);
      form.set("name", name);
      const result = await importProtocolTemplate(form);
      if (!result.ok) {
        setError(tErr(result.fieldErrors?.name ?? result.error));
        return;
      }
      router.push(`/protocol-templates/${result.data.id}`);
    });

  const close = () => {
    setOpen(false);
    setImporting(false);
    setError(undefined);
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => { setImporting(true); setName(""); }}>
        <FileImportIcon />
        {t("import")}
      </Button>
      <Button onClick={() => setOpen(true)}>
        <AddIcon />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())} title={t("title")} icon={DocumentIcon} closeLabel={tCommon("close")}>
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
              <optgroup label={t("samples")}>
                {SAMPLE_TEMPLATES.map((sample) => (
                  <option key={sample} value={`sample:${sample}`}>
                    {t(`sample.${sample}`)}
                  </option>
                ))}
              </optgroup>
              {sources.length > 0 && (
                <optgroup label={t("copies")}>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {t("copyOf", { name: source.name })}
                    </option>
                  ))}
                </optgroup>
              )}
            </NativeSelect>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || name.trim() === ""}>
              {t("submit")}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={importing} onOpenChange={(value) => (value ? setImporting(true) : close())} title={t("importTitle")} icon={FileImportIcon} closeLabel={tCommon("close")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            importFile();
          }}
        >
          <p className="text-ui text-muted-foreground">{t("importExplain")}</p>
          <Field id="import-template-file" label={t("importFile")} error={error}>
            <Input
              ref={file}
              type="file"
              accept="application/json,.json"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
            />
          </Field>
          <Field id="import-template-name" label={t("importName")} hint={t("importNameHint")}>
            <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !fileName}>
              {t("importSubmit")}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
