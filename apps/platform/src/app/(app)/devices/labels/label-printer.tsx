"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon, OfficeIcon, PrintIcon } from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import type { ErrorCode } from "@/lib/errors";
import {
  CUSTOM_FIELDS,
  LABELS_COOKIE,
  PAGE,
  PRESET_LAYOUTS,
  SHEET_PRESETS,
  labelContent,
  perSheet,
  placeLabels,
  sheetCount,
  customFields,
  withCopies,
  type CustomField,
  type LabelPrefs,
  type SheetLayout,
  type SheetPreset,
} from "@/lib/labels";
import { QR_QUIET_ZONE, qrMatrix, qrPath } from "@/lib/qr";
import { cn } from "@/lib/utils";
import { labelPrintSchema, sheetLayoutOf } from "@/lib/validation";

export type PrintDevice = {
  id: string;
  number: string;
  typeName: string;
  locationName: string | null;
  serialNumber: string | null;
  siteName: string;
  /** The URL inside the QR code. */
  url: string;
};

type SiteChoice = { id: string; name: string; customerId: string; customerName: string };

type CustomValues = Record<CustomField, string>;

export function LabelPrinter({
  sites,
  siteId,
  devices,
  preselected,
  organizationName,
  prefs,
}: {
  sites: SiteChoice[];
  siteId: string | null;
  devices: PrintDevice[];
  preselected: string[];
  organizationName: string;
  /** The format and copies used last time in this browser. */
  prefs: LabelPrefs;
}) {
  const t = useTranslations("labels");
  const tDevices = useTranslations("devices");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(preselected));
  const [preset, setPreset] = useState<SheetPreset | "custom">(prefs.preset);
  const [custom, setCustom] = useState<CustomValues>(prefs.custom);
  const [copies, setCopies] = useState(prefs.copies);
  const [startAt, setStartAt] = useState("1");
  const [page, setPage] = useState(0);

  // Remember the format for the next print (a cookie, so the page renders with it).
  useEffect(() => {
    const value = encodeURIComponent(JSON.stringify({ preset, custom, copies }));
    document.cookie = `${LABELS_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  }, [preset, custom, copies]);

  const chosen = devices.filter((device) => selected.has(device.id));
  const values = {
    deviceIds: chosen.map((device) => device.id),
    copies,
    startAt,
    preset,
    custom: preset === "custom" ? custom : undefined,
  };
  const parsed = labelPrintSchema.safeParse(values);
  const errors: Partial<Record<string, ErrorCode>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      errors[key] ??= issue.message as ErrorCode;
    }
  }
  const fieldError = (key: string) => (errors[key] ? tErr(errors[key]!) : undefined);

  // The preview keeps the last sheet that made sense while a custom size is being typed.
  const layout: SheetLayout | null = parsed.success
    ? sheetLayoutOf(parsed.data)
    : preset === "custom"
      ? null
      : PRESET_LAYOUTS[preset];
  const copyCount = parsed.success ? parsed.data.copies : Math.max(1, Number(copies) || 1);
  const start = parsed.success ? parsed.data.startAt : 1;
  const labels = withCopies(chosen, Math.min(copyCount, 10));
  const pages = layout ? Math.max(1, sheetCount(layout, labels.length, start)) : 1;
  const currentPage = Math.min(page, pages - 1);
  // Field errors sit under their fields; an empty selection is said next to the button.
  const globalError = errors.deviceIds;

  const allSelected = devices.length > 0 && selected.size === devices.length;
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const customers = [...new Map(sites.map((site) => [site.customerId, site.customerName]))];
  const DeviceIcon = OBJECT_TYPES.device.icon;

  return (
    <form
      method="post"
      action="/devices/labels/pdf"
      target="_blank"
      noValidate
      onSubmit={(event) => {
        if (!parsed.success) event.preventDefault();
      }}
      className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)] lg:items-start"
    >
      {chosen.map((device) => (
        <input key={device.id} type="hidden" name="deviceId" value={device.id} />
      ))}

      <div className="space-y-3 sm:space-y-5">
        <Card>
          <CardHeader
            actions={
              devices.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelected(allSelected ? new Set() : new Set(devices.map((d) => d.id)))
                  }
                >
                  {allSelected ? t("selectNone") : t("selectAll")}
                </Button>
              )
            }
          >
            <CardTitle>
              {t("devices")}{" "}
              {devices.length > 0 && (
                <span className="font-normal text-muted-foreground">
                  ({t("selected", { count: selected.size, total: devices.length })})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2.5">
            <Field id="label-site" label={t("site")}>
              <NativeSelect
                value={siteId ?? ""}
                onChange={(event) =>
                  router.push(
                    event.target.value
                      ? `/devices/labels?site=${event.target.value}`
                      : "/devices/labels",
                  )
                }
              >
                {!siteId && <option value="">{t("sitePlaceholder")}</option>}
                {customers.map(([customerId, customerName]) => (
                  <optgroup key={customerId} label={customerName}>
                    {sites
                      .filter((site) => site.customerId === customerId)
                      .map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </NativeSelect>
            </Field>
          </CardContent>
          {!siteId ? (
            <EmptyState
              icon={OfficeIcon}
              title={t("chooseSiteTitle")}
              description={t("chooseSiteBody")}
            />
          ) : devices.length === 0 ? (
            <EmptyState icon={DeviceIcon} title={t("noDevices")} />
          ) : (
            <>
              <Table>
                <TableHead>
                  <tr>
                    {/* Radix adds a hidden input next to a checkbox inside a form; keep it in the cell. */}
                    <TableHeaderCell className="relative w-10 overflow-hidden">
                      <Checkbox
                        aria-label={allSelected ? t("selectNone") : t("selectAll")}
                        checked={allSelected ? true : selected.size === 0 ? false : "indeterminate"}
                        onCheckedChange={() =>
                          setSelected(allSelected ? new Set() : new Set(devices.map((d) => d.id)))
                        }
                      />
                    </TableHeaderCell>
                    <TableHeaderCell>{tDevices("columns.label")}</TableHeaderCell>
                    <TableHeaderCell className="hidden sm:table-cell">
                      {tDevices("columns.type")}
                    </TableHeaderCell>
                    <TableHeaderCell>{tDevices("columns.location")}</TableHeaderCell>
                    <TableHeaderCell className="hidden md:table-cell">
                      {tDevices("columns.serial")}
                    </TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow
                      key={device.id}
                      className="cursor-pointer"
                      onClick={() => toggle(device.id)}
                    >
                      <TableCell
                        className="relative overflow-hidden"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          aria-label={t("selectDevice", { label: device.number })}
                          checked={selected.has(device.id)}
                          onCheckedChange={() => toggle(device.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">{device.number}</TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell">
                        {device.typeName}
                      </TableCell>
                      <TableCell className="max-w-0 truncate">
                        {device.locationName ?? <span className="text-subtle">—</span>}
                      </TableCell>
                      <TableCell className="hidden max-w-0 truncate font-mono text-ui-sm md:table-cell">
                        {device.serialNumber ?? (
                          <span className="font-sans text-ui text-subtle">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="px-5 py-2 text-ui-sm text-muted-foreground">
                {t("removedHidden")}
              </p>
            </>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sheet")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field id="label-format" label={t("format")}>
              <NativeSelect
                name="preset"
                value={preset}
                onChange={(event) => {
                  const next = event.target.value as SheetPreset | "custom";
                  // A custom sheet starts from the format that was chosen before.
                  if (next === "custom" && preset !== "custom")
                    setCustom(customFields(PRESET_LAYOUTS[preset]));
                  setPreset(next);
                  setPage(0);
                }}
              >
                {[...SHEET_PRESETS, "custom" as const].map((option) => (
                  <option key={option} value={option}>
                    {t(`presets.${option}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {preset === "custom" && (
              <div className="space-y-2.5 rounded-md bg-muted p-2.5">
                <p className="text-ui-sm text-muted-foreground">{t("customHint")}</p>
                <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 sm:grid-cols-4">
                  {CUSTOM_FIELDS.map((key) => {
                    const count = key === "columns" || key === "rows";
                    return (
                      <Field
                        key={key}
                        id={`label-${key}`}
                        label={t(key)}
                        error={fieldError(`custom.${key}`)}
                        suffix={count ? undefined : t("mm")}
                      >
                        <Input
                          name={key}
                          type="number"
                          inputMode="decimal"
                          step={count ? 1 : 0.1}
                          min={0}
                          value={custom[key]}
                          onChange={(event) =>
                            setCustom((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className="w-20"
                        />
                      </Field>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="label-copies" label={t("copies")} error={fieldError("copies")}>
                <Input
                  name="copies"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  value={copies}
                  onChange={(event) => setCopies(event.target.value)}
                  className="w-24"
                />
              </Field>
              <Field
                id="label-start"
                label={t("startAt")}
                hint={layout ? t("startAtHint", { max: perSheet(layout) }) : undefined}
                error={fieldError("startAt")}
              >
                <Input
                  name="startAt"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={layout ? perSheet(layout) : undefined}
                  value={startAt}
                  onChange={(event) => {
                    setStartAt(event.target.value);
                    setPage(0);
                  }}
                  className="w-24"
                />
              </Field>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-0">
        <CardHeader
          actions={
            pages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="iconSm"
                  aria-label={t("previousSheet")}
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeftIcon className="rtl:rotate-180" />
                </Button>
                <span className="text-ui-sm whitespace-nowrap text-muted-foreground tabular-nums">
                  {t("sheetOf", { page: currentPage + 1, pages })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconSm"
                  aria-label={t("nextSheet")}
                  disabled={currentPage >= pages - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRightIcon className="rtl:rotate-180" />
                </Button>
              </div>
            )
          }
        >
          <CardTitle>{t("preview")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-[#e3e8ef] p-3 dark:bg-[#121a26]">
            {layout ? (
              <SheetPreview
                layout={layout}
                labels={labels}
                startAt={start}
                page={currentPage}
                organizationName={organizationName}
              />
            ) : (
              <div
                className="mx-auto w-full max-w-[420px] bg-white"
                style={{ aspectRatio: `${PAGE.width} / ${PAGE.height}` }}
              />
            )}
          </div>
          <p className="text-ui text-muted-foreground" aria-live="polite">
            {t("summary", {
              labels: labels.length,
              sheets: layout ? sheetCount(layout, labels.length, start) : 0,
            })}
          </p>
          {globalError && siteId && <Alert variant="warning">{tErr(globalError)}</Alert>}
          <Button type="submit" className="hidden w-full lg:flex" disabled={!parsed.success}>
            <PrintIcon />
            {t("pdf")}
          </Button>
          <p className="text-ui-sm text-muted-foreground">{t("pdfHint")}</p>
        </CardContent>
      </Card>

      {/* Phones: the long device list would push the button far down; keep it at hand. */}
      <div className="sticky bottom-0 z-10 -mx-3 -mb-8 flex items-center gap-2.5 bg-background px-3 py-2.5 shadow-[0_-1px_0_var(--border)] sm:-mx-5 sm:-mb-5 sm:px-5 lg:hidden">
        <p className="min-w-0 flex-1 truncate text-ui text-muted-foreground">
          {t("summary", {
            labels: labels.length,
            sheets: layout ? sheetCount(layout, labels.length, start) : 0,
          })}
        </p>
        <Button type="submit" disabled={!parsed.success}>
          <PrintIcon />
          {t("pdf")}
        </Button>
      </div>
    </form>
  );
}

const pct = (part: number, whole: number) => `${(part / whole) * 100}%`;
/** Font size relative to the sheet's width (1 mm of paper = 100/210 cqw). */
const cq = (mm: number) => `${(mm * 100) / PAGE.width}cqw`;

/** One sheet as it will print, drawn to scale; skipped and empty positions dashed. */
function SheetPreview({
  layout,
  labels,
  startAt,
  page,
  organizationName,
}: {
  layout: SheetLayout;
  labels: PrintDevice[];
  startAt: number;
  page: number;
  organizationName: string;
}) {
  const content = labelContent(layout.labelWidth, layout.labelHeight);
  const placed = useMemo(
    () => placeLabels(layout, labels.length, startAt),
    [layout, labels.length, startAt],
  );
  const byCell = new Map<number, PrintDevice>();
  placed.forEach((position, index) => {
    if (position.page === page) byCell.set(position.cell, labels[index]!);
  });
  const qrs = useMemo(() => {
    const paths = new Map<string, { path: string; box: number }>();
    for (const label of labels) {
      if (paths.has(label.url)) continue;
      const matrix = qrMatrix(label.url);
      paths.set(label.url, { path: qrPath(matrix), box: matrix.size + QR_QUIET_ZONE * 2 });
    }
    return paths;
  }, [labels]);

  return (
    <div
      className="[container-type:inline-size] relative mx-auto w-full max-w-[420px] overflow-hidden bg-white text-black shadow-elevation-2"
      style={{ aspectRatio: `${PAGE.width} / ${PAGE.height}` }}
      data-testid="label-sheet"
    >
      {Array.from({ length: perSheet(layout) }, (_, cell) => {
        const column = cell % layout.columns;
        const row = Math.floor(cell / layout.columns);
        const x = layout.marginLeft + column * (layout.labelWidth + layout.gapX);
        const y = layout.marginTop + row * (layout.labelHeight + layout.gapY);
        const label = byCell.get(cell);
        const qr = label ? qrs.get(label.url) : undefined;
        // Positions already used on a partly used sheet are shaded; free ones stay blank.
        const used = page === 0 && cell < startAt - 1;
        return (
          <div
            key={cell}
            className={cn(
              "absolute",
              label
                ? "shadow-[inset_0_0_0_0.5px_#cdd5df]"
                : used
                  ? "shadow-[inset_0_0_0_0.5px_#cdd5df] [background:repeating-linear-gradient(135deg,#e8ecf1_0_3px,#f6f8fa_3px_6px)]"
                  : "shadow-[inset_0_0_0_0.5px_#e8ecf1]",
            )}
            style={{
              left: pct(x, PAGE.width),
              top: pct(y, PAGE.height),
              width: pct(layout.labelWidth, PAGE.width),
              height: pct(layout.labelHeight, PAGE.height),
            }}
          >
            {label && qr && (
              <>
                <svg
                  viewBox={`${-QR_QUIET_ZONE} ${-QR_QUIET_ZONE} ${qr.box} ${qr.box}`}
                  shapeRendering="crispEdges"
                  aria-hidden
                  className="absolute"
                  style={{
                    left: pct(content.qr.x, layout.labelWidth),
                    top: pct(content.qr.y, layout.labelHeight),
                    width: pct(content.qr.size, layout.labelWidth),
                    height: pct(content.qr.size, layout.labelHeight),
                  }}
                >
                  <path d={qr.path} fill="#000" />
                </svg>
                <div
                  className="absolute flex flex-col justify-between overflow-hidden"
                  style={{
                    left: pct(content.text.x, layout.labelWidth),
                    top: pct(content.text.y, layout.labelHeight),
                    width: pct(content.text.width, layout.labelWidth),
                    height: pct(content.text.height, layout.labelHeight),
                  }}
                >
                  <div className="min-w-0">
                    <p
                      className="truncate font-bold"
                      style={{ fontSize: cq(content.numberSize), lineHeight: 1.1 }}
                    >
                      {label.number}
                    </p>
                    <p
                      className="overflow-hidden break-words"
                      style={{
                        fontSize: cq(content.nameSize),
                        lineHeight: 1.2,
                        marginTop: cq(content.nameSize * 0.35),
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: content.nameLines,
                      }}
                    >
                      {label.siteName}
                    </p>
                  </div>
                  <p
                    className="truncate text-[#3a3a3a]"
                    style={{ fontSize: cq(content.footerSize), lineHeight: 1.2 }}
                  >
                    {organizationName}
                  </p>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
