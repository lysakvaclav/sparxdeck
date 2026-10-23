"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CameraIcon, SmallCrossIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { compressImage } from "@/lib/client/image";
import { createClient } from "@/lib/supabase/client";

/** Uploads photos to a device's folder and registers them. */
export async function uploadDevicePhotos(
  organizationId: string,
  deviceId: string,
  blobs: Blob[],
): Promise<boolean> {
  const supabase = createClient();
  for (const blob of blobs) {
    const path = `${organizationId}/devices/${deviceId}/${crypto.randomUUID()}.jpg`;
    const upload = await supabase.storage
      .from("org-assets")
      .upload(path, blob, { contentType: "image/jpeg" });
    if (upload.error) return false;
    const { error } = await supabase.rpc("add_device_photo", {
      p_device: deviceId,
      p_path: path,
      p_content_type: "image/jpeg",
      p_size: blob.size,
    });
    if (error) return false;
  }
  return true;
}

export function AddDevicePhoto({
  deviceId,
  organizationId,
}: {
  deviceId: string;
  organizationId: string;
}) {
  const t = useTranslations("devices.detail");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function add(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const ok = await uploadDevicePhotos(organizationId, deviceId, [blob]);
      if (!ok) toast(tErr("photoFailed"), "danger");
      router.refresh();
    } catch {
      toast(tErr("photoFailed"), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md surface-button px-3.5 text-ui font-medium whitespace-nowrap transition-colors hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] pointer-coarse:min-h-11 pointer-coarse:px-4">
      {busy ? <Spinner size={16} /> : <CameraIcon className="text-[var(--btn-icon)]" />}
      {t("addPhoto")}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={busy}
        data-testid="device-add-photo"
        onChange={(event) => {
          void add(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </label>
  );
}

export function DeletePhotoButton({ photoId, number }: { photoId: string; number: number }) {
  const t = useTranslations("devices.detail");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const supabase = createClient();
    const { data: path, error } = await supabase.rpc("delete_device_photo", {
      p_photo: photoId,
    });
    if (error) {
      toast(tErr("unexpected"), "danger");
      setBusy(false);
      return;
    }
    if (path) await supabase.storage.from("org-assets").remove([path]);
    router.refresh();
  }

  return (
    <button
      type="button"
      aria-label={t("removePhoto", { number })}
      disabled={busy}
      onClick={() => void remove()}
      className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full bg-background text-foreground shadow-elevation-2 disabled:opacity-50 pointer-coarse:size-8"
    >
      <SmallCrossIcon />
    </button>
  );
}
