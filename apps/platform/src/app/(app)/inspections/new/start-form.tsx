"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { StartInspectionButton } from "../start-button";

type SiteChoice = {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  running: boolean;
};

/** Pick a building; an inspection already running there is joined, not duplicated. */
export function StartForm({ sites, initialSite }: { sites: SiteChoice[]; initialSite: string }) {
  const t = useTranslations("inspections");
  const tCommon = useTranslations("common");
  const [siteId, setSiteId] = useState(initialSite);
  const site = sites.find((option) => option.id === siteId);
  const customers = [...new Map(sites.map((option) => [option.customerId, option.customerName]))];

  return (
    <>
      <div className="space-y-[15px] p-[15px]">
        <p className="text-ui text-muted-foreground">{t("startBody")}</p>
        <Field id="inspection-site" label={t("site")}>
          <NativeSelect value={siteId} onChange={(event) => setSiteId(event.target.value)}>
            {!siteId && <option value="">{t("sitePlaceholder")}</option>}
            {customers.map(([customerId, customerName]) => (
              <optgroup key={customerId} label={customerName}>
                {sites
                  .filter((option) => option.customerId === customerId)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.running ? t("siteInProgress", { name: option.name }) : option.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <CardFooter>
        <Button asChild variant="outline">
          <Link href="/inspections">{tCommon("cancel")}</Link>
        </Button>
        {site ? (
          <StartInspectionButton
            siteId={site.id}
            label={site.running ? t("continue") : t("start")}
          />
        ) : (
          <Button disabled>{t("start")}</Button>
        )}
      </CardFooter>
    </>
  );
}
