"use client";

/** Longest side of an uploaded photo: plenty for a defect, a fraction of the original size. */
const MAX_SIDE = 1600;
/** The storage bucket accepts up to 2 MB. */
const MAX_BYTES = 1_900_000;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    image.src = url;
  });
}

/**
 * Shrinks a camera photo to at most 1600 px and re-encodes it as JPEG before
 * upload (a phone photo of 4 MB becomes a few hundred kB). The browser applies
 * the photo's orientation when drawing it.
 */
export async function compressImage(file: Blob): Promise<Blob> {
  const image = await loadImage(file);
  for (const [side, quality] of [
    [MAX_SIDE, 0.82],
    [1280, 0.75],
    [1024, 0.7],
  ] as const) {
    const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("too_large");
}

/** Pixels of an image file (scaled down), for reading a QR code from a photo. */
export async function imagePixels(file: Blob, maxSide = 1280): Promise<ImageData> {
  const image = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
