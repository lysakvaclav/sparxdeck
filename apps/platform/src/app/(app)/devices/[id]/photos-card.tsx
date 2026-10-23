import { getTranslations } from "next-intl/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ORG_ASSETS_BUCKET, SIGNED_URL_SECONDS } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { AddDevicePhoto, DeletePhotoButton } from "./photo-controls";

/** Photos of the device itself (not tied to one inspection), with upload and delete. */
export async function DevicePhotosCard({
  deviceId,
  organizationId,
}: {
  deviceId: string;
  organizationId: string;
}) {
  const t = await getTranslations("devices.detail");
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("device_photos")
    .select("id, storage_path")
    .eq("device_id", deviceId)
    .order("created_at");
  const paths = (photos ?? []).map((photo) => photo.storage_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from(ORG_ASSETS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
    : { data: [] };
  const urlOf = (path: string) => signed?.find((entry) => entry.path === path)?.signedUrl ?? "";

  return (
    <Card>
      <CardHeader actions={<AddDevicePhoto deviceId={deviceId} organizationId={organizationId} />}>
        <CardTitle>{t("photos")}</CardTitle>
      </CardHeader>
      {photos && photos.length > 0 ? (
        <ul className="flex flex-wrap gap-2 p-5">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative">
              <a href={urlOf(photo.storage_path)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                <img
                  src={urlOf(photo.storage_path)}
                  alt={t("photoAlt", { number: index + 1 })}
                  className="size-24 rounded-md object-cover shadow-[0_0_0_1px_var(--border)]"
                />
              </a>
              <DeletePhotoButton photoId={photo.id} number={index + 1} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-ui text-muted-foreground">{t("noPhotos")}</p>
      )}
    </Card>
  );
}
