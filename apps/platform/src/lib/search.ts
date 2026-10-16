/**
 * Turns user input into a PostgREST `or=(...)` filter that matches any of the
 * columns case-insensitively. LIKE wildcards (% _) are matched literally, `*`
 * (a wildcard to PostgREST) is dropped, and the value is quoted so commas and
 * parentheses in the input can't change the filter.
 */
export function ilikeAny(columns: readonly string[], input: string): string | null {
  const query = input.replaceAll("*", " ").trim().slice(0, 100);
  if (!query) return null;
  const like = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const quoted = `"${like.replace(/[\\"]/g, "\\$&")}"`;
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}

/** Positive page number from a query parameter; anything invalid is page 1. */
export function pageParam(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}
