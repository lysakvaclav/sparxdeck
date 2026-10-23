import { getFormatter, getTranslations } from "next-intl/server";
import { DownloadIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RowLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { protocolNumber } from "@/lib/protocol";
import { createClient } from "@/lib/supabase/server";

/** Inspections shown on a page, newest first. */
const SHOWN = 10;

type Scope = { site: string } | { customer: string };

/** The latest completed inspections of a building or customer, with their protocols. */
export async function ProtocolsCard({ scope }: { scope: Scope }) {
  const t = await getTranslations("protocol.list");
  const tInspections = await getTranslations("inspections");
  const format = await getFormatter();
  const supabase = await createClient();
  const query = supabase
    .from("inspections")
    .select(
      "id, completed_at, site:sites!inner(name, customer_id), inspection_items(outcome), protocol:protocols(year, number, number_format, pdf_path, active)",
      { count: "exact" },
    )
    .eq("status", "completed");
  const { data: inspections, count } = await (
    "site" in scope ? query.eq("site_id", scope.site) : query.eq("site.customer_id", scope.customer)
  )
    .order("completed_at", { ascending: false })
    .limit(SHOWN);
  const perCustomer = "customer" in scope;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("title")}{" "}
          {!!count && <span className="font-normal text-muted-foreground">({count})</span>}
        </CardTitle>
      </CardHeader>
      {inspections && inspections.length > 0 ? (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>{t("date")}</TableHeaderCell>
              <TableHeaderCell>{t("number")}</TableHeaderCell>
              {perCustomer && (
                <TableHeaderCell className="hidden md:table-cell">{t("site")}</TableHeaderCell>
              )}
              <TableHeaderCell className="hidden sm:table-cell">{t("results")}</TableHeaderCell>
              <TableHeaderCell className="w-px">
                <span className="sr-only">{t("download", { number: "" })}</span>
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {inspections.map((inspection) => {
              const failed = inspection.inspection_items.filter(
                (item) => item.outcome === "failed",
              ).length;
              const passed = inspection.inspection_items.filter(
                (item) => item.outcome === "passed",
              ).length;
              const protocol = inspection.protocol?.find((entry) => entry.active) ?? null;
              const number = protocol
                ? protocolNumber(protocol.year, protocol.number, protocol.number_format)
                : null;
              return (
                <TableRow key={inspection.id}>
                  <TableCell className="whitespace-nowrap">
                    <RowLink href={`/inspections/${inspection.id}`} className="tabular-nums">
                      {inspection.completed_at &&
                        format.dateTime(new Date(inspection.completed_at), { dateStyle: "medium" })}
                    </RowLink>
                  </TableCell>
                  <TableCell className="font-mono whitespace-nowrap tabular-nums">
                    {number ?? "—"}
                  </TableCell>
                  {perCustomer && (
                    <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell">
                      {inspection.site.name}
                    </TableCell>
                  )}
                  <TableCell className="hidden sm:table-cell">
                    <span className="inline-flex flex-wrap gap-1">
                      <Badge variant="success">
                        {passed} × {tInspections("outcome.passed")}
                      </Badge>
                      {failed > 0 && (
                        <Badge variant="danger">
                          {failed} × {tInspections("outcome.failed")}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="py-0 text-end">
                    {protocol?.pdf_path && number && (
                      <Button asChild variant="ghost" size="icon" className="relative z-[1]">
                        <a
                          href={`/inspections/${inspection.id}/protocol`}
                          aria-label={t("download", { number })}
                          title={t("download", { number })}
                        >
                          <DownloadIcon />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="px-5 py-2.5 text-muted-foreground">{t("empty")}</p>
      )}
    </Card>
  );
}
