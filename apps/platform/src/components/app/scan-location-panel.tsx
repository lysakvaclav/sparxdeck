"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { AnnotationIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { databaseErrorCode } from "@/lib/errors";
import type { FieldLocationResult } from "@/lib/field";
import { createClient } from "@/lib/supabase/client";
import type { ScanLocationState } from "@/lib/supabase/database.types";
import { ScanLocationBadge } from "./scan-location-badge";

const NOTE_MAX = 500;

/** Why a scan's position is "not determined", in the words of the reason. */
export function locationReason(
  location: FieldLocationResult | null | undefined,
  sitePoint: boolean,
): "denied" | "unavailable" | "timeout" | "unsupported" | "noSitePoint" | "imprecise" | null {
  if (!location || location.state !== "unknown") return null;
  if (location.error) return location.error;
  if (!sitePoint) return "noSitePoint";
  return "imprecise";
}

/**
 * The position of a device's scan in the inspection: the tag, why it is not
 * determined, the distance from the building's point, and the explanation the
 * protocol shows ("basement, no GPS"), which needs a signal to save.
 */
export function ScanLocationPanel({
  itemId,
  state,
  location,
  sitePoint,
  siteId,
  offline,
  onNoteSaved,
}: {
  itemId: string | null;
  state: ScanLocationState | "waiting" | null;
  location: FieldLocationResult | null | undefined;
  sitePoint: boolean;
  siteId: string;
  offline: boolean;
  onNoteSaved: (note: string | null) => void;
}) {
  const t = useTranslations("scanLocation");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const format = useFormatter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(location?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state && sitePoint) return null;
  const reason = locationReason(location, sitePoint);
  const note = location?.note ?? null;

  async function save() {
    if (!itemId) return;
    setSaving(true);
    setError(null);
    const value = text.trim() || null;
    const { error: failed } = await createClient().rpc("explain_scan_location", {
      p_item: itemId,
      p_note: value,
    });
    setSaving(false);
    if (failed) {
      setError(tErr(databaseErrorCode(failed)));
      return;
    }
    onNoteSaved(value);
    setEditing(false);
    toast(t("noteSaved"), "success");
  }

  return (
    <div className="mb-2.5 space-y-1.5 sm:mb-[15px]" data-testid="scan-location">
      {state && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui-sm text-muted-foreground">
          <ScanLocationBadge state={state} />
          {reason && <span>{t(`reason.${reason}`)}</span>}
          {state === "mismatch" && location?.distanceM != null && (
            <span>
              {location.distanceM < 1000
                ? t("distanceM", { distance: format.number(location.distanceM) })
                : t("distanceKm", {
                    distance: format.number(location.distanceM / 1000, {
                      maximumFractionDigits: location.distanceM < 10_000 ? 1 : 0,
                    }),
                  })}
            </span>
          )}
          {itemId && (state === "mismatch" || state === "unknown") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setText(note ?? "");
                setError(null);
                setEditing(true);
              }}
            >
              <AnnotationIcon />
              {note ? t("noteEdit") : t("noteAdd")}
            </Button>
          )}
        </div>
      )}
      {note && <p className="text-ui-sm">{note}</p>}
      {!sitePoint && (
        <p className="text-ui-sm text-muted-foreground">
          {t("noSitePoint")}{" "}
          <Link href={`/sites/${siteId}/edit`} className="text-link underline underline-offset-2">
            {t("addSitePoint")}
          </Link>
        </p>
      )}

      <Dialog
        open={editing}
        onOpenChange={setEditing}
        title={t("noteTitle")}
        closeLabel={tCommon("close")}
      >
        <div className="space-y-2.5">
          <Label htmlFor="location-note">{t("noteLabel")}</Label>
          <Textarea
            id="location-note"
            rows={3}
            maxLength={NOTE_MAX}
            placeholder={t("notePlaceholder")}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="text-ui-sm text-muted-foreground">{t("noteHint")}</p>
          {offline && <p className="text-ui-sm text-warning-text">{t("noteOffline")}</p>}
          {error && <p className="text-ui-sm text-destructive-text">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={saving || offline}>
              {t("noteSave")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
