"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CrossIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

/** Customer, building, and date range of the summary report, kept in the URL. */
export function SummaryFilters({
  customer,
  site,
  from,
  to,
  customers,
  sites,
}: {
  customer?: string;
  site?: string;
  from: string;
  to: string;
  customers: Option[];
  sites: (Option & { customerId: string })[];
}) {
  const t = useTranslations("inspections.summary");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(changes: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if ("customer" in changes) params.delete("site");
    const search = params.toString();
    startTransition(() =>
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }),
    );
  }

  const siteOptions = customer ? sites.filter((option) => option.customerId === customer) : sites;

  return (
    <div role="group" aria-label={t("filtersLabel")} className="flex flex-wrap items-end gap-2">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center [&>div]:sm:w-48">
        <NativeSelect
          aria-label={t("customer")}
          value={customer ?? ""}
          onChange={(event) => apply({ customer: event.target.value })}
          className={cn(customer && "font-semibold text-link")}
        >
          <option value="">{t("allCustomers")}</option>
          {customers.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("site")}
          value={site ?? ""}
          onChange={(event) => apply({ site: event.target.value })}
          className={cn(site && "font-semibold text-link")}
        >
          <option value="">{t("allSites")}</option>
          {siteOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label={t("from")}
          className="w-36"
          value={from}
          onChange={(event) => apply({ from: event.target.value })}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          aria-label={t("to")}
          className="w-36"
          value={to}
          onChange={(event) => apply({ to: event.target.value })}
        />
      </div>
      {(customer || site) && (
        <Button variant="ghost" size="sm" onClick={() => apply({ customer: "", site: "" })}>
          <CrossIcon />
          {t("clear")}
        </Button>
      )}
      {pending && <Spinner size={16} />}
    </div>
  );
}
