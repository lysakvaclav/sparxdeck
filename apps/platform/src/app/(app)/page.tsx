import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  AddIcon,
  ChevronRightIcon,
  CogIcon,
  DataLineageIcon,
  FormIcon,
  HistoryIcon,
  IssueIcon,
  NewPersonIcon,
  PersonIcon,
  PlayIcon,
  type IconComponent,
} from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RowLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { isManager, requireMembership } from "@/lib/auth";
import { deviceName } from "@/lib/devices";
import { todayInTimeZone } from "@/lib/due";
import { readHorizon } from "@/lib/due-plan";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { idSchema } from "@/lib/validation";
import type { NodeKind } from "@/lib/graph";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { DueOverview } from "./due-overview";
import { GettingStarted } from "./getting-started";
import { MyWork } from "./my-work";
import { OverviewFilters } from "./overview-filters";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

type RecentItem = {
  kind: NodeKind;
  id: string;
  name: string;
  href: string;
  parent: string | null;
  updatedAt: string;
};

const RECENT_LIMIT = 8;

// Home: what the company has recorded, how its devices stand against their due
// dates, open defects and inspections, and what changed lately.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
const validId = (value: string | undefined) =>
  value && idSchema.safeParse(value).success ? value : undefined;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { membership, organization } = await requireMembership();
  const params = await searchParams;
  const horizon = readHorizon(first(params.horizon));
  const scope = { customer: validId(first(params.customer)), site: validId(first(params.site)) };
  const t = await getTranslations("dashboard");
  const tNav = await getTranslations("nav");
  const tGraph = await getTranslations("graph");
  const format = await getFormatter();
  const manager = isManager(membership.role);
  const now = new Date();
  const today = todayInTimeZone(organization.timezone);
  const soonDays = organization.due_soon_days;

  const supabase = await createClient();
  const count = { count: "exact", head: true } as const;
  const org = organization.id;
  const [
    customers,
    sites,
    devices,
    members,
    recentCustomers,
    recentSites,
    recentLocations,
    recentDevices,
    customerOptions,
    siteOptions,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id", count)
      .eq("organization_id", org)
      .is("deleted_at", null),
    supabase.from("sites").select("id", count).eq("organization_id", org).is("deleted_at", null),
    supabase.from("devices").select("id", count).eq("organization_id", org).is("deleted_at", null),
    supabase.from("memberships").select("id", count).eq("organization_id", org),
    supabase
      .from("customers")
      .select("id, name, updated_at")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("sites")
      .select("id, name, updated_at, customers(name)")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("locations")
      .select("id, name, updated_at, sites!inner(id, name, deleted_at)")
      .eq("organization_id", org)
      .is("sites.deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("devices")
      .select("id, label_number, updated_at, site:sites(name), type:device_types(name)")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(RECENT_LIMIT),
    fetchAll((from, to) =>
      supabase
        .from("customers")
        .select("id, name")
        .eq("organization_id", org)
        .is("deleted_at", null)
        .order("name")
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("sites")
        .select("id, name, customer_id")
        .eq("organization_id", org)
        .is("deleted_at", null)
        .order("name")
        .order("id")
        .range(from, to),
    ),
  ]);
  const { data: openInspections } = await supabase
    .from("inspections")
    .select("id, started_at, site:sites(name, customer:customers(name))")
    .eq("organization_id", org)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(5);
  const tInspections = await getTranslations("inspections");
  const tDefects = await getTranslations("defects");
  const recent: RecentItem[] = [
    ...(recentCustomers.data ?? []).map((c) => ({
      kind: "customer" as const,
      id: c.id,
      name: c.name,
      href: `/customers/${c.id}`,
      parent: null,
      updatedAt: c.updated_at,
    })),
    ...(recentSites.data ?? []).map((s) => ({
      kind: "site" as const,
      id: s.id,
      name: s.name,
      href: `/sites/${s.id}`,
      parent: s.customers?.name ?? null,
      updatedAt: s.updated_at,
    })),
    ...(recentLocations.data ?? []).map((l) => ({
      kind: "location" as const,
      id: l.id,
      name: l.name,
      href: `/sites/${l.sites.id}`,
      parent: l.sites.name,
      updatedAt: l.updated_at,
    })),
    ...(recentDevices.data ?? []).map((d) => ({
      kind: "device" as const,
      id: d.id,
      name: deviceName(d.type?.name ?? "", d.label_number),
      href: `/devices/${d.id}`,
      parent: d.site?.name ?? null,
      updatedAt: d.updated_at,
    })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_LIMIT);

  const stats: { label: string; value: number; href: string }[] = [
    {
      label: t("stats.customers"),
      value: customers.count ?? 0,
      href: "/customers",
    },
    { label: t("stats.sites"), value: sites.count ?? 0, href: "/graph" },
    { label: t("stats.devices"), value: devices.count ?? 0, href: "/devices" },
    { label: t("stats.members"), value: members.count ?? 0, href: "/team" },
  ];

  const actions: { label: string; href: string; icon: IconComponent; tone: string }[] = [
    {
      label: tInspections("start"),
      href: "/inspections/new",
      icon: PlayIcon,
      tone: appIcon("inspections").tone,
    },
    {
      label: tDefects("new"),
      href: "/defects/new",
      icon: IssueIcon,
      tone: appIcon("defects").tone,
    },
    ...(manager
      ? [
          {
            label: t("actions.newCustomer"),
            href: "/customers/new",
            icon: AddIcon,
            tone: "text-node-customer",
          },
          {
            label: t("actions.newDevice"),
            href: "/devices/new",
            icon: AddIcon,
            tone: "text-node-device",
          },
        ]
      : []),
    { label: tNav("graph"), href: "/graph", icon: DataLineageIcon, tone: appIcon("graph").tone },
    ...(manager
      ? [
          {
            label: t("actions.invite"),
            href: "/team",
            icon: NewPersonIcon,
            tone: appIcon("team").tone,
          },
        ]
      : []),
    {
      label: t("actions.settings"),
      href: "/settings",
      icon: CogIcon,
      tone: "text-muted-foreground",
    },
    {
      label: t("actions.account"),
      href: "/account",
      icon: PersonIcon,
      tone: "text-muted-foreground",
    },
  ];

  const home = appIcon("dashboard");

  return (
    <>
      <PageHeader icon={home.icon} iconClassName={home.tone} title={tNav("dashboard")} />
      <PageBody>
        <div className="mb-[15px] flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h2 className="text-ui-lg font-semibold">
            {t("welcome", {
              name: membership.display_name.split(" ")[0] ?? membership.display_name,
            })}
          </h2>
          <span className="text-muted-foreground">{organization.name}</span>
        </div>

        {manager && <GettingStarted organization={organization} />}

        {/* One strip of figures with thin dividers (two rows of two on phones). */}
        <div className="grid grid-cols-2 overflow-hidden rounded-lg bg-card shadow-elevation-0 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Link
              key={stat.label}
              href={stat.href}
              className={cn(
                "px-[15px] py-3 transition-colors hover:bg-muted",
                index % 2 === 1 && "shadow-[inset_1px_0_0_var(--border)]",
                index === 2 && "shadow-[inset_0_1px_0_var(--border)] lg:shadow-[inset_1px_0_0_var(--border)]",
                index === 3 &&
                  "shadow-[inset_1px_0_0_var(--border),inset_0_1px_0_var(--border)] lg:shadow-[inset_1px_0_0_var(--border)]",
              )}
            >
              <span className="block truncate text-ui-sm text-muted-foreground">{stat.label}</span>
              <span className="mt-0.5 block text-2xl leading-8 font-semibold tracking-tight tabular-nums">
                {stat.value}
              </span>
            </Link>
          ))}
        </div>

        <MyWork organizationId={organization.id} userId={membership.user_id} today={today} />

        {openInspections && openInspections.length > 0 && (
          <Card className="mt-2.5 sm:mt-[15px]">
            <CardHeader>
              <CardTitle>{t("inProgressTitle")}</CardTitle>
            </CardHeader>
            <ul className="p-[5px]">
              {openInspections.map((inspection) => (
                <li key={inspection.id}>
                  <Link
                    href={`/inspections/${inspection.id}`}
                    className="flex min-h-[30px] items-center gap-[7px] rounded-sm px-[7px] text-ui transition-colors hover:bg-accent pointer-coarse:min-h-11"
                  >
                    <FormIcon className={appIcon("inspections").tone} />
                    <span className="min-w-0 flex-1 truncate">
                      {inspection.site?.name}
                      <span className="text-muted-foreground">
                        {" · "}
                        {inspection.site?.customer?.name}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-ui-sm text-muted-foreground sm:inline">
                      {format.relativeTime(new Date(inspection.started_at), now)}
                    </span>
                    <ChevronRightIcon className="text-subtle rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <section aria-labelledby="overview-title" className="mt-[15px] sm:mt-5">
          <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="overview-title" className="text-ui-lg font-semibold">
              {t("overview.title")}
            </h2>
            <OverviewFilters
              customer={scope.customer}
              site={scope.site}
              customers={customerOptions}
              sites={siteOptions.map((site) => ({
                id: site.id,
                name: site.name,
                customerId: site.customer_id,
              }))}
            />
          </div>
          <DueOverview
            organizationId={organization.id}
            today={today}
            soonDays={soonDays}
            horizon={horizon}
            scope={scope}
          />
        </section>

        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:mt-[15px] sm:gap-[15px] lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle>{t("recentTitle")}</CardTitle>
            </CardHeader>
            {recent.length > 0 ? (
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>{t("columns.object")}</TableHeaderCell>
                    <TableHeaderCell className="hidden sm:table-cell">
                      {t("columns.type")}
                    </TableHeaderCell>
                    <TableHeaderCell className="hidden md:table-cell">
                      {t("columns.parent")}
                    </TableHeaderCell>
                    <TableHeaderCell className="text-end">{t("columns.updated")}</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {recent.map((item) => {
                    const type = OBJECT_TYPES[item.kind];
                    return (
                      <TableRow key={`${item.kind}-${item.id}`}>
                        <TableCell className="w-full max-w-0 md:w-[45%]">
                          <span className="flex min-w-0 items-center gap-2">
                            <type.icon className={type.text} />
                            <RowLink href={item.href} className="truncate">
                              {item.name}
                            </RowLink>
                          </span>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap sm:table-cell">
                          <Badge>{tGraph(`kinds.${item.kind}`)}</Badge>
                        </TableCell>
                        <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell">
                          {item.parent ?? "—"}
                        </TableCell>
                        <TableCell className="text-end whitespace-nowrap text-muted-foreground">
                          {format.relativeTime(new Date(item.updatedAt), now)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState icon={HistoryIcon} title={t("recentEmpty")} />
            )}
          </Card>

          <div className="space-y-2.5 sm:space-y-[15px]">
            <Card>
              <CardHeader>
                <CardTitle>{t("quickActions")}</CardTitle>
              </CardHeader>
              <ul className="p-[5px]">
                {actions.map((action) => (
                  <li key={action.href + action.label}>
                    <Link
                      href={action.href}
                      className="flex min-h-[30px] items-center gap-[7px] rounded-sm px-[7px] text-ui transition-colors hover:bg-accent pointer-coarse:min-h-11"
                    >
                      <action.icon className={cn(action.tone)} />
                      <span className="min-w-0 flex-1 truncate">{action.label}</span>
                      <ChevronRightIcon className="text-subtle rtl:rotate-180" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
