import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TickCircleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CreateSampleButton, DismissGuideButton, RemoveSampleButton } from "./guide-controls";

type Organization = Database["public"]["Tables"]["organizations"]["Row"];

const STEPS = ["company", "customer", "site", "device", "label"] as const;

/**
 * The first steps for a new company (owners and admins), from its details to
 * the first printed label, with sample data to try things on. It goes away when
 * every step is done or the guide is hidden; sample data keeps a reminder.
 */
export async function GettingStarted({ organization }: { organization: Organization }) {
  const t = await getTranslations("guide");
  const supabase = await createClient();
  const org = organization.id;

  // Real data only: the sample customer doesn't count as a first step.
  const [{ data: customer }, { data: site }, { data: device }, { data: sample }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id")
        .eq("organization_id", org)
        .is("deleted_at", null)
        .eq("is_sample", false)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sites")
        .select("id, customer:customers!inner(is_sample)")
        .eq("organization_id", org)
        .is("deleted_at", null)
        .eq("customer.is_sample", false)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("devices")
        .select("id, site:sites!inner(customer:customers!inner(is_sample))")
        .eq("organization_id", org)
        .is("deleted_at", null)
        .eq("site.customer.is_sample", false)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("customers")
        .select("id, name")
        .eq("organization_id", org)
        .eq("is_sample", true)
        .limit(1)
        .maybeSingle(),
    ]);

  const done: Record<(typeof STEPS)[number], boolean> = {
    company: Boolean(
      organization.legal_name ||
      organization.company_id ||
      organization.address ||
      organization.logo_path,
    ),
    customer: Boolean(customer),
    site: Boolean(site),
    device: Boolean(device),
    label: Boolean(organization.labels_printed_at),
  };
  const href: Record<(typeof STEPS)[number], string> = {
    company: "/settings#company",
    customer: "/customers/new",
    site: customer ? `/customers/${customer.id}/sites/new` : "/customers/new",
    device: site ? `/devices/new?site=${site.id}` : "/devices/new",
    label: site ? `/devices/labels?site=${site.id}` : "/devices/labels",
  };
  const finished = STEPS.filter((step) => done[step]).length;
  const next = STEPS.find((step) => !done[step]);
  const showGuide = !organization.guide_dismissed_at && next !== undefined;

  const sampleControls = sample ? (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-ui">
        {t("sampleActive", { name: sample.name })}{" "}
        <Link
          href={`/customers/${sample.id}`}
          className="text-link underline underline-offset-2 hover:no-underline"
        >
          {t("sampleOpen")}
        </Link>
      </p>
      <RemoveSampleButton />
    </div>
  ) : (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-ui font-semibold">{t("sampleTitle")}</p>
        <p className="text-ui text-muted-foreground">{t("sampleBody")}</p>
      </div>
      <div className="shrink-0">
        <CreateSampleButton />
      </div>
    </div>
  );

  if (!showGuide) {
    // Only a reminder that the sample data is still there.
    return sample ? (
      <Card className="mb-2.5 px-[15px] py-2.5 sm:mb-[15px]" data-testid="sample-reminder">
        {sampleControls}
      </Card>
    ) : null;
  }

  return (
    <Card className="mb-2.5 sm:mb-[15px]" data-testid="getting-started">
      <div className="flex min-h-10 flex-wrap items-center gap-x-2.5 gap-y-1 px-[15px] py-1.5 shadow-[0_1px_0_var(--border)]">
        <h2 className="text-ui font-semibold">{t("title")}</h2>
        <span className="text-ui-sm text-muted-foreground">
          {t("progress", { done: finished, total: STEPS.length })}
        </span>
        <div aria-hidden className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success"
            style={{ width: `${(finished / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="ms-auto">
          <DismissGuideButton />
        </div>
      </div>
      <ol className="divide-y">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={cn(
              "flex flex-col gap-2 px-[15px] py-2.5 sm:flex-row sm:items-center",
              step === next && "bg-accent/40",
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              {done[step] ? (
                <TickCircleIcon size={20} className="shrink-0 text-success-text" />
              ) : (
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-ui-xs font-semibold tabular-nums",
                    step === next ? "bg-primary text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
              )}
              <div className="min-w-0">
                <p className={cn("text-ui font-medium", done[step] && "text-muted-foreground")}>
                  {t(`steps.${step}.title`)}
                </p>
                {!done[step] && (
                  <p className="text-ui-sm text-muted-foreground">{t(`steps.${step}.body`)}</p>
                )}
              </div>
            </div>
            {done[step] ? (
              <span className="ps-[30px] text-ui-sm text-success-text sm:ps-0">{t("done")}</span>
            ) : (
              <div className="ms-[30px] flex flex-wrap gap-1.5 self-start sm:ms-0 sm:self-auto">
                {step === "customer" && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/import">{t("steps.customer.import")}</Link>
                  </Button>
                )}
                <Button asChild size="sm" variant={step === next ? "primary" : "outline"}>
                  <Link href={href[step]}>{t(`steps.${step}.action`)}</Link>
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="px-[15px] py-2.5 shadow-[inset_0_1px_0_var(--border)]">{sampleControls}</div>
    </Card>
  );
}
