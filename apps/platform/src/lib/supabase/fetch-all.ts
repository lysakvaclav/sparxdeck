// PostgREST returns at most 1000 rows per request, so larger tables load in pages.
const PAGE = 1000;

/** Runs a ranged query page by page until a short page comes back. */
export async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}
