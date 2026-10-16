import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AddIcon } from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ShareButton } from "@/components/app/share-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isManager, requireMembership } from "@/lib/auth";
import { loadGraphData } from "@/lib/graph-data";
import { idSchema } from "@/lib/validation";
import { GraphClient } from "./graph-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("graph");
  return { title: t("title") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function GraphPage({ searchParams }: { searchParams: SearchParams }) {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("graph");
  const tCustomers = await getTranslations("customers");
  const manager = isManager(membership.role);
  const data = await loadGraphData(organization);
  const focus = (await searchParams).focus;
  const focusId = typeof focus === "string" && idSchema.safeParse(focus).success ? focus : null;
  const app = appIcon("graph");
  const empty = data.customers.length === 0;

  const header = (
    <PageHeader
      icon={app.icon}
      iconClassName={app.tone}
      title={t("title")}
      breadcrumbs={[{ label: organization.name, href: "/" }]}
      menus={!empty}
      actions={!empty && <ShareButton />}
    />
  );

  if (empty) {
    return (
      <>
        {header}
        <PageBody>
          <Card>
            <EmptyState
              icon={app.icon}
              title={t("emptyTitle")}
              description={manager ? t("emptyBody") : tCustomers("emptyBodyReadOnly")}
              action={
                manager && (
                  <Button asChild>
                    <Link href="/customers/new">
                      <AddIcon />
                      {tCustomers("new")}
                    </Link>
                  </Button>
                )
              }
            />
          </Card>
        </PageBody>
      </>
    );
  }

  return (
    <>
      {header}
      <GraphClient
        data={data}
        organizationId={organization.id}
        canEdit={manager}
        focusId={focusId}
      />
    </>
  );
}
