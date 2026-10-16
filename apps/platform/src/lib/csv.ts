// CSV files for spreadsheets: UTF-8 with a byte-order mark (so Excel reads
// Czech characters), the separator Excel expects in the user's language, and
// no cell that a spreadsheet would run as a formula.

export type CsvValue = string | number | null | undefined;

/** Czech Excel splits columns on ";" (the comma is the decimal mark there). */
export function csvSeparator(locale: string): ";" | "," {
  return locale === "cs" ? ";" : ",";
}

/**
 * One cell. Text starting with = + - @ (or a tab/carriage return) would be
 * evaluated as a formula when opened, so it gets a leading apostrophe; numbers
 * stay numbers. Quotes are doubled and cells with separators or line breaks quoted.
 */
export function csvCell(value: CsvValue, separator: string): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return text.includes(separator) || /["\r\n]/.test(text) || text !== text.trim()
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

/** The whole file: a header row, then the rows, CRLF line ends, BOM first. */
export function toCsv(header: string[], rows: CsvValue[][], separator: string): string {
  const line = (cells: CsvValue[]) => cells.map((cell) => csvCell(cell, separator)).join(separator);
  return `\uFEFF${[line(header), ...rows.map(line)].join("\r\n")}\r\n`;
}

/** A file name safe on every system: "zarizeni-2026-10-13.csv". */
export function csvFileName(stem: string, date: string): string {
  const ascii = stem
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${ascii || "export"}-${date}.csv`;
}
