// Continue across server-side row caps rather than assuming a short page means EOF.
export async function readAllRows<T>(
  read: (offset: number) => Promise<T[]>,
  getTotal?: () => number | undefined,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const batch = await read(rows.length);
    if (!batch.length) return rows;
    rows.push(...batch);
    const total = getTotal?.();
    if (total !== undefined && rows.length >= total) return rows;
  }
}
