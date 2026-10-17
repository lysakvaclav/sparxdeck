"use client";

import { decodeText, parseCsv } from "@/lib/import";

// Reading the chosen spreadsheet in the browser: Excel (.xlsx) through
// read-excel-file (loaded only when needed), CSV with our own reader.

export type SpreadsheetSheet = { name: string; rows: unknown[][] };

export type ImportFileError =
  "fileTooLarge" | "importFileType" | "importOldExcel" | "importUnreadable";

export class ImportFileProblem extends Error {
  constructor(readonly code: ImportFileError) {
    super(code);
  }
}

/** Big enough for thousands of rows, small enough for a phone's memory. */
export const IMPORT_FILE_MAX_BYTES = 15 * 1024 * 1024;

async function head(file: Blob, length: number) {
  return new Uint8Array(await file.slice(0, length).arrayBuffer());
}

/** The sheets of an .xlsx or .csv file (Excel 97–2003 .xls isn't readable here). */
export async function readSpreadsheet(file: File): Promise<SpreadsheetSheet[]> {
  if (file.size === 0) throw new ImportFileProblem("importUnreadable");
  if (file.size > IMPORT_FILE_MAX_BYTES) throw new ImportFileProblem("fileTooLarge");
  const start = await head(file, 8);
  const zip = start[0] === 0x50 && start[1] === 0x4b; // .xlsx is a zip
  const ole = start[0] === 0xd0 && start[1] === 0xcf && start[2] === 0x11 && start[3] === 0xe0;
  if (ole) throw new ImportFileProblem("importOldExcel");
  if (zip) {
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheets = await readXlsxFile(file);
      return sheets.map((sheet) => ({ name: sheet.sheet, rows: sheet.data as unknown[][] }));
    } catch {
      throw new ImportFileProblem("importUnreadable");
    }
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".txt") && file.type !== "text/csv")
    throw new ImportFileProblem("importFileType");
  const text = decodeText(new Uint8Array(await file.arrayBuffer()));
  return [{ name: file.name, rows: parseCsv(text) }];
}
