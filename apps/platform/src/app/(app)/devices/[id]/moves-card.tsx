import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowDownIcon } from "@/components/icons";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { memberNames } from "@/lib/inspection-data";
import { createClient } from "@/lib/supabase/server";

/** Moves shown on the device's page, newest first. */
const SHOWN = 10;

/**
 * Where the device has been: every change of building or location (move, edit,
 * bulk edit, a deleted location), who made it and the note. Hidden while empty.
 */
export async function DeviceMovesCard({
  deviceId,
  organizationId,
}: {
  deviceId: string;
  organizationId: string;
}) {
  const t = await getTranslations("devices.moves");
  const tForm = await getTranslations("devices.form");
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data: moves, count }, names] = await Promise.all([
    supabase
      .from("device_moves")
      .select(
        "id, moved_at, moved_by, note, from_location_name, to_location_name, from_site:sites!device_moves_from_site_id_organization_id_fkey(id, name), to_site:sites!device_moves_to_site_id_organization_id_fkey(id, name)",
        { count: "exact" },
      )
      .eq("device_id", deviceId)
      .order("moved_at", { ascending: false })
      .limit(SHOWN),
    memberNames(organizationId),
  ]);
  if (!moves || moves.length === 0) return null;

  const place = (site: { id: string; name: string } | null, location: string | null) => (
    <span className="min-w-0">
      {site ? (
        <Link href={`/sites/${site.id}`} className="text-link hover:underline">
          {site.name}
        </Link>
      ) : (
        "—"
      )}
      <span className="text-muted-foreground">
        {" · "}
        {location ?? tForm("noLocation")}
      </span>
    </span>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("title")}{" "}
          {!!count && <span className="font-normal text-muted-foreground">({count})</span>}
        </CardTitle>
      </CardHeader>
      <ol>
        {moves.map((move) => (
          <li
            key={move.id}
            className="space-y-1 px-[15px] py-2.5 shadow-[inset_0_-1px_0_var(--border)] last:shadow-none"
          >
            <p className="text-ui-sm text-muted-foreground">
              {format.dateTime(new Date(move.moved_at), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {move.moved_by && names.get(move.moved_by) ? ` · ${names.get(move.moved_by)}` : ""}
            </p>
            <p className="flex flex-col gap-0.5">
              <span className="sr-only">{t("from")}</span>
              {place(move.from_site, move.from_location_name)}
              <ArrowDownIcon size={12} aria-hidden className="text-muted-foreground" />
              <span className="sr-only">{t("to")}</span>
              {place(move.to_site, move.to_location_name)}
            </p>
            {move.note && <p className="break-words whitespace-pre-line">{move.note}</p>}
          </li>
        ))}
      </ol>
    </Card>
  );
}
