export function analyticsFilters(from: string, to: string, country: string, offset: string) {
  const day = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Choose valid calendar dates.');
    const instant = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== value)
      throw Error('Choose valid calendar dates.');
    return instant.getTime();
  };
  const start = day(from),
    end = day(to),
    page = Number(offset);
  if (end < start || end - start >= 91 * 86400000)
    throw Error('Choose an ordered date range of at most 91 days.');
  if (!Number.isInteger(page) || page < 0 || page > 10000)
    throw Error('Choose a valid history page.');
  const normalized = country.toUpperCase();
  if (normalized && !/^[A-Z]{2}$/.test(normalized)) throw Error('Use a two-letter country code.');
  return {
    start_at: from + 'T00:00:00+03:00',
    end_at: new Date(end + 86400000 - 3 * 3600000).toISOString(),
    selected_country: normalized,
    page_offset: page,
  };
}
