"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ConfirmIcon,
  DownloadIcon,
  MediaIcon,
  PrintIcon,
  TickCircleIcon,
  UploadIcon,
  WarningSignIcon,
} from "@/components/icons";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import {
  ImportFileProblem,
  readSpreadsheet,
  type ImportFileError,
  type SpreadsheetSheet,
} from "@/lib/client/import-file";
import type { ErrorCode } from "@/lib/errors";
import {
  IMPORT_GROUPS,
  REQUIRED_FIELDS,
  buildRows,
  cellText,
  detectMapping,
  headerRowIndex,
  planImport,
  type ColumnMapping,
  type ImportField,
  type ImportRow,
} from "@/lib/import";
import { IMPORT_MAX_ROWS } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { importContext, runImport, type ImportContext, type ImportResult } from "./actions";

type Step = "file" | "columns" | "check" | "done";
const STEPS: Step[] = ["file", "columns", "check", "done"];
/** Rows listed in the check (all of them count). */
const SHOWN_ROWS = 300;

/** Spreadsheet column letters: 0 → A, 26 → AA. */
function columnLetter(index: number): string {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
}

function Steps({ step }: { step: Step }) {
  const t = useTranslations("import.steps");
  const current = STEPS.indexOf(step);
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-ui" aria-label={t(step)}>
      {STEPS.map((id, index) => (
        <li key={id} className="flex items-center gap-1">
          <span
            aria-current={index === current ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1",
              index === current && "bg-primary/10 font-semibold text-link",
              index < current && "text-muted-foreground",
              index > current && "text-subtle",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-ui-sm tabular-nums",
                index <= current
                  ? "bg-primary text-primary-foreground"
                  : "bg-[rgb(138_155_168/0.25)]",
              )}
            >
              {index < current ? "✓" : index + 1}
            </span>
            {t(id)}
          </span>
          {index < STEPS.length - 1 && <span className="text-subtle">›</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Import from Excel or CSV in four steps: the file, which column is what, a
 * check of every row with what will be created, and the result with the
 * buildings it touched. Nothing is written before "Import".
 */
export function ImportWizard() {
  const t = useTranslations("import");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [context, setContext] = useState<ImportContext | null>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<ImportFileError | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState<"all" | "errors" | "warnings">("all");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const table = useMemo(() => sheets[sheetIndex]?.rows ?? [], [sheets, sheetIndex]);
  const headers = (table[headerIndex] ?? []).map((cell) => cellText(cell));
  const columnCount = Math.max(
    headers.length,
    ...table.slice(headerIndex, headerIndex + 50).map((row) => row.length),
  );

  function selectSheet(next: SpreadsheetSheet[], index: number) {
    const rows = next[index]?.rows ?? [];
    const header = headerRowIndex(rows);
    setSheetIndex(index);
    setHeaderIndex(header);
    setMapping(detectMapping((rows[header] ?? []).map((cell) => cellText(cell))));
  }

  async function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setReading(true);
    setFileError(null);
    setError(null);
    try {
      const [read, loaded] = await Promise.all([
        readSpreadsheet(file),
        context ? Promise.resolve(null) : importContext(),
      ]);
      if (loaded && !loaded.ok) {
        setError(loaded.error);
        return;
      }
      if (loaded?.ok) setContext(loaded.data);
      // The first sheet with something in it.
      const first = Math.max(
        0,
        read.findIndex((sheet) => sheet.rows.some((row) => row.length)),
      );
      setFileName(file.name);
      setSheets(read);
      selectSheet(read, first);
      setStep("columns");
    } catch (failure) {
      setFileError(failure instanceof ImportFileProblem ? failure.code : "importUnreadable");
    } finally {
      setReading(false);
    }
  }

  const rows: ImportRow[] = useMemo(
    () => (context && step !== "file" ? buildRows(table, headerIndex, mapping, context.types) : []),
    [context, step, table, headerIndex, mapping],
  );
  const plan = useMemo(() => (context ? planImport(rows, context) : null), [rows, context]);
  const records = rows.flatMap((row) => row.inputs);
  const withErrors = rows.filter((row) => row.errors.length);
  const withWarnings = rows.filter((row) => row.warnings.length && !row.errors.length);
  const missing = REQUIRED_FIELDS.filter((field) => mapping[field] === undefined);
  const unused = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header, index }) => header && !Object.values(mapping).includes(index));

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await runImport({ fileName, records });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setResult(response.data);
      setStep("done");
      router.refresh();
    });
  }

  function restart() {
    setStep("file");
    setSheets([]);
    setResult(null);
    setError(null);
    setFileError(null);
    setContext(null);
  }

  // Example values of a column for the mapping step.
  const example = (column: number | undefined) => {
    if (column === undefined) return "";
    for (const row of table.slice(headerIndex + 1, headerIndex + 30)) {
      const text = cellText(row[column]);
      if (text) return text.length > 40 ? `${text.slice(0, 40)}…` : text;
    }
    return "";
  };
  const fieldLabel = (field: ImportField) => t(`fields.${field}`);
  const issueText = (issue: { field: ImportField; code: ErrorCode }, dropped: boolean) =>
    t(dropped ? "check.dropped" : "check.issue", {
      field: fieldLabel(issue.field),
      message: tErr(issue.code),
    });

  return (
    <div className="space-y-2.5 sm:space-y-[15px]">
      <Steps step={step} />

      {step === "file" && (
        <Card>
          <CardHeader
            actions={
              <Button asChild variant="outline" size="sm">
                <a href="/import/template" download>
                  <DownloadIcon />
                  {t("file.template")}
                </a>
              </Button>
            }
          >
            <CardTitle>{t("file.title")}</CardTitle>
          </CardHeader>
          <div className="space-y-[15px] p-[15px]">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                void onFile(event.dataTransfer.files[0]);
              }}
              className={cn(
                "flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-md bg-background p-4 text-center shadow-[inset_0_0_0_1px_var(--border)]",
                dragOver && "shadow-[inset_0_0_0_2px_var(--ring)]",
              )}
            >
              {reading ? (
                <Spinner label={t("file.reading")} size={28} />
              ) : (
                <UploadIcon size={20} className="text-subtle" />
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="sr-only"
                tabIndex={-1}
                aria-label={t("file.choose")}
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
              <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                <Button disabled={reading} onClick={() => inputRef.current?.click()}>
                  <MediaIcon />
                  {t("file.choose")}
                </Button>
                <span className="hidden text-ui text-muted-foreground sm:inline">
                  {t("file.drop")}
                </span>
              </div>
              <p className="max-w-xl text-ui-sm text-muted-foreground">{t("file.hint")}</p>
            </div>
            {fileError && <Alert variant="error">{t(`fileErrors.${fileError}`)}</Alert>}
            {error && <Alert variant="error">{tErr(error)}</Alert>}
            <ul className="list-disc space-y-1 ps-5 text-ui text-muted-foreground">
              <li>{t("file.tip1")}</li>
              <li>{t("file.tip2")}</li>
              <li>{t("file.tip3")}</li>
            </ul>
          </div>
        </Card>
      )}

      {step === "columns" && (
        <Card>
          <CardHeader>
            <CardTitle className="truncate">
              {t("columns.title")}{" "}
              <span className="font-normal text-muted-foreground">
                · {fileName} ·{" "}
                {t("file.rows", { count: Math.max(0, table.length - headerIndex - 1) })}
              </span>
            </CardTitle>
          </CardHeader>
          <div className="space-y-[15px] p-[15px]">
            <p className="text-ui text-muted-foreground">{t("columns.hint")}</p>
            {sheets.length > 1 && (
              <div className="max-w-xs space-y-[5px]">
                <label htmlFor="import-sheet" className="text-ui font-semibold">
                  {t("file.sheet")}
                </label>
                <NativeSelect
                  id="import-sheet"
                  value={sheetIndex}
                  onChange={(event) => selectSheet(sheets, Number(event.target.value))}
                >
                  {sheets.map((sheet, index) => (
                    <option key={sheet.name + index} value={index}>
                      {sheet.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
            <div className="grid grid-cols-1 gap-[15px] lg:grid-cols-3">
              {(["customer", "site", "device"] as const).map((group) => (
                <fieldset key={group} className="space-y-2.5">
                  <legend className="mb-1.5 text-ui font-semibold">
                    {t(`columns.groups.${group}`)}
                  </legend>
                  {IMPORT_GROUPS[group].map((field) => {
                    const column = mapping[field];
                    const sample = example(column);
                    return (
                      <div key={field} className="space-y-[3px]">
                        <label
                          htmlFor={`map-${field}`}
                          className="flex items-center gap-1.5 text-ui"
                        >
                          {fieldLabel(field)}
                          {REQUIRED_FIELDS.includes(field) && (
                            <Badge variant="primaryMinimal">{t("columns.required")}</Badge>
                          )}
                        </label>
                        <NativeSelect
                          id={`map-${field}`}
                          value={column ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setMapping((current) => {
                              const next = { ...current };
                              if (value === "") delete next[field];
                              else {
                                // A column holds one field: take it from where it was.
                                for (const [other, index] of Object.entries(next))
                                  if (index === Number(value)) delete next[other as ImportField];
                                next[field] = Number(value);
                              }
                              return next;
                            });
                          }}
                        >
                          <option value="">{t("columns.none")}</option>
                          {Array.from({ length: columnCount }, (_, index) => (
                            <option key={index} value={index}>
                              {columnLetter(index)}
                              {headers[index] ? `: ${headers[index]}` : ""}
                            </option>
                          ))}
                        </NativeSelect>
                        {sample && (
                          <p className="truncate text-ui-sm text-muted-foreground">
                            {t("columns.example", { value: sample })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </fieldset>
              ))}
            </div>
            {unused.length > 0 && (
              <p className="text-ui-sm text-muted-foreground">
                {t("columns.unused", {
                  columns: unused
                    .map(({ header, index }) => `${columnLetter(index)}: ${header}`)
                    .join(", "),
                })}
              </p>
            )}
            {!IMPORT_GROUPS.device.some((field) => mapping[field] !== undefined) && (
              <Alert variant="info">{t("columns.noDevice")}</Alert>
            )}
            {missing.length > 0 && (
              <Alert variant="warning">
                {missing
                  .map((field) => t("columns.missing", { field: fieldLabel(field) }))
                  .join(" ")}
              </Alert>
            )}
          </div>
          <CardFooter>
            <Button variant="outline" onClick={restart}>
              {t("columns.back")}
            </Button>
            <Button
              disabled={missing.length > 0}
              onClick={() => {
                setFilter(withErrors.length ? "errors" : "all");
                setStep("check");
              }}
            >
              {t("columns.next")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "check" && plan && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("check.title")}</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-2.5 p-[15px] md:grid-cols-4">
              {(
                [
                  ["customers", plan.customers.created, plan.customers.existing],
                  ["sites", plan.sites.created, plan.sites.existing],
                  ["locations", plan.locations, null],
                  ["devices", plan.devices, null],
                ] as const
              ).map(([id, created, existing]) => (
                <div key={id} className="rounded-md bg-muted p-2.5">
                  <p className="text-ui-sm text-muted-foreground">{t(`check.${id}`)}</p>
                  <p className="text-[24px] font-semibold tabular-nums">{created}</p>
                  {existing !== null && (
                    <p className="text-ui-sm text-muted-foreground">
                      {t("check.created", { count: created })} ·{" "}
                      {t("check.existing", { count: existing })}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-2 px-[15px] pb-[15px]">
              {rows.length > IMPORT_MAX_ROWS && (
                <Alert variant="error">{tErr("importTooLarge")}</Alert>
              )}
              {plan.skipped > 0 && (
                <Alert variant="info">{t("check.skipped", { count: plan.skipped })}</Alert>
              )}
              {withErrors.length > 0 && (
                <Alert variant="error" title={t("check.errors", { count: withErrors.length })}>
                  {t("check.errorsHint")}
                </Alert>
              )}
              {withWarnings.length > 0 && (
                <Alert variant="warning">
                  {t("check.warnings", { count: withWarnings.length })}
                </Alert>
              )}
              {rows.length === 0 && <Alert variant="neutral">{t("check.empty")}</Alert>}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 shadow-[inset_0_-1px_0_var(--border)]">
              <div role="tablist" className="flex rounded-md bg-muted p-0.5">
                {(
                  [
                    ["all", rows.length],
                    ["errors", withErrors.length],
                    ["warnings", withWarnings.length],
                  ] as const
                ).map(([id, count]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={filter === id}
                    onClick={() => setFilter(id)}
                    className={cn(
                      "min-h-[30px] rounded-[3px] px-3 text-ui whitespace-nowrap pointer-coarse:min-h-11",
                      filter === id
                        ? "bg-segment-active font-semibold text-segment-active-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {t(`check.tabs.${id}`)}{" "}
                    <span className="tabular-nums">{count}</span>
                  </button>
                ))}
              </div>
            </div>
            <CheckTable
              rows={filter === "errors" ? withErrors : filter === "warnings" ? withWarnings : rows}
              duplicates={plan.duplicates}
              typeNames={new Map((context?.types ?? []).map((type) => [type.id, type.name]))}
              issueText={issueText}
            />
            <CardFooter>
              {error && (
                <Alert variant="error" className="sm:me-auto">
                  {tErr(error)}
                </Alert>
              )}
              <Button variant="outline" disabled={pending} onClick={() => setStep("columns")}>
                {t("check.back")}
              </Button>
              <Button
                disabled={pending || records.length === 0 || rows.length > IMPORT_MAX_ROWS}
                onClick={submit}
              >
                <ConfirmIcon />
                {pending ? t("check.importing") : t("check.submit")}
              </Button>
            </CardFooter>
            {records.length === 0 && rows.length > 0 && (
              <p className="px-[15px] pb-[15px] text-end text-ui-sm text-muted-foreground">
                {t("check.nothing")}
              </p>
            )}
          </Card>
        </>
      )}

      {step === "done" && result && (
        <Card>
          <CardHeader>
            <CardTitle>{t("done.title")}</CardTitle>
          </CardHeader>
          <div className="space-y-[15px] p-[15px]">
            <Alert variant="success" icon={TickCircleIcon}>
              {t("done.summary", {
                customers: result.customers,
                sites: result.sites,
                locations: result.locations,
                devices: result.devices,
              })}
              {result.skipped > 0 && ` ${t("done.skipped", { count: result.skipped })}`}
            </Alert>
            {result.buildings.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-ui font-semibold">{t("done.buildings")}</h3>
                <ul className="divide-y divide-border rounded-md shadow-[inset_0_0_0_1px_var(--border)]">
                  {result.buildings.map((building) => (
                    <li
                      key={building.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 py-2"
                    >
                      <OBJECT_TYPES.site.icon className={OBJECT_TYPES.site.text} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{building.name}</span>
                        <span className="block truncate text-ui-sm text-muted-foreground">
                          {building.customerName} ·{" "}
                          {t("done.devicesCount", { count: building.devices })}
                        </span>
                      </span>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/sites/${building.id}`}>{t("done.open")}</Link>
                      </Button>
                      {building.devices > 0 && (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/devices/labels?site=${building.id}`}>
                            <PrintIcon />
                            {t("done.labels")}
                          </Link>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <CardFooter>
            <Button variant="outline" onClick={restart}>
              <UploadIcon />
              {t("done.another")}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

/** The checked rows: where each goes and what's wrong with it. */
function CheckTable({
  rows,
  duplicates,
  typeNames,
  issueText,
}: {
  rows: ImportRow[];
  duplicates: Map<number, number>;
  /** Names of the device types, by id (the row's type as it will be stored). */
  typeNames: Map<string, string>;
  issueText: (issue: { field: ImportField; code: ErrorCode }, dropped: boolean) => string;
}) {
  const t = useTranslations("import.check");
  if (rows.length === 0)
    return <p className="px-[15px] py-6 text-center text-ui text-muted-foreground">—</p>;
  return (
    <>
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell className="w-16">{t("table.line")}</TableHeaderCell>
            <TableHeaderCell>{t("table.customer")}</TableHeaderCell>
            <TableHeaderCell className="hidden md:table-cell">{t("table.site")}</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">{t("table.device")}</TableHeaderCell>
            <TableHeaderCell>{t("table.status")}</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.slice(0, SHOWN_ROWS).map((row) => {
            const skipped = duplicates.get(row.line) ?? 0;
            const stored = row.records[0]?.device;
            const device = [
              stored ? typeNames.get(stored.deviceTypeId) : row.values.deviceType,
              row.values.serialNumber,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <TableRow key={row.line}>
                <TableCell className="align-top font-mono text-muted-foreground tabular-nums">
                  {row.line}
                </TableCell>
                <TableCell className="max-w-0 align-top">
                  <span className="block truncate">{row.values.customerName ?? "—"}</span>
                  <span className="block truncate text-ui-sm text-muted-foreground md:hidden">
                    {[row.values.siteName, row.values.locationName].filter(Boolean).join(" · ")}
                  </span>
                </TableCell>
                <TableCell className="hidden max-w-0 align-top md:table-cell">
                  <span className="block truncate">{row.values.siteName ?? "—"}</span>
                  {row.values.locationName && (
                    <span className="block truncate text-ui-sm text-muted-foreground">
                      {row.values.locationName}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden max-w-0 align-top lg:table-cell">
                  <span className="block truncate">
                    {device || (row.records[0] && !row.records[0].device ? t("noDevice") : "—")}
                  </span>
                  {row.records.length > 1 && (
                    <span className="text-ui-sm text-muted-foreground">
                      {t("quantity", { count: row.records.length })}
                    </span>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {row.errors.length > 0 ? (
                    <ul className="space-y-0.5 text-ui-sm text-destructive-text">
                      {row.errors.map((issue) => (
                        <li key={issue.field} className="flex gap-1">
                          <WarningSignIcon className="mt-0.5 shrink-0" />
                          {issueText(issue, false)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="space-y-0.5">
                      <Badge variant={skipped ? "default" : "success"}>
                        {skipped ? t("duplicate") : t("ok")}
                      </Badge>
                      {row.warnings.map((issue) => (
                        <span key={issue.field} className="block text-ui-sm text-warning-text">
                          {issueText(issue, true)}
                        </span>
                      ))}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {rows.length > SHOWN_ROWS && (
        <p className="px-[15px] py-2 text-ui-sm text-muted-foreground">
          {t("more", { count: rows.length - SHOWN_ROWS })}
        </p>
      )}
    </>
  );
}
