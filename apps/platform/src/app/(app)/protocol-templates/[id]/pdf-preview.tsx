"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DownloadIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ProtocolTemplate } from "@/lib/protocol-template/schema";

// The live preview of the template editor (part 22): the server draws the
// template with the code that draws issued protocols, pdf.js turns the pages
// into pictures here. The last preview stays until the next one is ready.

/** Pages shown at most; a long real inspection still shows how it starts. */
const MAX_PAGES = 12;
const WAIT_MS = 600;

type Pages = { images: string[]; total: number; url: string };

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let loader: Promise<{ pdfjs: PdfJs; worker: InstanceType<PdfJs["PDFWorker"]> }> | null = null;

/** pdf.js and one worker for every preview, loaded while the first one is drawn on the server. */
function loadPdfjs() {
  loader ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return { pdfjs, worker: new pdfjs.PDFWorker() };
  });
  return loader;
}

async function renderPages(pdf: ArrayBuffer, width: number): Promise<{ images: string[]; total: number }> {
  const { pdfjs, worker } = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, worker });
  const document = await task.promise;
  try {
    const images: string[] = [];
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    for (let number = 1; number <= Math.min(document.numPages, MAX_PAGES); number++) {
      const page = await document.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width * ratio) / base.width });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      images.push(canvas.toDataURL("image/png"));
      page.cleanup();
    }
    return { images, total: document.numPages };
  } finally {
    await task.destroy();
  }
}

export function PdfPreview({
  template,
  inspectionId,
  fileName,
}: {
  template: ProtocolTemplate;
  inspectionId: string | null;
  fileName: string;
}) {
  const t = useTranslations("protocolTemplates.preview");
  const box = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Pages | null>(null);
  // The request the last result (or failure) belongs to; any other is loading.
  const [result, setResult] = useState<{ template: ProtocolTemplate; inspectionId: string | null; failed: boolean } | null>(null);
  const state =
    result && result.template === template && result.inspectionId === inspectionId
      ? result.failed
        ? "failed"
        : "ready"
      : "loading";

  // The first preview right away, later ones once the typing stops.
  const first = useRef(true);
  useEffect(() => {
    void loadPdfjs();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const wait = first.current ? 0 : WAIT_MS;
    first.current = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/protocol-templates/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template, inspection: inspectionId }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        const width = Math.min(Math.max((box.current?.clientWidth ?? 640) - 32, 280), 900);
        const rendered = await renderPages(await blob.arrayBuffer(), width);
        if (controller.signal.aborted) return;
        setPages((previous) => {
          if (previous) URL.revokeObjectURL(previous.url);
          return { ...rendered, url: URL.createObjectURL(blob) };
        });
        setResult({ template, inspectionId, failed: false });
      } catch {
        if (!controller.signal.aborted) setResult({ template, inspectionId, failed: true });
      }
    }, wait);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [template, inspectionId]);

  // The download link's object URL goes with the editor.
  const latest = useRef<string | null>(null);
  useEffect(() => {
    latest.current = pages?.url ?? null;
  }, [pages]);
  useEffect(() => () => {
    if (latest.current) URL.revokeObjectURL(latest.current);
  }, []);

  return (
    <div ref={box} className="relative flex min-h-0 flex-1 flex-col bg-canvas">
      <div className="flex min-h-10 shrink-0 items-center gap-2.5 px-4 shadow-[inset_0_-1px_0_var(--border)]">
        <p className="min-w-0 flex-1 truncate text-ui text-muted-foreground" aria-live="polite">
          {state === "loading"
            ? t("loading")
            : state === "failed"
              ? t("failed")
              : pages && pages.total > pages.images.length
                ? t("pagesShown", { shown: pages.images.length, total: pages.total })
                : t("pages", { count: pages?.total ?? 0 })}
        </p>
        {state === "loading" && <Spinner className="size-4" />}
        {pages && (
          <Button asChild variant="outline" size="sm">
            <a href={pages.url} download={fileName}>
              <DownloadIcon />
              {t("download")}
            </a>
          </Button>
        )}
      </div>
      <div
        className="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-4"
        role="region"
        aria-label={t("label")}
        tabIndex={0}
      >
        {state === "failed" && !pages && (
          <p className="text-ui text-destructive-text">{t("failed")}</p>
        )}
        <div className={state === "loading" && pages ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {pages?.images.map((image, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- a picture of a PDF page drawn here
            <img
              key={index}
              src={image}
              alt={t("pageAlt", { page: index + 1, pages: pages.total })}
              className="mx-auto mb-4 w-full max-w-[900px] bg-white shadow-elevation-2"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
