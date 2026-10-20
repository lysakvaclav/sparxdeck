import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireMembership } from "@/lib/auth";
import { renderProtocolSummaryPdf } from "@/lib/pdf/protocol-summary";
import type { Translate } from "@/lib/protocol";
import { buildProtocolSummary } from "@/lib/protocol-summary";
import { loadSummaryData, readSummaryFilters } from "@/lib/protocol-summary-data";

export const runtime = "nodejs";

/** The report across many inspections, as a PDF: never stored, built on request. */
export async function GET(request: NextRequest) {
  const { organization } = await requireMembership();
  const params = request.nextUrl.searchParams;
  const filters = readSummaryFilters((key) => params.get(key) ?? undefined, organization);

  const data = await loadSummaryData(filters);
  const t = (await getTranslations({
    locale: data.organization.locale,
    namespace: "protocol.summaryPdf",
  })) as unknown as Translate;
  const model = buildProtocolSummary(
    {
      locale: data.organization.locale,
      timeZone: data.organization.timezone,
      generatedAt: new Date().toISOString(),
      from: filters.from,
      to: filters.to,
      customerName: data.customerName,
      siteName: data.siteName,
      organization: data.organization,
      buildings: data.buildings,
    },
    t,
  );
  const pdf = await renderProtocolSummaryPdf(model);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${model.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
