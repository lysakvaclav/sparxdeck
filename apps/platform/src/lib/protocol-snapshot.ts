import type { ProtocolInput } from "@/lib/protocol";
import type { ProtocolTemplate } from "@/lib/protocol-template/schema";

// What an issued protocol was made from (part 22): its data and its images,
// stored with it (protocols.snapshot) when its PDF is made. With the template
// version it records, it is drawn again exactly as it was issued, whatever
// changed since in the records, the company's settings or its templates.

export const SNAPSHOT_SCHEMA = 1;

export type ProtocolSnapshot = {
  schema: typeof SNAPSHOT_SCHEMA;
  input: ProtocolInput;
  images: {
    /** The company's logo in org-assets (a replaced logo is kept). */
    logo: string | null;
    /** The customer's signature itself: a new one after a correction replaces the file. */
    signature: { format: "png" | "jpg"; base64: string } | null;
    /** Defect photos in org-assets by the defect's number, oldest first. */
    defectPhotos: [number, string[]][];
    /** Photos of the checks in org-assets, with the device's label. */
    inspectionPhotos: { path: string; caption: string }[];
  };
};

/** The images a template draws, so a protocol loads only those. */
export function imageNeeds(template: ProtocolTemplate) {
  let perDefect = 0;
  let checkPhotos = 0;
  for (const block of template.blocks) {
    if (block.hidden) continue;
    if (block.type === "defects") perDefect = Math.max(perDefect, block.photos.perDefect);
    if (block.type === "gallery") {
      if (block.source !== "inspection") perDefect = Math.max(perDefect, Math.min(block.max, 6));
      if (block.source !== "defects") checkPhotos = Math.max(checkPhotos, block.max);
    }
  }
  return { perDefect, checkPhotos };
}

/** A stored snapshot as far as it can be used; null when it isn't one. */
export function readSnapshot(value: unknown): ProtocolSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Partial<ProtocolSnapshot>;
  if (snapshot.schema !== SNAPSHOT_SCHEMA || !snapshot.input || !snapshot.images) return null;
  return snapshot as ProtocolSnapshot;
}
