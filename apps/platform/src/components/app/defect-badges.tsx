import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { SEVERITY_BADGE, STATUS_BADGE, defectNumber } from "@/lib/defects";
import type { DefectSeverity, DefectStatus } from "@/lib/supabase/database.types";

export function SeverityBadge({ severity }: { severity: DefectSeverity }) {
  const t = useTranslations("defects.severity");
  return <Badge variant={SEVERITY_BADGE[severity]}>{t(severity)}</Badge>;
}

export function DefectStatusBadge({ status }: { status: DefectStatus }) {
  const t = useTranslations("defects.status");
  return <Badge variant={STATUS_BADGE[status]}>{t(status)}</Badge>;
}

/** "Z-0012" (cs) / "D-0012" (en). */
export function DefectRef({ number, className }: { number: number; className?: string }) {
  const t = useTranslations("defects");
  return (
    <span className={className ?? "font-mono tabular-nums"}>
      {t("number", { number: defectNumber(number) })}
    </span>
  );
}
