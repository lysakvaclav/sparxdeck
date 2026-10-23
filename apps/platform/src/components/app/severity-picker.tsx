"use client";

import { useTranslations } from "next-intl";
import { DEFECT_SEVERITIES } from "@/lib/defects";
import type { DefectSeverity } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const CHOSEN: Record<DefectSeverity | "none", string> = {
  critical: "bg-destructive text-white",
  // Darker than --warning so the white text reads (WCAG AA).
  major: "bg-[#a66321] text-white",
  minor: "bg-[#5d6979] text-white",
  none: "bg-[#5d6979] text-white",
};

/**
 * The severity as a row of choices. With `noneLabel` the first choice is "no
 * defect" (null), for failed answers that record a defect only when asked to.
 */
export function SeverityPicker({
  value,
  onChange,
  label,
  noneLabel,
  disabled,
}: {
  value: DefectSeverity | null;
  onChange: (value: DefectSeverity | null) => void;
  label: string;
  noneLabel?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("defects.severity");
  const options: (DefectSeverity | null)[] = noneLabel
    ? [null, ...DEFECT_SEVERITIES]
    : [...DEFECT_SEVERITIES];
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-2", noneLabel ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}
    >
      {options.map((severity) => {
        const chosen = value === severity;
        return (
          <button
            key={severity ?? "none"}
            type="button"
            role="radio"
            aria-checked={chosen}
            disabled={disabled}
            // A second tap keeps the choice, as with the answers.
            onClick={() => !chosen && onChange(severity)}
            className={cn(
              "flex h-9 items-center justify-center rounded-md px-2 text-ui font-medium transition-colors disabled:opacity-50 pointer-coarse:h-11",
              chosen ? CHOSEN[severity ?? "none"] : "surface-button hover:bg-[var(--btn-bg-hover)]",
            )}
          >
            {severity ? t(severity) : noneLabel}
          </button>
        );
      })}
    </div>
  );
}
