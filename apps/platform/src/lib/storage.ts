import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Private bucket for organization files; objects live under "<organization_id>/". */
export const ORG_ASSETS_BUCKET = "org-assets";

/** Private bucket for protocol PDFs ("<organization_id>/<year>/<protocol id>.pdf"); only the server writes. */
export const PROTOCOLS_BUCKET = "protocols";

/** Signed URLs are short-lived: long enough to load a page, not to share around. */
export const SIGNED_URL_SECONDS = 10 * 60;

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

type ImageKind = { mime: "image/png" | "image/jpeg" | "image/webp"; ext: "png" | "jpg" | "webp" };

/**
 * Detects the image type from the file's first bytes rather than trusting its name
 * or the browser-reported type. Returns null for anything that isn't PNG, JPEG or WebP.
 */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const starts = (...sig: number[]) => sig.every((byte, index) => bytes[index] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { mime: "image/png", ext: "png" };
  if (starts(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/** A short-lived signed URL for a private object, or null if it can't be created. */
export async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(ORG_ASSETS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

/** Short-lived signed URLs for several private objects at once, by path. */
export async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(ORG_ASSETS_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_SECONDS);
  return new Map(
    (data ?? []).flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl]] : [],
    ),
  );
}
