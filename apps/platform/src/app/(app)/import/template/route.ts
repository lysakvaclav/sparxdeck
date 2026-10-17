import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { getActiveMembership } from "@/lib/auth";
import { csvSeparator, toCsv } from "@/lib/csv";
import { IMPORT_FIELDS } from "@/lib/import";

export const runtime = "nodejs";

/**
 * A CSV template for the import: every column the import recognizes, named in
 * the user's language, with two example rows. Opens in Excel as is.
 */
export async function GET() {
  if (!(await getActiveMembership())) return new NextResponse(null, { status: 404 });
  const locale = await getLocale();
  const t = await getTranslations("import");
  const header = IMPORT_FIELDS.map((field) => t(`fields.${field}`));
  const rows = t.raw("template.rows") as string[][];
  const csv = toCsv(header, rows, csvSeparator(locale));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${t("template.file")}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
