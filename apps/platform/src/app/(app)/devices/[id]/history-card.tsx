import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
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
import { memberNames } from "@/lib/inspection-data";
import type { CheckOutcome } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/** Checks shown on the device's page, newest first. */
const SHOWN = 10;

const OUTCOME_BADGE: Record<CheckOutcome, "success" | "danger" | "default"> = {
  passed: "success",
  failed: "danger",
  not_checked: "default",
};

/** The device's checks in finished inspections: when, the result and who checked it. */
export async function DeviceHistoryCard({
  deviceId,
  organizationId,
}: {
  deviceId: string;
  organizationId: string;
}) {
  const t = await getTranslations("devices.history");
  const tInspections = await getTranslations("inspections");
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data: checks, count }, names] = await Promise.all([
    supabase
      .from("inspection_items")
      .select(
        "id, outcome, checked_by, checked_at, inspection:inspections!inner(id, status, started_at, completed_at)",
        { count: "exact" },
      )
      .eq("device_id", deviceId)
      .eq("inspection.status", "completed")
      .not("outcome", "is", null)
      .order("created_at", { ascending: false })
      .limit(SHOWN),
    memberNames(organizationId),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("title")}{" "}
          {!!count && <span className="font-normal text-muted-foreground">({count})</span>}
        </CardTitle>
      </CardHeader>
      {checks && checks.length > 0 ? (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>{t("date")}</TableHeaderCell>
              <TableHeaderCell>{t("result")}</TableHeaderCell>
              <TableHeaderCell className="hidden sm:table-cell">{t("checkedBy")}</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {checks.map((check) => (
              <TableRow key={check.id}>
                <TableCell className="whitespace-nowrap">
                  <RowLink
                    href={`/inspections/${check.inspection.id}/check/${deviceId}`}
                    className="tabular-nums"
                  >
                    {format.dateTime(
                      new Date(
                        check.checked_at ??
                          check.inspection.completed_at ??
                          check.inspection.started_at,
                      ),
                      { dateStyle: "medium" },
                    )}
                  </RowLink>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {check.outcome && (
                    <Badge variant={OUTCOME_BADGE[check.outcome]}>
                      {tInspections(`outcome.${check.outcome}`)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden max-w-0 truncate text-muted-foreground sm:table-cell">
                  {(check.checked_by && names.get(check.checked_by)) || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="px-[15px] py-2.5 text-muted-foreground">{t("empty")}</p>
      )}
    </Card>
  );
}
