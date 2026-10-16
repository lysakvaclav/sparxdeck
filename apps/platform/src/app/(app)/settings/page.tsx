import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ClipboardIcon } from "@/components/icons";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isManager, requireMembership } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";
import { DigestPreview } from "./digest-preview";
import {
  CompanyForm,
  DeadlinesForm,
  DigestForm,
  LogoForm,
  ProtocolForm,
  RegionalForm,
} from "./settings-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

// Time zones of the markets SparxDeck serves, listed first for convenience.
const COMMON_TIMEZONES = [
  "Europe/Prague",
  "Europe/Bratislava",
  "Europe/Warsaw",
  "Europe/Vienna",
  "Europe/Berlin",
  "Europe/London",
  "Asia/Yerevan",
  "Asia/Tbilisi",
  "Asia/Dubai",
  "Asia/Riyadh",
];

// "Europe/Prague (GMT+2)": the IANA name plus today's offset, so the choice is unambiguous.
function timezoneOption(zone: string) {
  const offset =
    new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  return { value: zone, label: `${zone.replaceAll("_", " ")} (${offset})` };
}

function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function SettingsPage() {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("settings");
  const disabled = !isManager(membership.role);
  const logoUrl = await signedUrl(organization.logo_path);
  const allTimezones = Intl.supportedValuesOf("timeZone");
  const timezones = {
    common: COMMON_TIMEZONES.filter((zone) => allTimezones.includes(zone)).map(timezoneOption),
    all: allTimezones.map(timezoneOption),
  };

  const sections = [
    { id: "company", label: t("company.title") },
    { id: "logo", label: t("logo.title") },
    { id: "protocol", label: t("protocol.title") },
    { id: "regional", label: t("regional.title") },
    { id: "deadlines", label: t("deadlines.title") },
    { id: "digest", label: t("digest.title") },
    { id: "device-types", label: t("deviceTypes.title") },
  ];

  return (
    <>
      <PageHeader
        icon={appIcon("settings").icon}
        iconClassName={appIcon("settings").tone}
        title={t("title")}
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,48rem)] lg:items-start">
          <nav aria-label={t("sections")} className="hidden lg:sticky lg:top-0 lg:block">
            <ul className="rounded-lg bg-card p-[5px] shadow-elevation-0">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex min-h-[30px] items-center rounded-sm px-[7px] text-ui transition-colors hover:bg-accent"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {disabled && <Alert>{t("readOnly")}</Alert>}
            <SettingsCard
              id="company"
              title={t("company.title")}
              description={t("company.description")}
            >
              <CompanyForm
                disabled={disabled}
                defaults={{
                  name: organization.name,
                  legalName: organization.legal_name ?? "",
                  companyId: organization.company_id ?? "",
                  vatId: organization.vat_id ?? "",
                  address: organization.address ?? "",
                  email: organization.email ?? "",
                  phone: organization.phone ?? "",
                }}
              />
            </SettingsCard>
            <SettingsCard id="logo" title={t("logo.title")} description={t("logo.description")}>
              <LogoForm
                disabled={disabled}
                logoUrl={logoUrl}
                organizationName={organization.name}
              />
            </SettingsCard>
            <SettingsCard
              id="protocol"
              title={t("protocol.title")}
              description={t("protocol.description")}
            >
              <ProtocolForm
                disabled={disabled}
                defaults={{ footer: organization.protocol_footer_text ?? "" }}
              />
            </SettingsCard>
            <SettingsCard
              id="regional"
              title={t("regional.title")}
              description={t("regional.description")}
            >
              <RegionalForm
                disabled={disabled}
                timezones={timezones}
                defaults={{
                  defaultLocale: organization.default_locale === "en" ? "en" : "cs",
                  timezone: organization.timezone,
                }}
              />
            </SettingsCard>
            <SettingsCard
              id="deadlines"
              title={t("deadlines.title")}
              description={t("deadlines.description")}
            >
              <DeadlinesForm
                disabled={disabled}
                defaults={{ dueSoonDays: organization.due_soon_days }}
              />
            </SettingsCard>
            <SettingsCard
              id="digest"
              title={t("digest.title")}
              description={t("digest.description")}
            >
              <DigestForm
                disabled={disabled}
                defaults={{ weeklyDigest: organization.weekly_digest }}
              />
              <DigestPreview organization={organization} />
            </SettingsCard>
            <SettingsCard
              id="device-types"
              title={t("deviceTypes.title")}
              description={t("deviceTypes.description")}
            >
              <Button asChild variant="outline">
                <Link href="/device-types">
                  <ClipboardIcon />
                  {t("deviceTypes.open")}
                </Link>
              </Button>
            </SettingsCard>
          </div>
        </div>
      </PageBody>
    </>
  );
}
