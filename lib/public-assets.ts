export async function approvedAssets<T>(
  ids: string[],
  fetchBatch: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const unique = [...new Set(ids)];
  const rows: T[] = [];
  for (let offset = 0; offset < unique.length; offset += 200)
    rows.push(...(await fetchBatch(unique.slice(offset, offset + 200))));
  return rows;
}
