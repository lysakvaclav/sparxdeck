import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

export type DetailItem = { label: string; value?: React.ReactNode };

/** Object properties as two columns (label | value) over light dividers. */
export async function DetailList({
  items,
  className,
}: {
  items: DetailItem[];
  className?: string;
}) {
  const t = await getTranslations("common");
  return (
    <dl className={cn("text-ui", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="grid grid-cols-[minmax(0,38%)_minmax(0,1fr)] gap-4 px-5 py-3 shadow-[inset_0_-1px_0_var(--border)] last:shadow-none"
        >
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="break-words whitespace-pre-line">
            {item.value || <span className="text-subtle">{t("notSet")}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
