import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import cs from "../messages/cs.json";
import en from "../messages/en.json";
import {
  buildDigest,
  DIGEST_SITES,
  weekStart,
  type DigestInput,
  type Translate,
} from "@/lib/digest";

const translate = (locale: "cs" | "en"): Translate =>
  createTranslator({
    locale,
    messages: locale === "cs" ? cs : en,
    namespace: "digest",
  }) as unknown as Translate;

const base: DigestInput = {
  locale: "cs",
  organizationName: "Revize Novák",
  today: "2026-10-12",
  soonDays: 30,
  devices: [],
  never: 0,
  defects: { critical: 0, major: 0 },
  appUrl: "https://app.sparxdeck.com/",
};

describe("the summary's week", () => {
  it("starts on Monday, across months and years", () => {
    expect(weekStart("2026-10-12")).toBe("2026-10-12"); // Monday
    expect(weekStart("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(weekStart("2026-10-14")).toBe("2026-10-12");
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
    expect(weekStart("2028-03-01")).toBe("2028-02-28");
  });
});

describe("weekly summary", () => {
  it("is not sent when nothing needs attention", () => {
    const quiet = buildDigest(
      {
        ...base,
        // Due later than the "soon" period, and only minor things otherwise.
        devices: [{ siteId: "a", siteName: "A", customerName: null, nextDueOn: "2026-11-12" }],
        never: 4,
      },
      translate("cs"),
    );
    expect(quiet).toBeNull();
  });

  it("lists overdue and coming due by building, with the counts", () => {
    const digest = buildDigest(
      {
        ...base,
        devices: [
          {
            siteId: "a",
            siteName: "Lipová 12",
            customerName: "BD Lipová",
            nextDueOn: "2026-10-01",
          },
          {
            siteId: "a",
            siteName: "Lipová 12",
            customerName: "BD Lipová",
            nextDueOn: "2026-10-20",
          },
          { siteId: "b", siteName: "Sklad", customerName: null, nextDueOn: "2026-11-11" },
          { siteId: "c", siteName: "Později", customerName: null, nextDueOn: "2026-11-12" },
        ],
        never: 2,
        defects: { critical: 1, major: 0 },
      },
      translate("cs"),
    )!;
    expect(digest).toMatchObject({
      subject: "Revize Novák: 1 po termínu, 2 do 30 dní",
      heading: "Termíny revizí k 12. 10. 2026",
      cta: "Otevřít přehled",
      url: "https://app.sparxdeck.com/",
      overdue: 1,
      upcoming: 2,
    });
    expect(digest.body).toBe(
      "Po termínu je 1 zařízení, v příštích 30 dnech propadá 2. 2 zařízení zatím nemá žádnou revizi. Otevřené závady: kritické 1, závažné 0.",
    );
    expect(digest.items).toEqual([
      "Lipová 12 (BD Lipová): po termínu 1, brzy 1, nejbližší termín 1. 10. 2026",
      "Sklad: po termínu 0, brzy 1, nejbližší termín 11. 11. 2026",
    ]);
  });

  it("is sent for serious open defects alone, and caps the building list", () => {
    expect(
      buildDigest({ ...base, defects: { critical: 0, major: 2 } }, translate("cs")),
    ).not.toBeNull();
    const many = buildDigest(
      {
        ...base,
        devices: Array.from({ length: DIGEST_SITES + 3 }, (_, i) => ({
          siteId: `s${i}`,
          siteName: `Budova ${String(i).padStart(2, "0")}`,
          customerName: null,
          nextDueOn: "2026-10-20",
        })),
      },
      translate("cs"),
    )!;
    expect(many.items).toHaveLength(DIGEST_SITES + 1);
    expect(many.items.at(-1)).toBe("a další 3 budovy");
  });

  it("speaks English for English companies", () => {
    const digest = buildDigest(
      {
        ...base,
        locale: "en",
        devices: [{ siteId: "a", siteName: "Depot", customerName: null, nextDueOn: "2026-10-05" }],
      },
      translate("en"),
    )!;
    expect(digest.subject).toBe("Revize Novák: 1 overdue, 0 due within 30 days");
    expect(digest.body).toBe("1 device is overdue and 0 more are due in the next 30 days.");
    expect(digest.items).toEqual(["Depot: 1 overdue, 0 due soon, earliest Oct 5, 2026"]);
  });
});
