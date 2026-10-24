"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Customer and technician filters of the calendar; both live in the URL. */
export function CalendarFilters({
  customer,
  technician,
  customers,
  members,
}: {
  customer?: string;
  technician?: string;
  customers: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const t = useTranslations("calendar.filters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(key: "customer" | "technician", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const search = params.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname));
  }

  return (
    <div role="group" aria-label={t("label")} className="flex flex-wrap items-center gap-2">
      <label htmlFor="calendar-customer" className="sr-only">
        {t("customer")}
      </label>
      <NativeSelect
        id="calendar-customer"
        value={customer ?? ""}
        onChange={(event) => apply("customer", event.target.value)}
        className={cn("sm:w-48", customer && "font-semibold text-link")}
      >
        <option value="">{t("allCustomers")}</option>
        {customers.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </NativeSelect>
      <label htmlFor="calendar-technician" className="sr-only">
        {t("technician")}
      </label>
      <NativeSelect
        id="calendar-technician"
        value={technician ?? ""}
        onChange={(event) => apply("technician", event.target.value)}
        className={cn("sm:w-48", technician && "font-semibold text-link")}
      >
        <option value="">{t("allTechnicians")}</option>
        <option value="none">{t("unassigned")}</option>
        {members.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </NativeSelect>
      {pending && <Spinner size={16} />}
    </div>
  );
}
