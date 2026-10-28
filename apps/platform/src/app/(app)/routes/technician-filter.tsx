"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Whose routes the list shows (owners and admins); in the URL. */
export function TechnicianFilter({
  value,
  members,
  when,
}: {
  value: string;
  members: { id: string; name: string }[];
  when: "upcoming" | "past";
}) {
  const t = useTranslations("routes");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(technician: string) {
    const params = new URLSearchParams();
    if (when === "past") params.set("when", when);
    if (technician) params.set("technician", technician);
    const search = params.toString();
    startTransition(() => router.replace(search ? `/routes?${search}` : "/routes"));
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="routes-technician" className="sr-only">
        {t("filterTechnician")}
      </label>
      <NativeSelect
        id="routes-technician"
        value={value}
        onChange={(event) => apply(event.target.value)}
        className={cn("sm:w-56", value && "font-semibold text-link")}
      >
        <option value="">{t("allTechnicians")}</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </NativeSelect>
      {pending && <Spinner size={16} />}
    </div>
  );
}
