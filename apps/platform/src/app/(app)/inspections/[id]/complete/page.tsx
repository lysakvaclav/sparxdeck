import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth";
import { IssueIcon } from "@/components/icons";
import { defectPreview, getInspection, loadInspectionRun } from "@/lib/inspection-data";
import { CompleteForm } from "./complete-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inspections.complete");
  return { title: t("title") };
}

/** The summary before completing: what passed, failed, wasn't checked, and what blocks it. */
export default async function CompleteInspectionPage({ params }: Props) {
  const { id } = await params;
  const { membership } = await requireMembership();
  const inspection = await getInspection(id);
  if (!inspection) notFound();
  if (inspection.status !== "in_progress") redirect(`/inspections/${id}`);
  const t = await getTranslations("inspections");
  const [{ devices, checks }, defects] = await Promise.all([
    loadInspectionRun(inspection, membership.user_id),
    defectPreview(id),
  ]);

  const byOutcome = (test: (deviceId: string) => boolean) =>
    devices.filter((device) => test(device.id));
  const passed = byOutcome((d) => checks[d]?.outcome === "passed");
  const failed = byOutcome((d) => checks[d]?.outcome === "failed");
  const open = byOutcome((d) => !!checks[d] && checks[d].outcome === null);
  const skipped = byOutcome((d) => !!checks[d]?.skipReason);
  const notChecked = byOutcome((d) => !checks[d]);
  const app = appIcon("inspections");
  const checkHref = (deviceId: string) => `/inspections/${id}/check/${deviceId}`;
  const list = (items: typeof devices) => (
    <ul className="flex flex-wrap gap-1.5 px-[15px] py-2.5">
      {items.map((device) => (
        <li key={device.id}>
          <Link
            href={checkHref(device.id)}
            className="inline-flex min-h-[30px] items-center rounded-md surface-button px-2 font-mono tabular-nums hover:bg-[var(--btn-bg-hover)] pointer-coarse:min-h-11"
          >
            {device.number}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("complete.title")}
        breadcrumbs={[
          { label: t("title"), href: "/inspections" },
          { label: inspection.site?.name ?? t("title"), href: `/inspections/${id}` },
        ]}
      />
      <PageBody width="narrow">
        <div className="space-y-2.5 sm:space-y-[15px]">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["passed", passed.length, "text-success-text"],
                ["failed", failed.length, "text-destructive-text"],
                ["not_checked", notChecked.length + skipped.length, ""],
              ] as const
            ).map(([outcome, count, tone]) => (
              <Card key={outcome} className="p-2.5 text-center">
                <p className={`text-[28px] leading-9 font-semibold tabular-nums ${tone}`}>
                  {count}
                </p>
                <p className="text-ui-sm text-muted-foreground">{t(`outcome.${outcome}`)}</p>
              </Card>
            ))}
          </div>

          {open.length > 0 && (
            <Alert variant="error" title={t("complete.unfinishedTitle")}>
              <p>{t("complete.unfinishedBody")}</p>
            </Alert>
          )}
          {open.length > 0 && <Card>{list(open)}</Card>}

          {failed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("complete.failedList")}</CardTitle>
              </CardHeader>
              {list(failed)}
            </Card>
          )}
          {defects.created + defects.observed > 0 && (
            <Alert variant="warning" icon={IssueIcon}>
              {defects.created > 0 && (
                <p>{t("complete.defectsHint", { count: defects.created })}</p>
              )}
              {defects.observed > 0 && (
                <p>{t("complete.observedHint", { count: defects.observed })}</p>
              )}
            </Alert>
          )}
          {skipped.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("complete.skippedList")}</CardTitle>
              </CardHeader>
              <p className="px-[15px] pt-2.5 text-ui-sm text-muted-foreground">
                {t("complete.skippedHint")}
              </p>
              <ul className="flex flex-wrap gap-1.5 px-[15px] py-2.5">
                {skipped.map((device) => (
                  <li key={device.id}>
                    <Link
                      href={checkHref(device.id)}
                      className="inline-flex min-h-[30px] items-center gap-1.5 rounded-md surface-button px-2 hover:bg-[var(--btn-bg-hover)] pointer-coarse:min-h-11"
                    >
                      <span className="font-mono tabular-nums">{device.number}</span>
                      <span className="text-ui-sm text-muted-foreground">
                        {t(`outcome.${checks[device.id]!.skipReason!}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {notChecked.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("complete.notCheckedList")}</CardTitle>
              </CardHeader>
              <p className="px-[15px] pt-2.5 text-ui-sm text-muted-foreground">
                {t("complete.notCheckedHint")}
              </p>
              {list(notChecked)}
            </Card>
          )}

          <Card>
            <CompleteForm inspectionId={id} blocked={open.length > 0} />
          </Card>
        </div>
      </PageBody>
    </>
  );
}
