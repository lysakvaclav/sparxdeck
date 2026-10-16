import { describe, expect, it } from "vitest";
import { searchTerms } from "@/lib/global-search";

describe("omnibar search terms", () => {
  it("reads label numbers", () => {
    for (const input of ["12", "0012", "#12", " 12 "])
      expect(searchTerms(input).label, input).toBe(12);
    expect(searchTerms("0").label).toBeNull();
  });

  it("reads defect numbers in both languages", () => {
    for (const input of ["Z-12", "z12", "D-0012", "d 12", "Z - 12"])
      expect(searchTerms(input).defect, input).toBe(12);
    expect(searchTerms("Z-0").defect).toBeNull();
    expect(searchTerms("Zámek").defect).toBeNull();
  });

  it("reads protocol numbers", () => {
    expect(searchTerms("2026-0001").protocol).toEqual({ year: 2026, number: 1 });
    expect(searchTerms("2026/17").protocol).toEqual({ year: 2026, number: 17 });
    expect(searchTerms("2026-0").protocol).toBeNull();
    expect(searchTerms("26-0001").protocol).toBeNull();
  });

  it("searches text from two characters", () => {
    expect(searchTerms("L").text).toBeNull();
    expect(searchTerms("Li").text).toBe("Li");
    expect(searchTerms("  Lipová 12  ").text).toBe("Lipová 12");
    expect(searchTerms("x".repeat(150)).text).toHaveLength(100);
  });
});
