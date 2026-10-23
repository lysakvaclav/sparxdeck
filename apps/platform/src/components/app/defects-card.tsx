import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AddIcon } from "@/components/icons";
import { DefectRef, SeverityBadge } from "@/components/app/defect-badges";
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
import { formatLabel } from "@/lib/devices";
import { createClient } from "@/lib/supabase/server";

/** Unresolved defects shown on a page; the rest are in the filtered list. */
const SHOWN = 10;

type Scope = { device: string } | { site: string } | { customer: string };

/**
 * The unresolved defects of a device, building or customer, worst first,
 * with a link to the full list (resolved ones included).
 */
export async function DefectsCard({ scope, label }: { scope: Scope; label?: number }) {
  const t = await getTranslations("defects");
  const supabase = await createClient();
  const select =
    "id, number, description, severity, status, device:devices!inner(id, label_number, site_id, type:device_types(name), site:sites!inner(customer_id))";
  const scoped = (head: boolean) => {
    const query = supabase.from("defects").select(select, { count: "exact", head });
    return "device" in scope
      ? query.eq("device_id", scope.device)
      : "site" in scope
        ? query.eq("device.site_id", scope.site)
        : query.eq("device.site.customer_id", scope.customer);
  };

  const [open, all] = await Promise.all([
    scoped(false)
      .neq("status", "resolved")
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(SHOWN),
    scoped(true),
  ]);
  const defects = open.data ?? [];
  const openCount = open.count ?? 0;
  const total = all.count ?? 0;
  const perDevice = "device" in scope;

  const listHref =
    "device" in scope
      ? `/defects?status=all&q=${label === undefined ? "" : formatLabel(label)}`
      : "site" in scope
        ? `/defects?status=all&site=${scope.site}`
        : `/defects?status=all&customer=${scope.customer}`;

  return (
    <Card>
      <CardHeader
        actions={
          perDevice && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/defects/new?device=${scope.device}`}>
                <AddIcon />
                {t("new")}
              </Link>
            </Button>
          )
        }
      >
        <CardTitle>
          {t("card.title")}{" "}
          {openCount > 0 && (
            <span className="font-normal text-muted-foreground">
              ({t("card.open", { count: openCount })})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      {defects.length > 0 ? (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell className="w-24">{t("columns.number")}</TableHeaderCell>
              <TableHeaderCell className={perDevice ? undefined : "md:w-[50%]"}>
                {t("columns.description")}
              </TableHeaderCell>
              {!perDevice && (
                <TableHeaderCell className="hidden md:table-cell">
                  {t("columns.device")}
                </TableHeaderCell>
              )}
              <TableHeaderCell className="hidden sm:table-cell">
                {t("columns.severity")}
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {defects.map((defect) => (
              <TableRow key={defect.id}>
                <TableCell className="whitespace-nowrap">
                  <RowLink href={`/defects/${defect.id}`}>
                    <DefectRef number={defect.number} />
                  </RowLink>
                </TableCell>
                <TableCell className="max-w-0">
                  <span className="line-clamp-2 break-words">{defect.description}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                    <SeverityBadge severity={defect.severity} />
                    {!perDevice && (
                      <span className="text-ui-sm text-muted-foreground">
                        {formatLabel(defect.device.label_number)} {defect.device.type?.name}
                      </span>
                    )}
                  </span>
                </TableCell>
                {!perDevice && (
                  <TableCell className="hidden whitespace-nowrap md:table-cell">
                    <span className="font-mono tabular-nums">
                      {formatLabel(defect.device.label_number)}
                    </span>{" "}
                    <span className="text-muted-foreground">{defect.device.type?.name}</span>
                  </TableCell>
                )}
                <TableCell className="hidden whitespace-nowrap sm:table-cell">
                  <SeverityBadge severity={defect.severity} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="px-5 py-2.5 text-muted-foreground">
          {total > 0 ? t("card.noneOpen") : t("card.none")}
        </p>
      )}
      {total > 0 && (
        <div className="px-5 py-2 shadow-[inset_0_1px_0_var(--border)]">
          <Link href={listHref} className="touch-link text-ui text-link hover:underline">
            {t("card.showAll", { count: total })}
          </Link>
        </div>
      )}
    </Card>
  );
}
