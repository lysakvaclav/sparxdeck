"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { DueCell, StatusBadge } from "@/components/app/device-badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import {
  RowLink,
  SortableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { DueState } from "@/lib/due";
import type { DeviceStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { bulkUpdateDevices } from "./actions";
import type { DeviceSort } from "@/lib/device-list";

export type DeviceRow = {
  id: string;
  label: string;
  typeName: string | null;
  siteId: string;
  siteName: string;
  customerName: string | null;
  locationName: string | null;
  serialNumber: string | null;
  status: DeviceStatus;
  nextDue: string | null;
  dueState: DueState;
};

const STATUSES: readonly DeviceStatus[] = ["active", "out_of_service", "removed"];

/**
 * The device table with checkboxes: selecting rows (on this page only) offers
 * changing their status, and their location too when the list is already
 * filtered to one building (a location belongs to one building; mixing sites
 * would just fail, so the form doesn't offer it then).
 */
export function DeviceListTable({
  devices,
  listParams,
  sort,
  siteLocations,
  manager,
}: {
  devices: DeviceRow[];
  /** The list's search, filters and page (not a function: server components can't pass those). */
  listParams: Record<string, string | undefined>;
  sort: DeviceSort;
  /** This building's locations, only when the list is filtered to one. */
  siteLocations: { id: string; name: string }[] | null;
  /** Read-only members don't get checkboxes (bulk editing needs requireManager()). */
  manager: boolean;
}) {
  const t = useTranslations("devices");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState<DeviceStatus | "">("");
  const [pending, startTransition] = useTransition();
  const DeviceIcon = OBJECT_TYPES.device.icon;

  const sortHref = (value: DeviceSort) => {
    const search = new URLSearchParams();
    for (const [key, entry] of Object.entries({
      ...listParams,
      sort: value === "label" ? undefined : value,
    }))
      if (entry) search.set(key, entry);
    const target = search.toString();
    return target ? `/devices?${target}` : "/devices";
  };

  const allSelected = devices.length > 0 && selected.size === devices.length;
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((current) =>
      current.size === devices.length ? new Set() : new Set(devices.map((device) => device.id)),
    );
  const clear = () => {
    setSelected(new Set());
    setLocationId("");
    setStatus("");
  };

  function apply() {
    startTransition(async () => {
      const result = await bulkUpdateDevices({
        deviceIds: [...selected],
        ...(locationId !== "" && { locationId: locationId === "none" ? null : locationId }),
        ...(status !== "" && { status }),
      });
      if (!result.ok) {
        toast(tErr(result.error), "danger");
        return;
      }
      toast(t("bulkEdit.done", { count: result.data.count }), "success");
      clear();
      router.refresh();
    });
  }

  return (
    <>
      {manager && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 bg-selected px-2.5 py-2 shadow-[inset_0_-1px_0_var(--border)]">
          <p className="text-ui-sm font-medium whitespace-nowrap">
            {t("bulkEdit.selected", { count: selected.size })}
          </p>
          {siteLocations && (
            <NativeSelect
              aria-label={t("form.location")}
              className="w-auto"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">{t("bulkEdit.keepLocation")}</option>
              <option value="none">{t("form.noLocation")}</option>
              {siteLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </NativeSelect>
          )}
          <NativeSelect
            aria-label={t("form.status")}
            className="w-auto"
            value={status}
            onChange={(event) => setStatus(event.target.value as DeviceStatus | "")}
          >
            <option value="">{t("bulkEdit.keepStatus")}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            onClick={apply}
            disabled={pending || (locationId === "" && status === "")}
          >
            {t("bulkEdit.apply")}
          </Button>
          <Button size="sm" variant="outline" onClick={clear} disabled={pending}>
            {t("bulkEdit.clear")}
          </Button>
        </div>
      )}
      <Table>
        <TableHead>
          <tr>
            {manager && (
              <TableHeaderCell className="w-11">
                <Checkbox
                  checked={allSelected ? true : selected.size === 0 ? false : "indeterminate"}
                  onCheckedChange={toggleAll}
                  aria-label={t("bulkEdit.selectAll")}
                />
              </TableHeaderCell>
            )}
            <SortableHeader href={sortHref("label")} active={sort === "label"} direction="asc">
              {t("columns.label")}
            </SortableHeader>
            <TableHeaderCell className="hidden md:table-cell">{t("columns.type")}</TableHeaderCell>
            <TableHeaderCell className="hidden sm:table-cell">{t("columns.site")}</TableHeaderCell>
            <TableHeaderCell className="hidden xl:table-cell">
              {t("filters.customer")}
            </TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">
              {t("columns.location")}
            </TableHeaderCell>
            <TableHeaderCell className="hidden xl:table-cell">
              {t("columns.serial")}
            </TableHeaderCell>
            <SortableHeader
              href={sortHref("due")}
              active={sort === "due"}
              direction="asc"
              className="text-end sm:text-start"
            >
              {t("columns.nextDue")}
            </SortableHeader>
          </tr>
        </TableHead>
        <TableBody>
          {devices.map((device) => {
            const place = [device.siteName, device.locationName].filter(Boolean).join(" · ");
            return (
              <TableRow key={device.id} className={cn(selected.has(device.id) && "bg-selected")}>
                {manager && (
                  <TableCell>
                    <Checkbox
                      checked={selected.has(device.id)}
                      onCheckedChange={() => toggle(device.id)}
                      aria-label={t("bulkEdit.selectOne", { label: device.label })}
                    />
                  </TableCell>
                )}
                <TableCell className="w-full max-w-0 sm:w-auto sm:max-w-none">
                  <span className="flex min-w-0 items-center gap-2">
                    <DeviceIcon className={OBJECT_TYPES.device.text} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <RowLink href={`/devices/${device.id}`} className="font-mono tabular-nums">
                          {device.label}
                        </RowLink>
                        <StatusBadge status={device.status} />
                      </span>
                      <span className="block truncate text-ui-sm text-muted-foreground sm:hidden">
                        {device.typeName} · {place}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap md:table-cell">
                  {device.typeName}
                </TableCell>
                <TableCell className="hidden max-w-0 sm:table-cell sm:w-[22%]">
                  <Link
                    href={`/sites/${device.siteId}`}
                    className="relative z-[1] block truncate hover:underline"
                  >
                    {device.siteName}
                  </Link>
                </TableCell>
                <TableCell className="hidden max-w-0 truncate text-muted-foreground xl:table-cell xl:w-[18%]">
                  {device.customerName}
                </TableCell>
                <TableCell className="hidden max-w-0 truncate lg:table-cell">
                  {device.locationName ?? <span className="text-subtle">—</span>}
                </TableCell>
                <TableCell className="hidden max-w-0 truncate font-mono text-ui-sm xl:table-cell">
                  {device.serialNumber ?? <span className="font-sans text-ui text-subtle">—</span>}
                </TableCell>
                <TableCell className="text-end sm:text-start">
                  <DueCell
                    status={device.status}
                    nextDue={device.nextDue}
                    state={device.dueState}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
