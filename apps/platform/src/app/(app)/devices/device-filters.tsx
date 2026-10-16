"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CrossIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { DEVICE_STATUSES } from "@/lib/devices";
import type { DeviceFilterValues } from "@/lib/device-list";
import { DUE_STATES } from "@/lib/due";
import { HORIZONS } from "@/lib/due-plan";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

export type FilterValues = DeviceFilterValues;

/** Filters that depend on another: changing a customer resets the building, etc. */
const RESETS: Record<keyof FilterValues, (keyof FilterValues)[]> = {
  customer: ["site", "location"],
  site: ["location"],
  location: [],
  type: [],
  status: [],
  due: [],
};

/**
 * Filter bar of the device list. Every filter lives in the URL (shareable,
 * survives a reload); changing one goes back to page 1.
 */
export function DeviceFilters({
  values,
  customers,
  sites,
  locations,
  types,
}: {
  values: FilterValues;
  customers: Option[];
  sites: (Option & { customerId: string })[];
  locations: Option[] | null;
  types: Option[];
}) {
  const t = useTranslations("devices.filters");
  const tStatus = useTranslations("devices.status");
  const tDue = useTranslations("devices.due");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(changes: FilterValues) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes) as [keyof FilterValues, string][]) {
      if (value) params.set(key, value);
      else params.delete(key);
      for (const dependent of RESETS[key]) params.delete(dependent);
    }
    params.delete("page");
    const search = params.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname));
  }

  function clear() {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    const search = params.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname));
  }

  const siteOptions = values.customer
    ? sites.filter((site) => site.customerId === values.customer)
    : sites;
  const active = Object.values(values).some(Boolean);

  const select = (
    key: keyof FilterValues,
    label: string,
    all: string,
    options: { value: string; label: string }[],
  ) => (
    <div className="min-w-0">
      <label htmlFor={`filter-${key}`} className="sr-only">
        {label}
      </label>
      <NativeSelect
        id={`filter-${key}`}
        value={values[key] ?? ""}
        onChange={(event) => apply({ [key]: event.target.value })}
        className={cn(values[key] && "font-semibold text-link")}
      >
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&>div]:sm:w-44"
    >
      {select(
        "customer",
        t("customer"),
        t("allCustomers"),
        customers.map((customer) => ({ value: customer.id, label: customer.name })),
      )}
      {select(
        "site",
        t("site"),
        t("allSites"),
        siteOptions.map((site) => ({ value: site.id, label: site.name })),
      )}
      {locations &&
        select("location", t("location"), t("allLocations"), [
          ...locations.map((location) => ({ value: location.id, label: location.name })),
          { value: "none", label: t("noLocation") },
        ])}
      {types.length > 1 &&
        select(
          "type",
          t("type"),
          t("allTypes"),
          types.map((type) => ({ value: type.id, label: type.name })),
        )}
      {select(
        "status",
        t("status"),
        t("allStatuses"),
        DEVICE_STATUSES.map((status) => ({ value: status, label: tStatus(status) })),
      )}
      {select("due", t("due"), t("allDue"), [
        ...DUE_STATES.map((state) => ({ value: state, label: tDue(state) })),
        ...HORIZONS.map((days) => ({ value: `${days}d`, label: tDue("within", { days }) })),
      ])}
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:w-auto!">
        {active && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <CrossIcon />
            {t("clear")}
          </Button>
        )}
        {pending && <Spinner size={16} />}
      </div>
    </div>
  );
}
