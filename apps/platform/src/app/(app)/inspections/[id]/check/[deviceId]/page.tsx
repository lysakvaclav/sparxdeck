import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth";
import { deviceName, formatLabel } from "@/lib/devices";
import { CALENDAR_FORMAT, calendarDate } from "@/lib/due";
import { getInspection, loadQuestions, memberNames } from "@/lib/inspection-data";
import { EMPTY_ANSWER, type AnswerDraft } from "@/lib/inspections";
import { ORG_ASSETS_BUCKET, SIGNED_URL_SECONDS } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";
import { DeviceCheck, type CheckPhoto, type OpenDefect } from "./device-check";

type Props = { params: Promise<{ id: string; deviceId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { deviceId } = await params;
  if (!idSchema.safeParse(deviceId).success) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("devices")
    .select("label_number, type:device_types(name)")
    .eq("id", deviceId)
    .maybeSingle();
  return { title: data ? deviceName(data.type?.name ?? "", data.label_number) : undefined };
}

/** One device's check within an inspection: the form while in progress, the record after. */
export default async function DeviceCheckPage({ params }: Props) {
  const { id, deviceId } = await params;
  const { organization } = await requireMembership();
  const inspection = await getInspection(id);
  if (!inspection || !idSchema.safeParse(deviceId).success) notFound();
  const t = await getTranslations("inspections");
  const format = await getFormatter();
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: device }, { data: item }, { data: defectRows }] = await Promise.all([
    supabase
      .from("devices")
      .select(
        "id, label_number, serial_number, device_type_id, last_inspection_on, location:locations(name), type:device_types(name)",
      )
      .eq("id", deviceId)
      .eq("site_id", inspection.site_id)
      .maybeSingle(),
    supabase
      .from("inspection_items")
      .select("id, template_id, outcome, notes, checked_by, checked_at")
      .eq("inspection_id", id)
      .eq("device_id", deviceId)
      .maybeSingle(),
    supabase
      .from("defects")
      .select("id, number, description, severity, question:checklist_template_items(label)")
      .eq("device_id", deviceId)
      .neq("status", "resolved")
      .order("created_at"),
  ]);
  if (!device) notFound();
  const openDefects: OpenDefect[] = (defectRows ?? []).map((defect) => ({
    id: defect.id,
    number: defect.number,
    description: defect.description,
    severity: defect.severity,
    question: defect.question?.label ?? null,
  }));

  // The version this check uses, or the type's current checklist for a new check.
  let templateId = item?.template_id ?? null;
  if (!templateId && inspection.status === "in_progress") {
    const { data: template } = await supabase
      .from("checklist_templates")
      .select("id")
      .eq("device_type_id", device.device_type_id)
      .eq("active", true)
      .maybeSingle();
    templateId = template?.id ?? null;
  }
  const questions = templateId ? await loadQuestions(templateId) : [];

  const [{ data: answerRows }, { data: photoRows }] = item
    ? await Promise.all([
        supabase
          .from("inspection_answers")
          .select("template_item_id, value_pass, value_number, value_text, note, defect_severity")
          .eq("item_id", item.id),
        supabase
          .from("inspection_photos")
          .select("id, template_item_id, storage_path")
          .eq("item_id", item.id)
          .order("created_at"),
      ])
    : [{ data: [] }, { data: [] }];

  const answers: Record<string, AnswerDraft> = {};
  for (const row of answerRows ?? []) {
    answers[row.template_item_id] = {
      pass: row.value_pass,
      number:
        row.value_number === null
          ? ""
          : locale === "cs"
            ? String(row.value_number).replace(".", ",")
            : String(row.value_number),
      text: row.value_text ?? "",
      note: row.note ?? "",
      severity: row.defect_severity,
    };
  }
  const paths = (photoRows ?? []).map((photo) => photo.storage_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from(ORG_ASSETS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
    : { data: [] };
  const photos: CheckPhoto[] = (photoRows ?? []).map((photo, index) => ({
    key: photo.id,
    photoId: photo.id,
    path: photo.storage_path,
    questionId: photo.template_item_id,
    url: signed?.[index]?.signedUrl ?? "",
    status: "uploaded",
  }));

  const label = formatLabel(device.label_number);
  const title = deviceName(device.type?.name ?? "", device.label_number);
  const overviewHref = `/inspections/${id}`;
  const facts = [
    device.location?.name && `${t("check.location")}: ${device.location.name}`,
    device.serial_number && `${t("check.serial")}: ${device.serial_number}`,
    device.last_inspection_on &&
      `${t("check.lastInspection")}: ${format.dateTime(calendarDate(device.last_inspection_on), CALENDAR_FORMAT)}`,
  ].filter(Boolean);

  const header = (
    <PageHeader
      icon={OBJECT_TYPES.device.icon}
      iconClassName={OBJECT_TYPES.device.text}
      title={title}
      meta={
        item?.outcome && (
          <Badge
            variant={
              item.outcome === "passed"
                ? "success"
                : item.outcome === "failed"
                  ? "danger"
                  : "default"
            }
          >
            {t(`outcome.${item.outcome}`)}
          </Badge>
        )
      }
      breadcrumbs={[
        { label: t("title"), href: "/inspections" },
        { label: inspection.site?.name ?? t("title"), href: overviewHref },
      ]}
    />
  );
  const factsLine = facts.length > 0 && (
    <p className="mb-2.5 text-ui text-muted-foreground sm:mb-[15px]">{facts.join(" · ")}</p>
  );

  if (inspection.status === "in_progress") {
    return (
      <>
        {header}
        <PageBody width="narrow">
          {factsLine}
          <DeviceCheck
            key={item?.id ?? "new"}
            inspectionId={id}
            deviceId={deviceId}
            organizationId={organization.id}
            label={label}
            questions={questions}
            initialAnswers={answers}
            initialNotes={item?.notes ?? ""}
            initialPhotos={photos}
            openDefects={openDefects}
            overviewHref={overviewHref}
          />
        </PageBody>
      </>
    );
  }

  // Completed inspection: what was answered, read-only.
  const names = await memberNames(inspection.organization_id);
  const value = (questionId: string) => {
    const answer = answers[questionId] ?? EMPTY_ANSWER;
    const question = questions.find((q) => q.id === questionId)!;
    if (question.type === "pass_fail")
      return answer.pass === null ? null : answer.pass ? t("check.pass") : t("check.fail");
    return question.type === "number" ? answer.number || null : answer.text || null;
  };
  return (
    <>
      {header}
      <PageBody width="narrow">
        {factsLine}
        <Alert className="mb-2.5 sm:mb-[15px]">
          {t("check.readOnly")}
          {item?.checked_at && (
            <>
              {" "}
              {t("check.checkedBy", {
                name: (item.checked_by && names.get(item.checked_by)) || "—",
                time: format.dateTime(new Date(item.checked_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </>
          )}
        </Alert>
        <Card>
          <ol>
            {questions.map((question, index) => {
              const shown = value(question.id);
              const answer = answers[question.id];
              const questionPhotos = photos.filter((photo) => photo.questionId === question.id);
              return (
                <li
                  key={question.id}
                  className="space-y-1.5 px-[15px] py-2.5 shadow-[inset_0_-1px_0_var(--border)] last:shadow-none"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
                    <span className="min-w-0 flex-1">{question.label}</span>
                    {question.type === "pass_fail" && answer?.pass !== null && answer ? (
                      <Badge variant={answer.pass ? "success" : "danger"}>{shown}</Badge>
                    ) : (
                      <span className={shown ? "font-medium" : "text-subtle"}>
                        {shown ?? t("check.notAnswered")}
                      </span>
                    )}
                  </div>
                  {answer?.note && (
                    <p className="ps-5 text-ui-sm whitespace-pre-line text-muted-foreground">
                      {answer.note}
                    </p>
                  )}
                  {questionPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 ps-5">
                      {questionPhotos.map((photo, photoIndex) => (
                        <a key={photo.key} href={photo.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                          <img
                            src={photo.url}
                            alt={t("check.photoAlt", { number: photoIndex + 1 })}
                            className="size-20 rounded-md object-cover shadow-[0_0_0_1px_var(--border)]"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {(item?.notes || photos.some((photo) => photo.questionId === null)) && (
            <div className="space-y-1.5 px-[15px] py-2.5 shadow-[inset_0_1px_0_var(--border)]">
              <p className="font-medium">{t("check.deviceSection")}</p>
              {item?.notes && <p className="whitespace-pre-line">{item.notes}</p>}
              <div className="flex flex-wrap gap-2">
                {photos
                  .filter((photo) => photo.questionId === null)
                  .map((photo, photoIndex) => (
                    <a key={photo.key} href={photo.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                      <img
                        src={photo.url}
                        alt={t("check.photoAlt", { number: photoIndex + 1 })}
                        className="size-20 rounded-md object-cover shadow-[0_0_0_1px_var(--border)]"
                      />
                    </a>
                  ))}
              </div>
            </div>
          )}
        </Card>
      </PageBody>
    </>
  );
}
