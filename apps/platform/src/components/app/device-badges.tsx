import { useFormatter, useTranslations } from "next-intl";
import { WarningSignIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { CALENDAR_FORMAT, calendarDate, type DueState } from "@/lib/due";
import type { DeviceStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

// Colour is reserved for state: overdue red, soon orange. "OK" stays plain text,
// so a long list of healthy devices doesn't turn green.

export const DUE_BADGE = {
  overdue: "danger",
  soon: "warning",
  ok: "success",
  never: "default",
} as const;

/** Status of a device; active devices show nothing unless `showActive`. */
export function StatusBadge({
  status,
  showActive = false,
}: {
  status: DeviceStatus;
  showActive?: boolean;
}) {
  const t = useTranslations("devices.status");
  if (status === "active" && !showActive) return null;
  return <Badge variant={status === "active" ? "outline" : "default"}>{t(status)}</Badge>;
}

/** Next due date with its state, for table cells. Inactive devices show a dash. */
export function DueCell({
  status,
  nextDue,
  state,
  className,
}: {
  status: DeviceStatus;
  nextDue: string | null;
  state: DueState;
  className?: string;
}) {
  const t = useTranslations("devices.due");
  const format = useFormatter();
  if (status !== "active") return <span className="text-subtle">—</span>;
  if (!nextDue) return <span className={cn("text-muted-foreground", className)}>{t("never")}</span>;
  const date = format.dateTime(calendarDate(nextDue), CALENDAR_FORMAT);
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span
        className={cn(
          "tabular-nums",
          state === "overdue" && "font-semibold text-destructive-text",
          state === "soon" && "font-semibold text-warning-text",
        )}
      >
        {date}
      </span>
      {(state === "overdue" || state === "soon") && (
        <Badge variant={DUE_BADGE[state]}>
          {state === "overdue" && <WarningSignIcon size={12} />}
          {t(state)}
        </Badge>
      )}
    </span>
  );
}
