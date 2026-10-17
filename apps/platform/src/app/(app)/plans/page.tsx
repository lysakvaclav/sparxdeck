import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LayersIcon, SearchIcon } from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PlanTile, planNote } from "@/components/app/plan-tile";
import { SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth";
import { organizationPlans, type PlanListItem } from "@/lib/floor-plans-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("plans") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Case- and accent-insensitive text for matching ("Přízemí" ~ "prizemi"). */
function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * All floor plans of the company by building, to find a plan without going
 * through the customer and the building. Plans are uploaded on the building.
 */
export default async function PlansPage({ searchParams }: { searchParams: SearchParams }) {
  await requireMembership();
  const t = await getTranslations("plans");
  const tNav = await getTranslations("nav");
  const app = appIcon("plans");
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? "";

  const plans = await organizationPlans();
  const words = fold(q).split(/\s+/).filter(Boolean);
  const shown = plans.filter((plan) => {
    const text = fold(
      [plan.name, plan.locationName, plan.siteName, plan.customerName].filter(Boolean).join(" "),
    );
    return words.every((word) => text.includes(word));
  });
  const groups: { siteId: string; rows: PlanListItem[] }[] = [];
  for (const plan of shown) {
    const group = groups.at(-1);
    if (group?.siteId === plan.siteId) group.rows.push(plan);
    else groups.push({ siteId: plan.siteId, rows: [plan] });
  }
  const SiteIcon = OBJECT_TYPES.site.icon;

  return (
    <>
      <PageHeader icon={app.icon} iconClassName={app.tone} title={tNav("plans")} />
      <PageBody>
        {plans.length === 0 ? (
          <Card>
            <EmptyState
              icon={LayersIcon}
              title={t("list.emptyTitle")}
              description={t("list.emptyBody")}
              action={
                <Button asChild variant="outline">
                  <Link href="/customers">{t("list.emptyAction")}</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-2.5 sm:space-y-[15px]">
            <Card>
              <div className="flex flex-col gap-2 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput placeholder={t("list.searchPlaceholder")} />
                <p className="text-ui-sm text-muted-foreground" aria-live="polite">
                  {t("list.count", { count: shown.length })}
                </p>
              </div>
            </Card>

            {groups.length === 0 ? (
              <Card>
                <EmptyState
                  icon={SearchIcon}
                  title={t("list.noResultsTitle")}
                  description={t("list.noResultsBody")}
                />
              </Card>
            ) : (
              groups.map(({ siteId, rows }) => (
                <Card key={siteId}>
                  <CardHeader>
                    <CardTitle className="flex min-w-0 items-center gap-2">
                      <SiteIcon className={`shrink-0 ${OBJECT_TYPES.site.text}`} />
                      <Link
                        href={`/sites/${siteId}#plans`}
                        className="touch-link truncate hover:underline"
                      >
                        {rows[0]!.siteName}
                      </Link>
                      <span className="truncate font-normal text-muted-foreground">
                        {rows[0]!.customerName}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <ul className="grid grid-cols-1 gap-2.5 p-[15px] sm:grid-cols-2 xl:grid-cols-4">
                    {rows.map((plan) => (
                      <PlanTile
                        key={plan.id}
                        href={`/sites/${siteId}/plans/${plan.id}`}
                        name={plan.name}
                        note={planNote(plan, t("devicesCount", { count: plan.placed }))}
                        imageUrl={plan.imageUrl}
                      />
                    ))}
                  </ul>
                </Card>
              ))
            )}
          </div>
        )}
      </PageBody>
    </>
  );
}
