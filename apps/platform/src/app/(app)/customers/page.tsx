import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AddIcon, DataLineageIcon, SearchIcon, UploadIcon } from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { SearchInput } from "@/components/app/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  RowLink,
  SortableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { isManager, requireMembership } from "@/lib/auth";
import { ilikeAny, pageParam } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("customers");
  return { title: t("title") };
}

const PAGE_SIZE = 20;
const SORTS = ["name", "newest"] as const;
type Sort = (typeof SORTS)[number];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function listHref(q: string, sort: Sort, page = 1) {
  const search = new URLSearchParams();
  if (q) search.set("q", q);
  if (sort !== "name") search.set("sort", sort);
  if (page > 1) search.set("page", String(page));
  const target = search.toString();
  return target ? `/customers?${target}` : "/customers";
}

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("customers");
  const tGuide = await getTranslations("guide");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const tImport = await getTranslations("import");
  const format = await getFormatter();
  const manager = isManager(membership.role);

  const params = await searchParams;
  const q = first(params.q)?.trim().slice(0, 100) ?? "";
  const sort: Sort = SORTS.includes(first(params.sort) as Sort)
    ? (first(params.sort) as Sort)
    : "name";
  const page = pageParam(params.page);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select(
      "id, name, contact_person, company_id, email, phone, created_at, is_sample, sites(count)",
      {
        count: "exact",
      },
    )
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .is("sites.deleted_at", null);
  const filter = ilikeAny(["name", "contact_person", "company_id"], q);
  if (filter) query = query.or(filter);
  query =
    sort === "newest"
      ? query.order("created_at", { ascending: false })
      : query.order("name", { ascending: true });
  const {
    data: customers,
    count,
    error,
  } = await query.order("id").range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // A page past the end (e.g. after deleting the last customer on it): go to the last one.
  if ((error || !customers?.length) && page > 1) redirect(listHref(q, sort, pages));

  const newButton = manager && (
    <Button asChild>
      <Link href="/customers/new">
        <AddIcon />
        {t("new")}
      </Link>
    </Button>
  );

  const importButton = manager && (
    <Button asChild variant="outline">
      <Link href="/import">
        <UploadIcon />
        {tImport("action")}
      </Link>
    </Button>
  );

  const nothingYet = total === 0 && !q;
  const app = appIcon("customers");
  const CustomerIcon = OBJECT_TYPES.customer.icon;

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[{ label: organization.name, href: "/" }]}
        actions={
          <>
            {!nothingYet && (
              <Button asChild variant="outline">
                <Link href="/graph">
                  <DataLineageIcon />
                  {tNav("graph")}
                </Link>
              </Button>
            )}
            {importButton}
            {newButton}
          </>
        }
      />
      <PageBody>
        <Card>
          {nothingYet ? (
            <EmptyState
              icon={CustomerIcon}
              title={t("emptyTitle")}
              description={manager ? t("emptyBody") : t("emptyBodyReadOnly")}
              action={
                manager && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {newButton}
                    {importButton}
                  </div>
                )
              }
            />
          ) : (
            <>
              <div className="flex flex-col gap-2 px-3 py-3 sm:px-4 shadow-[inset_0_-1px_0_var(--border)] sm:flex-row sm:items-center sm:justify-between">
                <SearchInput placeholder={t("searchPlaceholder")} />
                <p className="text-ui-sm text-muted-foreground" aria-live="polite">
                  {tCommon("results", { count: total })}
                </p>
              </div>

              {customers && customers.length > 0 ? (
                <Table>
                  <TableHead>
                    <tr>
                      <SortableHeader
                        href={listHref(q, "name")}
                        active={sort === "name"}
                        direction="asc"
                      >
                        {t("columns.name")}
                      </SortableHeader>
                      <TableHeaderCell className="hidden md:table-cell">
                        {t("form.contactPerson")}
                      </TableHeaderCell>
                      <TableHeaderCell className="hidden xl:table-cell">
                        {t("form.email")}
                      </TableHeaderCell>
                      <TableHeaderCell className="hidden xl:table-cell">
                        {t("form.phone")}
                      </TableHeaderCell>
                      <TableHeaderCell className="hidden lg:table-cell">
                        {t("form.companyId")}
                      </TableHeaderCell>
                      <TableHeaderCell className="text-end">{t("columns.sites")}</TableHeaderCell>
                      <SortableHeader
                        href={listHref(q, "newest")}
                        active={sort === "newest"}
                        direction="desc"
                        className="hidden sm:table-cell"
                      >
                        {t("columns.added")}
                      </SortableHeader>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {customers.map((customer) => {
                      const siteCount = customer.sites[0]?.count ?? 0;
                      const contact = [customer.contact_person, customer.email, customer.phone]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <TableRow key={customer.id}>
                          <TableCell className="w-full max-w-0 md:w-[30%]">
                            <span className="flex min-w-0 items-center gap-2">
                              <CustomerIcon className={OBJECT_TYPES.customer.text} />
                              <span className="min-w-0">
                                <RowLink
                                  href={`/customers/${customer.id}`}
                                  className="block truncate"
                                >
                                  {customer.name}
                                </RowLink>
                                {customer.is_sample && (
                                  <Badge variant="warning" className="relative z-[1] me-1 mt-0.5">
                                    {tGuide("sampleBadge")}
                                  </Badge>
                                )}
                                <span className="block truncate text-ui-sm text-muted-foreground md:hidden">
                                  {contact || t("noContact")}
                                </span>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="hidden max-w-0 truncate md:table-cell">
                            {customer.contact_person ?? <span className="text-subtle">—</span>}
                          </TableCell>
                          <TableCell className="hidden max-w-0 truncate xl:table-cell">
                            {customer.email ?? <span className="text-subtle">—</span>}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap xl:table-cell">
                            {customer.phone ?? <span className="text-subtle">—</span>}
                          </TableCell>
                          <TableCell className="hidden font-mono text-ui-sm lg:table-cell">
                            {customer.company_id ?? (
                              <span className="font-sans text-ui text-subtle">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {siteCount > 0 ? siteCount : <span className="text-subtle">0</span>}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                            {format.dateTime(new Date(customer.created_at), {
                              dateStyle: "medium",
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={SearchIcon}
                  title={t("noResultsTitle")}
                  description={t("noResultsBody")}
                />
              )}

              <Pagination
                pathname="/customers"
                params={{ q: q || undefined, sort: sort === "name" ? undefined : sort }}
                page={page}
                pages={pages}
              />
            </>
          )}
        </Card>
      </PageBody>
    </>
  );
}
