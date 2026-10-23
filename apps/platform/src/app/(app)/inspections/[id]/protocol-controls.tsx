"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EnvelopeIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import type { ErrorCode } from "@/lib/errors";
import { protocolEmailSchema } from "@/lib/validation";
import { createProtocol, sendProtocol } from "../protocol-actions";

/** Creates the protocol's PDF (when it failed on completion, or for older inspections). */
export function GenerateProtocolButton({ inspectionId }: { inspectionId: string }) {
  const t = useTranslations("protocol.card");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createProtocol(inspectionId);
          if (!result.ok) {
            toast(tErr(result.error), "danger");
            return;
          }
          toast(t("generated", { number: result.data.number }), "success");
          router.refresh();
        })
      }
    >
      {pending && <Spinner size={16} />}
      {t("generate")}
    </Button>
  );
}

/** "Send by e-mail": one recipient, the customer's address offered first. */
export function SendProtocolButton({
  protocolId,
  defaultEmail,
  enabled,
}: {
  protocolId: string;
  defaultEmail: string | null;
  enabled: boolean;
}) {
  const t = useTranslations("protocol.card");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [fieldError, setFieldError] = useState<ErrorCode>();
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = protocolEmailSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError((parsed.error.issues[0]?.message as ErrorCode) ?? "emailInvalid");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await sendProtocol(protocolId, parsed.data);
      if (!result.ok) {
        if (result.fieldErrors?.email) setFieldError(result.fieldErrors.email);
        else setError(result.error);
        return;
      }
      setOpen(false);
      toast(t("sent", { email: parsed.data.email }), "success");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setEmail(defaultEmail ?? "");
          setFieldError(undefined);
          setError(undefined);
          setOpen(true);
        }}
      >
        <EnvelopeIcon />
        {t("send")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("sendTitle")}
        icon={EnvelopeIcon}
        closeLabel={tCommon("close")}
      >
        <form noValidate onSubmit={submit} className="space-y-4">
          {!enabled && <Alert variant="warning">{t("emailDisabled")}</Alert>}
          <Field
            id="protocol-email"
            label={t("recipient")}
            hint={t("recipientHint")}
            error={fieldError ? tErr(fieldError) : undefined}
          >
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              disabled={!enabled}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldError(undefined);
              }}
            />
          </Field>
          {error && <Alert variant="error">{tErr(error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={!enabled || pending}>
              {pending && <Spinner size={16} />}
              {t("sendConfirm")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
