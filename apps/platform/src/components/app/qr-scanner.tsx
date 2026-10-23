"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useTranslations } from "next-intl";
import { CameraIcon, CrossIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { imagePixels } from "@/lib/client/image";

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorConstructor = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
};

/** The browser's own QR reader (Android Chrome); others fall back to jsQR. */
async function nativeDetector(): Promise<Detector | null> {
  const Native = (globalThis as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
  if (!Native) return null;
  try {
    return (await Native.getSupportedFormats()).includes("qr_code")
      ? new Native({ formats: ["qr_code"] })
      : null;
  } catch {
    return null;
  }
}

async function decodePixels(pixels: ImageData): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  return (
    jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "dontInvert" })?.data ??
    null
  );
}

type CameraState = "starting" | "live" | "unavailable" | "denied";

/**
 * Full-screen QR reader: the back camera with a frame to aim at. Where there is
 * no camera (or it isn't allowed, or the page isn't on HTTPS) a photo of the
 * label or the typed label number does the same job.
 */
export function QrScanner({
  open,
  onOpenChange,
  onResult,
  message,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The decoded text (or the typed number); the caller decides what it points to. */
  onResult: (text: string) => void;
  /** Feedback on the last result, e.g. "this label belongs to another building". */
  message?: string | null;
}) {
  const t = useTranslations("inspections.scanner");
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [typed, setTyped] = useState("");
  const [photoError, setPhotoError] = useState(false);
  const handled = useRef(false);
  // The latest callback, without restarting the camera when the caller re-renders.
  const resultRef = useRef(onResult);
  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!open) return;
    handled.current = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const canvas = document.createElement("canvas");

    const report = (text: string) => {
      if (handled.current || stopped) return;
      handled.current = true;
      navigator.vibrate?.(40);
      resultRef.current(text);
      // Allow the next scan (the caller may keep the scanner open).
      setTimeout(() => {
        handled.current = false;
      }, 1500);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
      } catch (error) {
        setCamera(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "denied"
            : "unavailable",
        );
        return;
      }
      if (stopped || !video.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      setCamera("live");
      const detector = await nativeDetector();

      const tick = async () => {
        if (stopped || !video.current) return;
        const element = video.current;
        if (element.readyState >= 2 && element.videoWidth > 0 && !handled.current) {
          try {
            let text: string | null = null;
            if (detector) {
              text = (await detector.detect(element))[0]?.rawValue ?? null;
            } else {
              // The middle of the picture, scaled down: enough for a label, quick to read.
              const side = Math.min(element.videoWidth, element.videoHeight);
              const size = Math.min(side, 640);
              canvas.width = size;
              canvas.height = size;
              const context = canvas.getContext("2d", { willReadFrequently: true })!;
              context.drawImage(
                element,
                (element.videoWidth - side) / 2,
                (element.videoHeight - side) / 2,
                side,
                side,
                0,
                0,
                size,
                size,
              );
              text = await decodePixels(context.getImageData(0, 0, size, size));
            }
            if (text) report(text);
          } catch {
            // A frame that can't be read: try the next one.
          }
        }
        timer = setTimeout(tick, detector ? 120 : 200);
      };
      tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      setCamera("starting");
    };
  }, [open]);

  async function fromPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(false);
    try {
      const detector = await nativeDetector();
      let text: string | null = null;
      if (detector) {
        const bitmap = await createImageBitmap(file);
        text = (await detector.detect(bitmap))[0]?.rawValue ?? null;
      }
      text ??= await decodePixels(await imagePixels(file));
      if (text) onResult(text);
      else setPhotoError(true);
    } catch {
      setPhotoError(true);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-[#10161a] text-white outline-none"
        >
          <div className="flex min-h-12 shrink-0 items-center gap-2.5 px-[15px] pt-[env(safe-area-inset-top)]">
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-ui-lg font-semibold">
              {t("title")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("close")}
                className="text-white hover:bg-white/10 [&_svg]:text-white"
              >
                <CrossIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <video
              ref={video}
              playsInline
              muted
              className={camera === "live" ? "absolute inset-0 size-full object-cover" : "hidden"}
            />
            {camera === "live" ? (
              <div aria-hidden className="absolute inset-0 flex items-center justify-center">
                <div className="aspect-square w-[min(70vw,320px)] rounded-xl shadow-[0_0_0_9999px_rgb(16_22_26/0.55)] ring-2 ring-white/90" />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <CameraIcon size={40} className="text-white/60" />
                <p className="max-w-sm text-ui text-white/80">
                  {camera === "starting"
                    ? t("starting")
                    : camera === "denied"
                      ? t("denied")
                      : t("unavailable")}
                </p>
              </div>
            )}
            <p
              aria-live="polite"
              className="absolute inset-x-4 bottom-4 rounded-md bg-[rgb(16_22_26/0.75)] px-3 py-2 text-center text-ui"
            >
              {message ?? (camera === "live" ? t("aim") : t("useAlternatives"))}
            </p>
          </div>

          <div className="shrink-0 space-y-2.5 px-[15px] pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-white/10 px-3 text-ui font-medium hover:bg-white/15">
              <CameraIcon className="text-white" />
              {t("photo")}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                data-testid="scanner-photo"
                onChange={(event) => {
                  void fromPhoto(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {photoError && (
              <p className="text-center text-ui-sm text-[#ff7373]">{t("photoFailed")}</p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (typed.trim()) onResult(typed.trim());
              }}
            >
              <label htmlFor="scanner-number" className="sr-only">
                {t("number")}
              </label>
              <Input
                id="scanner-number"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("number")}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="outline">
                {t("open")}
              </Button>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
