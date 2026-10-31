export function retryAfter(value: string | null | undefined, now = Date.now()) {
  if (!value) return null;
  const seconds = /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : null;
}
