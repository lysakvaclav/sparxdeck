"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CrossIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { DEFECT_SEVERITIES, DEFECT_STATUSES } from "@/lib/defects";
import { cn } from "@/lib/utils";

export type DefectFilterValues = {
  /** Empty: unresolved (open and in progress); "all": every status. */
  status?: string;
  severity?: string;
  customer?: string;
  site?: string;
  /** "me", "none" or a member's user id. */
  assignee?: string;
  /** "overdue" (fix-by date passed) or "set" (has a fix-by date). */
  due?: string;
};

const RESETS: Record<keyof DefectFilterValues, (keyof DefectFilterValues)[]> = {
  status: [],
  severity: [],
  customer: ["site"],
  site: [],
  assignee: [],
  due: [],
};

/** Filter bar of the defect list; every filter lives in the URL. */
export function DefectFilters({
  values,
  customers,
  sites,
  members,
}: {
  values: DefectFilterValues;
  customers: { id: string; name: string }[];
  sites: { id: string; name: string; customerId: string }[];
  members: { id: string; name: string }[];
}) {
  const t = useTranslations("defects");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(key: keyof DefectFilterValues, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    for (const dependent of RESETS[key]) params.delete(dependent);
    params.delete("page");
    const search = params.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname));
  }

  function clear() {
    const params = new URLSearchParams();
    for (const key of ["q", "sort"]) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    const search = params.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname));
  }

  const siteOptions = values.customer
    ? sites.filter((site) => site.customerId === values.customer)
    : sites;
  const select = (
    key: keyof DefectFilterValues,
    label: string,
    all: string,
    options: { value: string; label: string }[],
  ) => (
    <div className="min-w-0">
      <label htmlFor={`defect-filter-${key}`} className="sr-only">
        {label}
      </label>
      <NativeSelect
        id={`defect-filter-${key}`}
        value={values[key] ?? ""}
        onChange={(event) => apply(key, event.target.value)}
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
      aria-label={t("filters.label")}
      className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&>div]:sm:w-44"
    >
      {select("status", t("filters.status"), t("filters.unresolved"), [
        ...DEFECT_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) })),
        { value: "all", label: t("filters.allStatuses") },
      ])}
      {select(
        "severity",
        t("filters.severity"),
        t("filters.allSeverities"),
        [...DEFECT_SEVERITIES].reverse().map((severity) => ({
          value: severity,
          label: t(`severity.${severity}`),
        })),
      )}
      {select(
        "customer",
        t("filters.customer"),
        t("filters.allCustomers"),
        customers.map((customer) => ({ value: customer.id, label: customer.name })),
      )}
      {select(
        "site",
        t("filters.site"),
        t("filters.allSites"),
        siteOptions.map((site) => ({ value: site.id, label: site.name })),
      )}
      {select("assignee", t("filters.assignee"), t("filters.anyAssignee"), [
        { value: "me", label: t("filters.assignedToMe") },
        { value: "none", label: t("filters.unassigned") },
        ...members.map((member) => ({ value: member.id, label: member.name })),
      ])}
      {select("due", t("filters.due"), t("filters.anyDue"), [
        { value: "overdue", label: t("filters.dueOverdue") },
        { value: "set", label: t("filters.dueSet") },
      ])}
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:w-auto!">
        {Object.values(values).some(Boolean) && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <CrossIcon />
            {t("filters.clear")}
          </Button>
        )}
        {pending && <Spinner size={16} />}
      </div>
    </div>
  );
}
