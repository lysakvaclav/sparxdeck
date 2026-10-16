"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { ErrorIcon, RefreshIcon } from "@/components/icons";
import { PageBody } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * An unexpected error on an app page: the navigation stays, the page offers to
 * try again, and the error is reported (with a code the user can quote).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <PageBody width="narrow">
      <Card className="mt-6 flex flex-col items-center gap-3 px-6 py-8 text-center" role="alert">
        <ErrorIcon size={32} className="text-destructive-text" />
        <h1 className="text-ui-lg font-semibold">{t("title")}</h1>
        <p className="max-w-md text-muted-foreground">{t("body")}</p>
        {error.digest && (
          <p className="font-mono text-ui-sm text-muted-foreground">
            {t("code", { code: error.digest })}
          </p>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>
            <RefreshIcon />
            {t("retry")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/">{t("home")}</Link>
          </Button>
        </div>
      </Card>
    </PageBody>
  );
}
