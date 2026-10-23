import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

/** Builds a URL for a page while keeping the other query parameters (search, sort). */
function pageHref(pathname: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value && key !== "page") search.set(key, value);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Table footer: "Page 2 of 5" with previous / next. Renders nothing for a single page. */
export async function Pagination({
  pathname,
  params,
  page,
  pages,
}: {
  pathname: string;
  params: Record<string, string | undefined>;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;
  const t = await getTranslations("common");
  const previous = page > 1 ? pageHref(pathname, params, page - 1) : null;
  const next = page < pages ? pageHref(pathname, params, page + 1) : null;

  return (
    <nav
      aria-label={t("pagination")}
      className="flex items-center justify-between gap-3 px-4 py-2.5 shadow-[inset_0_1px_0_var(--border)]"
    >
      <p className="text-ui-sm text-muted-foreground" aria-live="polite">
        {t("pageOf", { page, pages })}
      </p>
      <div className="flex gap-2">
        {previous ? (
          <Button asChild variant="outline" size="sm">
            <Link href={previous} rel="prev">
              <ChevronLeftIcon className="rtl:rotate-180" />
              {t("previous")}
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeftIcon className="rtl:rotate-180" />
            {t("previous")}
          </Button>
        )}
        {next ? (
          <Button asChild variant="outline" size="sm">
            <Link href={next} rel="next">
              {t("next")}
              <ChevronRightIcon className="rtl:rotate-180" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {t("next")}
            <ChevronRightIcon className="rtl:rotate-180" />
          </Button>
        )}
      </div>
    </nav>
  );
}
