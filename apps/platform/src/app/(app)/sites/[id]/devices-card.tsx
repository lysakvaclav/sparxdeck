import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AddIcon, DuplicateIcon, PrintIcon } from "@/components/icons";
import { DUE_BADGE, DueCell } from "@/components/app/device-badges";
import { EmptyState } from "@/components/app/empty-state";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
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
import { DUE_STATES, dueState, type DueState } from "@/lib/due";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

/** Rows shown on the building's page; the full list is one click away. */
const SHOWN = 100;

/**
 * The building's devices in the technician's route order (locations as on the
 * building, devices without a location last), with a due-date summary.
 */
export async function SiteDevicesCard({
  siteId,
  manager,
  today,
  soonDays,
}: {
  siteId: string;
  manager: boolean;
  today: string;
  soonDays: number;
}) {
  const t = await getTranslations("devices");
  const tLabels = await getTranslations("labels");
  const supabase = await createClient();
  const devices = await fetchAll((from, to) =>
    supabase
      .from("devices")
      .select(
        "id, label_number, serial_number, status, next_due_on, location:locations(id, name, sort_order), type:device_types(name)",
      )
      .eq("site_id", siteId)
      .is("deleted_at", null)
      .order("label_number")
      .range(from, to),
  );
  devices.sort(
    (a, b) =>
      (a.location?.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (b.location?.sort_order ?? Number.MAX_SAFE_INTEGER) || a.label_number - b.label_number,
  );

  const states = new Map<string, DueState>();
  const summary: Record<DueState, number> = { overdue: 0, soon: 0, ok: 0, never: 0 };
  for (const device of devices) {
    const state = dueState(device.next_due_on, today, soonDays);
    states.set(device.id, state);
    if (device.status === "active") summary[state]++;
  }
  const shown = devices.slice(0, SHOWN);
  const groups: { key: string; name: string | null; rows: typeof shown }[] = [];
  for (const device of shown) {
    const key = device.location?.id ?? "none";
    const group = groups.at(-1);
    if (group?.key === key) group.rows.push(device);
    else groups.push({ key, name: device.location?.name ?? null, rows: [device] });
  }
  const grouped = groups.some((group) => group.name);

  const actions = manager && (
    <>
      <Button asChild variant="outline" size="sm">
        <Link href={`/devices/bulk?site=${siteId}`}>
          <DuplicateIcon />
          {t("siteCard.bulk")}
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/devices/new?site=${siteId}`}>
          <AddIcon />
          {t("siteCard.add")}
        </Link>
      </Button>
    </>
  );
  const DeviceIcon = OBJECT_TYPES.device.icon;

  return (
    <Card>
      {/* Title and due summary first; on a phone the buttons wrap onto their own row. */}
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 shadow-[0_1px_0_var(--border)]">
        <CardTitle>
          {t("title")} <span className="font-normal text-muted-foreground">({devices.length})</span>
        </CardTitle>
        {DUE_STATES.filter((state) => state !== "ok" && summary[state] > 0).map((state) => (
          <Link key={state} href={`/devices?site=${siteId}&due=${state}`}>
            <Badge variant={DUE_BADGE[state]} className="hover:underline">
              {summary[state]} × {t(`due.${state}`)}
            </Badge>
          </Link>
        ))}
        {devices.length > 0 && (
          <div className="ms-auto flex flex-wrap justify-end gap-1.5">
            <Button asChild variant="outline" size="sm">
              <Link href={`/devices/labels?site=${siteId}`}>
                <PrintIcon />
                {tLabels("print")}
              </Link>
            </Button>
            {actions}
          </div>
        )}
      </div>
      {devices.length > 0 ? (
        <>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>{t("columns.label")}</TableHeaderCell>
                <TableHeaderCell className="hidden sm:table-cell">
                  {t("columns.type")}
                </TableHeaderCell>
                <TableHeaderCell className="hidden md:table-cell">
                  {t("columns.serial")}
                </TableHeaderCell>
                <TableHeaderCell className="text-end sm:text-start">
                  {t("columns.nextDue")}
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {groups.map((group) => (
                <GroupRows
                  key={group.key}
                  title={grouped ? (group.name ?? t("filters.noLocation")) : null}
                  count={group.rows.length}
                >
                  {group.rows.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="w-full max-w-0 sm:w-auto sm:max-w-none">
                        <span className="flex min-w-0 items-center gap-2">
                          <DeviceIcon className={OBJECT_TYPES.device.text} />
                          <span className="min-w-0">
                            <RowLink
                              href={`/devices/${device.id}`}
                              className="block font-mono tabular-nums"
                            >
                              {formatLabel(device.label_number)}
                            </RowLink>
                            <span className="block truncate text-ui-sm text-muted-foreground sm:hidden">
                              {device.type?.name}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell">
                        {device.type?.name}
                      </TableCell>
                      <TableCell className="hidden max-w-0 truncate font-mono text-ui-sm md:table-cell md:w-[30%]">
                        {device.serial_number ?? (
                          <span className="font-sans text-ui text-subtle">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-end sm:text-start">
                        <DueCell
                          status={device.status}
                          nextDue={device.next_due_on}
                          state={states.get(device.id)!}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </GroupRows>
              ))}
            </TableBody>
          </Table>
          {devices.length > SHOWN && (
            <div className="px-5 py-2 shadow-[inset_0_1px_0_var(--border)]">
              <Link
                href={`/devices?site=${siteId}`}
                className="touch-link text-ui text-link hover:underline"
              >
                {t("siteCard.showAll", { count: devices.length })}
              </Link>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={DeviceIcon}
          title={t("siteCard.empty")}
          description={manager ? t("siteCard.emptyHint") : undefined}
          action={actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
        />
      )}
    </Card>
  );
}

/** A location's rows under a band with its name (the route through the building). */
function GroupRows({
  title,
  count,
  children,
}: {
  title: string | null;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {title && (
        <tr>
          <th
            scope="colgroup"
            colSpan={4}
            className="h-9 bg-muted px-5 text-start text-ui-sm font-semibold text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]"
          >
            {title} <span className="font-normal">({count})</span>
          </th>
        </tr>
      )}
      {children}
    </>
  );
}
