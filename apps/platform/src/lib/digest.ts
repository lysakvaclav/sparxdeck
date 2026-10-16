import { addDays, CALENDAR_FORMAT, calendarDate, type IsoDate } from "@/lib/due";
import { duePlan, type PlanDevice } from "@/lib/due-plan";

// The weekly summary for owners and admins: what is overdue or coming due
// within the company's "soon" period, building by building, and serious open
// defects. Pure, so the content can be tested; src/lib/digests.ts loads and sends.

/** Buildings listed in the e-mail; the rest are on the dashboard. */
export const DIGEST_SITES = 10;

/** Monday of the (ISO) week a calendar date falls in. */
export function weekStart(date: IsoDate): IsoDate {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}

export type DigestInput = {
  locale: "cs" | "en";
  organizationName: string;
  today: IsoDate;
  soonDays: number;
  /** Active devices due by today + soonDays (overdue ones included). */
  devices: PlanDevice[];
  /** Active devices without any inspection yet. */
  never: number;
  /** Open (unresolved) defects. */
  defects: { critical: number; major: number };
  appUrl: string;
};

export type Digest = {
  subject: string;
  heading: string;
  body: string;
  items: string[];
  cta: string;
  url: string;
  footnote: string;
  overdue: number;
  upcoming: number;
};

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The summary, or null when there is nothing to act on this week. */
export function buildDigest(input: DigestInput, t: Translate): Digest | null {
  const plan = duePlan(input.devices, input.today, input.soonDays);
  const serious = input.defects.critical + input.defects.major;
  if (plan.overdue + plan.upcoming === 0 && serious === 0) return null;

  const day = new Intl.DateTimeFormat(input.locale, CALENDAR_FORMAT);
  const date = (value: IsoDate) => day.format(calendarDate(value));
  const values = {
    organization: input.organizationName,
    overdue: plan.overdue,
    upcoming: plan.upcoming,
    days: input.soonDays,
    never: input.never,
    critical: input.defects.critical,
    major: input.defects.major,
    date: date(input.today),
  };
  const items = plan.rows.slice(0, DIGEST_SITES).map((row) =>
    t("site", {
      site: row.customerName ? `${row.siteName} (${row.customerName})` : row.siteName,
      overdue: row.overdue,
      upcoming: row.upcoming,
      date: date(row.earliest),
    }),
  );
  if (plan.rows.length > DIGEST_SITES)
    items.push(t("moreSites", { count: plan.rows.length - DIGEST_SITES }));

  const lines = [t("dueLine", values)];
  if (input.never > 0) lines.push(t("neverLine", values));
  if (serious > 0) lines.push(t("defectsLine", values));

  return {
    subject: t("subject", values),
    heading: t("heading", values),
    body: lines.join(" "),
    items,
    cta: t("cta"),
    url: `${input.appUrl.replace(/\/$/, "")}/`,
    footnote: t("footnote", values),
    overdue: plan.overdue,
    upcoming: plan.upcoming,
  };
}
