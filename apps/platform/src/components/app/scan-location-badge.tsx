"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ScanLocationState } from "@/lib/supabase/database.types";

/**
 * The position of a device's scan against its building: a small neutral tag
 * whose words carry the meaning (an indication, not a judgement).
 */
export function ScanLocationBadge({
  state,
  className,
}: {
  state: ScanLocationState | "waiting";
  className?: string;
}) {
  const t = useTranslations("scanLocation.state");
  return (
    <Badge variant="outline" className={className} data-scan-location={state}>
      {t(state)}
    </Badge>
  );
}
