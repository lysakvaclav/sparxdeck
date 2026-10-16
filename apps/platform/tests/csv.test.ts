import { describe, expect, it } from "vitest";
import { csvCell, csvFileName, csvSeparator, toCsv } from "@/lib/csv";

describe("CSV export", () => {
  it("uses the separator Excel expects in the language", () => {
    expect(csvSeparator("cs")).toBe(";");
    expect(csvSeparator("en")).toBe(",");
  });

  it("quotes only what needs quoting", () => {
    expect(csvCell("Lipová 12", ";")).toBe("Lipová 12");
    expect(csvCell("Praha; Brno", ";")).toBe('"Praha; Brno"');
    expect(csvCell("Praha, Brno", ";")).toBe("Praha, Brno");
    expect(csvCell("Praha, Brno", ",")).toBe('"Praha, Brno"');
    expect(csvCell('Řekl "ano"', ";")).toBe('"Řekl ""ano"""');
    expect(csvCell("dva\nřádky", ";")).toBe('"dva\nřádky"');
    expect(csvCell(" mezera ", ";")).toBe('" mezera "');
    expect(csvCell(null, ";")).toBe("");
    expect(csvCell(undefined, ";")).toBe("");
    expect(csvCell(12.5, ";")).toBe("12.5");
  });

  it("never lets a cell run as a formula", () => {
    for (const formula of ["=1+1", "+420 555", "-2", "@SUM(A1)", "\t=x"])
      expect(csvCell(formula, ";").replace(/^"/, "").startsWith("'"), formula).toBe(true);
    expect(csvCell('=HYPERLINK("x")', ";")).toBe('"\'=HYPERLINK(""x"")"');
    // Numbers are data, not text a person typed.
    expect(csvCell(-2, ";")).toBe("-2");
  });

  it("writes a BOM, the header and CRLF lines", () => {
    const file = toCsv(
      ["Štítek", "Budova"],
      [
        ["0001", "Lipová; 12"],
        ["0002", null],
      ],
      ";",
    );
    expect(file).toBe('\uFEFFŠtítek;Budova\r\n0001;"Lipová; 12"\r\n0002;\r\n');
  });

  it("names files without diacritics", () => {
    expect(csvFileName("Zařízení", "2026-10-13")).toBe("zarizeni-2026-10-13.csv");
    expect(csvFileName("Revize a kontroly", "2026-10-13")).toBe("revize-a-kontroly-2026-10-13.csv");
    expect(csvFileName("???", "2026-10-13")).toBe("export-2026-10-13.csv");
  });
});
