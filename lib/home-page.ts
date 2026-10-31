export function campaignPage(value: unknown) {
  const n = typeof value === 'string' ? Number(value) : 0;
  return Number.isInteger(n) && n >= 0 && n <= 10000 ? n : 0;
}
