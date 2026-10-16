import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BarcodeIcon } from "@/components/icons";

/** A label that doesn't open a device of the user's company: one neutral answer for all cases. */
export default async function LabelNotFound() {
  const t = await getTranslations("labels.scan");
  const app = appIcon("devices");
  return (
    <>
      <PageHeader icon={app.icon} iconClassName={app.tone} title={t("notFoundTitle")} />
      <PageBody width="narrow">
        <Card>
          <EmptyState
            icon={BarcodeIcon}
            title={t("notFoundTitle")}
            description={t("notFoundBody")}
            action={
              <Button asChild variant="outline">
                <Link href="/devices">{t("toDevices")}</Link>
              </Button>
            }
          />
        </Card>
      </PageBody>
    </>
  );
}
