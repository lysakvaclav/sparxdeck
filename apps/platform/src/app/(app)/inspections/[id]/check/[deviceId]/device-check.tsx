"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AnnotationIcon,
  CameraIcon,
  ChevronLeftIcon,
  CrossIcon,
  IssueIcon,
  OfflineIcon,
  SmallCrossIcon,
  TickCircleIcon,
  TickIcon,
} from "@/components/icons";
import { DefectRef, SeverityBadge } from "@/components/app/defect-badges";
import { SeverityPicker } from "@/components/app/severity-picker";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  draftKey,
  draftSnapshot,
  readDraft,
  subscribeDrafts,
  updateDraft,
  type CheckDraft,
} from "@/lib/client/check-drafts";
import { compressImage } from "@/lib/client/image";
import { queuePhoto, queuedPhotos, removePhoto } from "@/lib/client/photo-queue";
import { databaseErrorCode, type ErrorCode } from "@/lib/errors";
import {
  EMPTY_ANSWER,
  answerPayload,
  defectSeverityOf,
  missingRequired,
  outcomeOf,
  parseNumber,
  type AnswerDraft,
  type Question,
} from "@/lib/inspections";
import type { DefectSeverity } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type CheckPhoto = {
  /** Local key: the photo's database id, or the queue id while it waits. */
  key: string;
  questionId: string | null;
  url: string;
  status: "uploaded" | "waiting" | "uploading";
  photoId?: string;
  path?: string;
};

/** An unresolved defect of the device; a "no" to its question is added to it. */
export type OpenDefect = {
  id: string;
  number: number;
  description: string;
  severity: DefectSeverity;
  question: string | null;
};

type Hold =
  | { state: "opening" }
  | { state: "held"; item: string }
  | { state: "blocked"; item: string; name: string }
  | { state: "lost"; item: string }
  | { state: "error"; error: ErrorCode };

const NOTES = "__device";

/** A failed request that never reached the server (no signal, airplane mode). */
function isNetworkError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return !error.code && /fetch|network|load failed|timed? ?out|abort/i.test(error.message ?? "");
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

const sameAnswer = (a: AnswerDraft | undefined, b: AnswerDraft) =>
  !!a &&
  a.pass === b.pass &&
  a.number === b.number &&
  a.text === b.text &&
  a.note === b.note &&
  (a.severity ?? null) === (b.severity ?? null);

/**
 * One device's check on the phone. Every change is written to the phone first
 * (a draft in localStorage, photos in IndexedDB) and then sent; without a signal
 * nothing is lost and it is sent when the connection returns. The check is held
 * by one person: a colleague can take it over, and the first person is told.
 */
export function DeviceCheck({
  inspectionId,
  deviceId,
  organizationId,
  label,
  questions,
  initialAnswers,
  initialNotes,
  initialPhotos,
  openDefects,
  overviewHref,
}: {
  inspectionId: string;
  deviceId: string;
  organizationId: string;
  label: string;
  questions: Question[];
  initialAnswers: Record<string, AnswerDraft>;
  initialNotes: string;
  initialPhotos: CheckPhoto[];
  openDefects: OpenDefect[];
  overviewHref: string;
}) {
  const t = useTranslations("inspections.check");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const key = draftKey(inspectionId, deviceId);

  const [hold, setHold] = useState<Hold>({ state: "opening" });
  const [base, setBase] = useState(initialAnswers);
  const [baseNotes, setBaseNotes] = useState(initialNotes);
  const [photos, setPhotos] = useState<CheckPhoto[]>(initialPhotos);
  const [openNotes, setOpenNotes] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        Object.entries(initialAnswers)
          .filter(([, answer]) => answer.note)
          .map(([id]) => id),
      ),
  );
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  // Sending runs one pass at a time; a call during a pass waits for it and runs
  // another, so "Done" never sees answers that are merely still in flight.
  const answersQueue = useRef<Promise<void>>(Promise.resolve());
  const photosQueue = useRef<Promise<void>>(Promise.resolve());
  const objectUrls = useRef<string[]>([]);

  const draft = useSyncExternalStore(
    subscribeDrafts,
    () => draftSnapshot(key),
    () => null,
  );
  const answers = useMemo(() => ({ ...base, ...draft?.answers }), [base, draft]);
  const notes = draft?.notes ?? baseNotes;
  const waitingPhotos = photos.filter((photo) => photo.status !== "uploaded").length;
  const pending = Object.keys(draft?.answers ?? {}).length + (draft?.notes !== undefined ? 1 : 0);
  const item = hold.state === "held" ? hold.item : null;
  const editable = hold.state === "opening" || hold.state === "held";

  // ---------------------------------------------------------------------------
  // Holding the check
  // ---------------------------------------------------------------------------

  const open = useCallback(
    async (takeOver: boolean) => {
      const { data, error } = await supabase.rpc("open_device_check", {
        p_inspection: inspectionId,
        p_device: deviceId,
        p_take_over: takeOver,
      });
      if (error) {
        if (isNetworkError(error)) {
          setOffline(true);
          return;
        }
        setHold({ state: "error", error: databaseErrorCode(error) });
        return;
      }
      const result = data as { item: string; heldBy?: string };
      setOffline(false);
      setHold(
        result.heldBy
          ? { state: "blocked", item: result.item, name: result.heldBy }
          : { state: "held", item: result.item },
      );
    },
    [supabase, inspectionId, deviceId],
  );

  useEffect(() => {
    const first = setTimeout(() => void open(false), 0);
    // Back from the lock screen: make sure the check is still ours.
    const onVisible = () => {
      if (document.visibilityState === "visible") void open(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open]);

  const failed = useCallback(
    (error: { message?: string; code?: string }) => {
      if (isNetworkError(error)) {
        setOffline(true);
        return;
      }
      const code = databaseErrorCode(error);
      if (code === "checkTakenOver" && item) setHold({ state: "lost", item });
      else if (code === "inspectionClosed") setHold({ state: "error", error: code });
      else setNotice(tErr(code));
    },
    [item, tErr],
  );

  // ---------------------------------------------------------------------------
  // Sending answers (one at a time, oldest first; the draft keeps the rest)
  // ---------------------------------------------------------------------------

  const sendAnswers = useCallback(async () => {
    if (!item) return;
    try {
      for (;;) {
        const current: CheckDraft | null = readDraft(key);
        if (!current) break;
        const entry = Object.entries(current.answers).find(([id, answer]) => {
          const question = questions.find((q) => q.id === id);
          return !(question?.type === "number" && Number.isNaN(parseNumber(answer.number)));
        });
        if (entry) {
          const [id, answer] = entry;
          const question = questions.find((q) => q.id === id);
          if (!question) {
            updateDraft(key, (d) => ({ ...d, answers: without(d.answers, id) }));
            continue;
          }
          setSaving(true);
          const { error } = await supabase.rpc("save_answer", {
            p_item: item,
            p_template_item: id,
            ...answerPayload(question, answer),
          });
          if (error) {
            failed(error);
            break;
          }
          setOffline(false);
          setBase((previous) => ({ ...previous, [id]: answer }));
          updateDraft(key, (d) =>
            sameAnswer(d.answers[id], answer) ? { ...d, answers: without(d.answers, id) } : d,
          );
          continue;
        }
        if (current.notes !== undefined) {
          const sent = current.notes;
          setSaving(true);
          const { error } = await supabase.rpc("save_check_note", { p_item: item, p_notes: sent });
          if (error) {
            failed(error);
            break;
          }
          setOffline(false);
          setBaseNotes(sent);
          updateDraft(key, (d) => (d.notes === sent ? { ...d, notes: undefined } : d));
          continue;
        }
        break;
      }
    } finally {
      setSaving(false);
    }
  }, [item, key, questions, supabase, failed]);

  const flush = useCallback(() => {
    // Runs even if the previous pass failed, so the queue never stalls.
    answersQueue.current = answersQueue.current.then(sendAnswers, sendAnswers);
    return answersQueue.current;
  }, [sendAnswers]);

  // ---------------------------------------------------------------------------
  // Photos: compressed in the phone, queued in IndexedDB, then uploaded
  // ---------------------------------------------------------------------------

  const sendPhotos = useCallback(async () => {
    if (!item) return;
    try {
      for (const photo of await queuedPhotos(inspectionId, deviceId)) {
        setPhotos((list) =>
          list.map((p) => (p.key === photo.id ? { ...p, status: "uploading" } : p)),
        );
        const path = `${organizationId}/inspections/${inspectionId}/${item}/${photo.id}.jpg`;
        const upload = await supabase.storage
          .from("org-assets")
          .upload(path, photo.blob, { contentType: "image/jpeg", upsert: false });
        // Uploaded before but not registered (signal lost in between): carry on.
        if (upload.error && !/exist|duplicate/i.test(upload.error.message)) {
          setPhotos((list) =>
            list.map((p) => (p.key === photo.id ? { ...p, status: "waiting" } : p)),
          );
          failed(upload.error);
          break;
        }
        const { data: photoId, error } = await supabase.rpc("add_inspection_photo", {
          p_item: item,
          p_template_item: photo.questionId,
          p_path: path,
          p_content_type: "image/jpeg",
          p_size: photo.blob.size,
        });
        if (error && error.code !== "23505") {
          setPhotos((list) =>
            list.map((p) => (p.key === photo.id ? { ...p, status: "waiting" } : p)),
          );
          failed(error);
          break;
        }
        await removePhoto(photo.id);
        setOffline(false);
        setPhotos((list) =>
          list.map((p) =>
            p.key === photo.id
              ? { ...p, status: "uploaded", photoId: photoId ?? undefined, path }
              : p,
          ),
        );
      }
    } catch {
      // IndexedDB or the network failed mid-way: the photos stay queued for the next pass.
    }
  }, [item, inspectionId, deviceId, organizationId, supabase, failed]);

  const uploadPending = useCallback(() => {
    photosQueue.current = photosQueue.current.then(sendPhotos, sendPhotos);
    return photosQueue.current;
  }, [sendPhotos]);

  // Photos left in the phone by an earlier visit.
  useEffect(() => {
    let cancelled = false;
    void queuedPhotos(inspectionId, deviceId).then((queued) => {
      if (cancelled || queued.length === 0) return;
      const restored = queued.map((photo) => {
        const url = URL.createObjectURL(photo.blob);
        objectUrls.current.push(url);
        return { key: photo.id, questionId: photo.questionId, url, status: "waiting" as const };
      });
      setPhotos((list) => [
        ...list.filter((p) => !queued.some((q) => q.id === p.key)),
        ...restored,
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, [inspectionId, deviceId]);

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  // Send whatever waits: shortly after a change, when the signal returns, and every few seconds.
  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(() => {
      void flush();
      void uploadPending();
    }, 350);
    return () => clearTimeout(timer);
  }, [item, draft, photos.length, flush, uploadPending]);

  useEffect(() => {
    if (!item) return;
    const retry = () => {
      void flush();
      void uploadPending();
    };
    window.addEventListener("online", retry);
    const interval = setInterval(() => {
      if (readDraft(key) || offline) retry();
    }, 10_000);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(interval);
    };
  }, [item, key, offline, flush, uploadPending]);

  // ---------------------------------------------------------------------------
  // Editing
  // ---------------------------------------------------------------------------

  function edit(question: Question, patch: Partial<AnswerDraft>) {
    const next = { ...EMPTY_ANSWER, ...answers[question.id], ...patch };
    updateDraft(key, (d) => ({ ...d, answers: { ...d.answers, [question.id]: next } }));
    if (missing.has(question.id)) {
      setMissing((current) => {
        const copy = new Set(current);
        copy.delete(question.id);
        return copy;
      });
    }
  }

  async function addPhoto(questionId: string | null, file: File | undefined) {
    if (!file) return;
    let blob: Blob;
    try {
      blob = await compressImage(file);
    } catch {
      toast(tErr("photoFailed"), "danger");
      return;
    }
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(blob);
    objectUrls.current.push(url);
    setPhotos((list) => [...list, { key: id, questionId, url, status: "waiting" }]);
    const stored = await queuePhoto({
      id,
      inspectionId,
      deviceId,
      questionId,
      blob,
    });
    if (!stored) toast(tErr("photoFailed"), "danger");
  }

  async function deletePhoto(photo: CheckPhoto) {
    if (photo.status !== "uploaded") {
      await removePhoto(photo.key);
      setPhotos((list) => list.filter((p) => p.key !== photo.key));
      return;
    }
    if (!photo.photoId) return;
    const { data: path, error } = await supabase.rpc("delete_inspection_photo", {
      p_photo: photo.photoId,
    });
    if (error) {
      failed(error);
      return;
    }
    await supabase.storage.from("org-assets").remove([path ?? photo.path ?? ""]);
    setPhotos((list) => list.filter((p) => p.key !== photo.key));
  }

  async function finish() {
    setNotice(null);
    const gaps = missingRequired(questions, answers);
    if (gaps.length > 0) {
      setMissing(new Set(gaps.map((q) => q.id)));
      setNotice(t("missingCount", { count: gaps.length }));
      document.getElementById(`question-${gaps[0]!.id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    if (!item) return;
    setFinishing(true);
    await flush();
    await uploadPending();
    if (readDraft(key) || (await queuedPhotos(inspectionId, deviceId)).length > 0) {
      setNotice(t("pendingBeforeFinish"));
      setFinishing(false);
      return;
    }
    const { data, error } = await supabase.rpc("finish_device_check", { p_item: item });
    if (error) {
      failed(error);
      setFinishing(false);
      return;
    }
    toast(
      data === "failed" ? t("finishedFailed", { label }) : t("finishedPassed", { label }),
      data === "failed" ? "danger" : "success",
    );
    router.push(overviewHref);
    router.refresh();
  }

  function leave() {
    // Free the check for colleagues, unless something still waits to be sent.
    if (item && !readDraft(key) && waitingPhotos === 0)
      void supabase.rpc("release_device_check", { p_item: item });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const outcome = outcomeOf(questions, answers);
  const photoInput = (questionId: string | null, labelText: string) => (
    <label
      className={cn(
        "inline-flex min-h-[30px] cursor-pointer items-center gap-[7px] rounded-md px-2.5 text-ui text-muted-foreground hover:bg-accent pointer-coarse:min-h-11",
        !editable && "pointer-events-none opacity-50",
      )}
    >
      <CameraIcon className="text-[var(--btn-icon)]" />
      <span>{questionId ? t("addPhoto") : labelText}</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={labelText}
        disabled={!editable}
        data-testid={`photo-${questionId ?? NOTES}`}
        onChange={(event) => {
          void addPhoto(questionId, event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </label>
  );
  const photoStrip = (questionId: string | null) => {
    const list = photos.filter((photo) => photo.questionId === questionId);
    if (list.length === 0) return null;
    return (
      <ul className="flex flex-wrap gap-2">
        {list.map((photo, index) => (
          <li key={photo.key} className="relative">
            <a href={photo.url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- local and signed URLs */}
              <img
                src={photo.url}
                alt={t("photoAlt", { number: index + 1 })}
                className="size-20 rounded-md object-cover shadow-[0_0_0_1px_var(--border)]"
              />
            </a>
            {photo.status !== "uploaded" && (
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-md bg-[rgb(16_22_26/0.7)] py-0.5 text-[10px] text-white">
                {photo.status === "uploading" ? t("uploading") : t("photoWaiting")}
              </span>
            )}
            {editable && (
              <button
                type="button"
                aria-label={t("removePhoto", { number: index + 1 })}
                onClick={() => void deletePhoto(photo)}
                className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full bg-background text-foreground shadow-elevation-2 pointer-coarse:size-8"
              >
                <SmallCrossIcon />
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-2.5 pb-2 sm:space-y-[15px]">
      {hold.state === "blocked" && (
        <Alert variant="warning" title={t("heldTitle", { name: hold.name })}>
          <p>{t("heldBody")}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void open(true)}>
              {t("takeOver")}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={overviewHref}>{t("back")}</Link>
            </Button>
          </div>
        </Alert>
      )}
      {hold.state === "lost" && (
        <Alert variant="error" title={t("lostTitle")}>
          <p>{t("lostBody")}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void open(true)}>
              {t("takeBack")}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={overviewHref}>{t("back")}</Link>
            </Button>
          </div>
        </Alert>
      )}
      {hold.state === "error" && (
        <Alert variant="error">
          <p>{tErr(hold.error)}</p>
          <Button asChild size="sm" variant="outline" className="mt-2.5">
            <Link href={overviewHref}>{t("back")}</Link>
          </Button>
        </Alert>
      )}
      {offline && (
        <Alert variant="warning" icon={OfflineIcon}>
          {t("offlineHint")}
        </Alert>
      )}
      {openDefects.length > 0 && (
        <Alert variant="warning" icon={IssueIcon} title={t("openDefects")}>
          <ul className="space-y-1">
            {openDefects.map((defect) => (
              <li key={defect.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Link
                  href={`/defects/${defect.id}`}
                  className="touch-link font-medium hover:underline"
                >
                  <DefectRef number={defect.number} />
                </Link>
                <SeverityBadge severity={defect.severity} />
                <span className="min-w-0 break-words">{defect.description}</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <fieldset disabled={!editable} className="space-y-2.5 sm:space-y-[15px]">
        {questions.map((question, index) => {
          const answer = answers[question.id] ?? EMPTY_ANSWER;
          const isMissing = missing.has(question.id);
          const numberInvalid =
            question.type === "number" && Number.isNaN(parseNumber(answer.number));
          const noteOpen = openNotes.has(question.id);
          const failed = question.type === "pass_fail" && answer.pass === false;
          // The database adds a repeated "no" to the open defect of the same question.
          const existing = failed
            ? openDefects.find((defect) => defect.question === question.label)
            : undefined;
          const severity = defectSeverityOf(question, answer);
          return (
            <Card
              key={question.id}
              id={`question-${question.id}`}
              className={cn("space-y-2.5 p-[15px]", isMissing && "ring-2 ring-destructive")}
            >
              <p className="flex gap-2 text-ui-lg leading-6">
                <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
                <span className="min-w-0 flex-1 font-medium">
                  {question.label}
                  {question.required && (
                    <span className="ms-1.5 text-ui-sm font-normal text-muted-foreground">
                      ({t("required")})
                    </span>
                  )}
                </span>
              </p>

              {question.type === "pass_fail" && (
                <div className="grid grid-cols-2 gap-2" role="group" aria-label={question.label}>
                  {([true, false] as const).map((value) => {
                    const chosen = answer.pass === value;
                    return (
                      <button
                        key={String(value)}
                        type="button"
                        aria-pressed={chosen}
                        // A second tap keeps the answer: a double tap in the field must not clear it.
                        onClick={() => !chosen && edit(question, { pass: value })}
                        className={cn(
                          "flex h-12 items-center justify-center gap-2 rounded-md text-ui-lg font-medium transition-colors disabled:opacity-50",
                          chosen
                            ? value
                              ? "bg-success text-white"
                              : "bg-destructive text-white"
                            : "surface-button hover:bg-[var(--btn-bg-hover)]",
                        )}
                      >
                        {value ? <TickIcon size={20} /> : <CrossIcon size={20} />}
                        {value ? t("pass") : t("fail")}
                      </button>
                    );
                  })}
                </div>
              )}
              {failed &&
                (existing ? (
                  <p className="flex items-center gap-1.5 text-ui-sm text-muted-foreground">
                    <IssueIcon className="shrink-0" />
                    <span>
                      {t.rich("defectExisting", {
                        number: () => <DefectRef number={existing.number} />,
                      })}
                    </span>
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-ui-sm font-medium text-muted-foreground">{t("defect")}</p>
                    <SeverityPicker
                      value={severity}
                      label={t("defectFor", { label: question.label })}
                      noneLabel={question.failCreatesDefect ? undefined : t("noDefect")}
                      onChange={(value) => edit(question, { severity: value })}
                    />
                    {severity && (
                      <p className="text-ui-sm text-muted-foreground">{t("defectHint")}</p>
                    )}
                  </div>
                ))}
              {question.type === "number" && (
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={question.label}
                  aria-invalid={numberInvalid || isMissing || undefined}
                  placeholder={t("numberPlaceholder")}
                  value={answer.number}
                  onChange={(event) => edit(question, { number: event.target.value })}
                  className="h-11 max-w-[220px] text-ui-lg"
                />
              )}
              {question.type === "text" && (
                <Textarea
                  rows={2}
                  aria-label={question.label}
                  aria-invalid={isMissing || undefined}
                  placeholder={t("textPlaceholder")}
                  value={answer.text}
                  onChange={(event) => edit(question, { text: event.target.value })}
                />
              )}
              {numberInvalid && (
                <p className="text-ui-sm text-destructive-text">{t("numberInvalid")}</p>
              )}
              {isMissing && !numberInvalid && (
                <p className="text-ui-sm text-destructive-text">{t("missing")}</p>
              )}

              {noteOpen && (
                <Textarea
                  rows={2}
                  aria-label={t("note", { label: question.label })}
                  value={answer.note}
                  onChange={(event) => edit(question, { note: event.target.value })}
                />
              )}
              {photoStrip(question.id)}
              <div className="-ms-2.5 flex flex-wrap gap-1">
                {!noteOpen && (
                  <button
                    type="button"
                    onClick={() => setOpenNotes((current) => new Set(current).add(question.id))}
                    className="inline-flex min-h-[30px] items-center gap-[7px] rounded-md px-2.5 text-ui text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11"
                  >
                    <AnnotationIcon className="text-[var(--btn-icon)]" />
                    {t("addNote")}
                  </button>
                )}
                {photoInput(question.id, t("photoFor", { label: question.label }))}
              </div>
            </Card>
          );
        })}

        <Card className="space-y-2.5 p-[15px]">
          <p className="text-ui-lg font-medium">{t("deviceSection")}</p>
          <Textarea
            rows={2}
            aria-label={t("deviceNotes")}
            placeholder={t("deviceNotes")}
            value={notes}
            onChange={(event) => updateDraft(key, (d) => ({ ...d, notes: event.target.value }))}
          />
          {photoStrip(null)}
          <div className="-ms-2.5">{photoInput(null, t("devicePhoto"))}</div>
        </Card>
      </fieldset>

      {notice && <Alert variant="error">{notice}</Alert>}

      <div className="sticky bottom-0 z-10 -mx-2.5 -mb-8 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 bg-background px-2.5 py-2 shadow-[0_-1px_0_var(--border)] sm:-mx-[15px] sm:px-[15px] lg:-mx-5 lg:px-5">
        <Button asChild variant="outline" size="lg" onClick={leave}>
          <Link href={overviewHref}>
            <ChevronLeftIcon className="rtl:rotate-180" />
            {/* Icon only on the phone; screen readers always hear the label. */}
            <span className="sr-only sm:not-sr-only">{t("back")}</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1 text-ui-sm" aria-live="polite">
          {hold.state === "opening" ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Spinner size={14} /> {t("opening")}
            </span>
          ) : offline || pending + waitingPhotos > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-warning-text">
              {offline ? <OfflineIcon /> : <Spinner size={14} />}
              {offline ? t("offline", { count: pending + waitingPhotos }) : t("saving")}
            </span>
          ) : saving ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Spinner size={14} /> {t("saving")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-success-text">
              <TickCircleIcon /> {t("saved")}
            </span>
          )}
          <Badge
            variant={outcome === "failed" ? "danger" : "success"}
            className="ms-2 hidden sm:inline-flex"
          >
            {outcome === "failed" ? t("willFail") : t("willPass")}
          </Badge>
        </div>
        <Button size="lg" onClick={() => void finish()} disabled={!editable || finishing}>
          {finishing ? <Spinner size={16} /> : <TickIcon />}
          {t("finish")}
        </Button>
      </div>
    </div>
  );
}
