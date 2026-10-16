"use server";

import { getTranslations } from "next-intl/server";
import { getActiveMembership } from "@/lib/auth";
import { defectNumber } from "@/lib/defects";
import { deviceName, formatLabel } from "@/lib/devices";
import { HITS_PER_KIND, searchTerms, type SearchHit } from "@/lib/global-search";
import { protocolNumber } from "@/lib/protocol";
import { ilikeAny } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

const joined = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;
const short = (text: string, length = 80) =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text;

/**
 * The omnibar: customers, buildings, devices (also by label number), defects
 * (by "Z-12") and protocols (by "2026-0001") of the user's company, a few of
 * each kind. RLS keeps it to the company; inputs only go through ilikeAny.
 */
export async function globalSearch(input: string): Promise<SearchHit[]> {
  const active = await getActiveMembership();
  if (!active || typeof input !== "string") return [];
  const terms = searchTerms(input);
  if (!terms.text && !terms.label && !terms.defect && !terms.protocol) return [];
  const t = await getTranslations("search");
  const tDefects = await getTranslations("defects");
  const supabase = await createClient();
  const org = active.organization.id;
  const empty = Promise.resolve({ data: [] as never[] });

  const customerSearch = terms.text
    ? ilikeAny(["name", "company_id", "email", "contact_person"], terms.text)
    : null;
  const siteSearch = terms.text ? ilikeAny(["name", "address"], terms.text) : null;
  const deviceSearch = [
    terms.label ? `label_number.eq.${terms.label}` : null,
    terms.text ? ilikeAny(["serial_number"], terms.text) : null,
  ]
    .filter(Boolean)
    .join(",");
  const defectSearch = [
    terms.defect ? `number.eq.${terms.defect}` : null,
    terms.text && terms.text.length >= 3 ? ilikeAny(["description"], terms.text) : null,
  ]
    .filter(Boolean)
    .join(",");

  const [customers, sites, devices, defects, protocols] = await Promise.all([
    customerSearch
      ? supabase
          .from("customers")
          .select("id, name, company_id, contact_person")
          .eq("organization_id", org)
          .is("deleted_at", null)
          .or(customerSearch)
          .order("name")
          .limit(HITS_PER_KIND)
      : empty,
    siteSearch
      ? supabase
          .from("sites")
          .select("id, name, address, customer:customers(name)")
          .eq("organization_id", org)
          .is("deleted_at", null)
          .or(siteSearch)
          .order("name")
          .limit(HITS_PER_KIND)
      : empty,
    deviceSearch
      ? supabase
          .from("devices")
          .select("id, label_number, serial_number, type:device_types(name), site:sites(name)")
          .eq("organization_id", org)
          .is("deleted_at", null)
          .or(deviceSearch)
          .order("label_number")
          .limit(HITS_PER_KIND)
      : empty,
    defectSearch
      ? supabase
          .from("defects")
          .select("id, number, description, status, device:devices(label_number, site:sites(name))")
          .eq("organization_id", org)
          .or(defectSearch)
          .order("number", { ascending: false })
          .limit(HITS_PER_KIND)
      : empty,
    terms.protocol
      ? supabase
          .from("protocols")
          .select("id, year, number, inspection:inspections(id, site:sites(name))")
          .eq("organization_id", org)
          .eq("year", terms.protocol.year)
          .eq("number", terms.protocol.number)
          .limit(HITS_PER_KIND)
      : empty,
  ]);

  return [
    ...(customers.data ?? []).map((customer): SearchHit => ({
      kind: "customer",
      id: customer.id,
      title: customer.name,
      subtitle: joined([customer.contact_person, customer.company_id]),
      href: `/customers/${customer.id}`,
    })),
    ...(sites.data ?? []).map((site): SearchHit => ({
      kind: "site",
      id: site.id,
      title: site.name,
      subtitle: joined([site.customer?.name, site.address?.split(/\r?\n/).join(", ")]),
      href: `/sites/${site.id}`,
    })),
    ...(devices.data ?? []).map((device): SearchHit => ({
      kind: "device",
      id: device.id,
      title: deviceName(device.type?.name ?? "", device.label_number),
      subtitle: joined([device.site?.name, device.serial_number]),
      href: `/devices/${device.id}`,
    })),
    ...(defects.data ?? []).map((defect): SearchHit => ({
      kind: "defect",
      id: defect.id,
      title: `${tDefects("number", { number: defectNumber(defect.number) })} ${short(defect.description)}`,
      subtitle: joined([
        defect.device && formatLabel(defect.device.label_number),
        defect.device?.site?.name,
        tDefects(`status.${defect.status}`),
      ]),
      href: `/defects/${defect.id}`,
    })),
    ...(protocols.data ?? []).flatMap((protocol): SearchHit[] =>
      protocol.inspection
        ? [
            {
              kind: "protocol",
              id: protocol.id,
              title: t("protocol", { number: protocolNumber(protocol.year, protocol.number) }),
              subtitle: protocol.inspection.site?.name ?? null,
              href: `/inspections/${protocol.inspection.id}`,
            },
          ]
        : [],
    ),
  ];
}
