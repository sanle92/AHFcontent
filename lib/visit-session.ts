export function visitSession(saved: string | null, now: number, createId: () => string) {
  let prior: { id?: unknown; time?: unknown } | null = null;
  try {
    prior = JSON.parse(saved || 'null');
  } catch {}
  const valid =
    prior &&
    typeof prior.id === 'string' &&
    typeof prior.time === 'number' &&
    now >= prior.time &&
    now - prior.time < 1800000;
  return { id: valid ? (prior!.id as string) : createId(), time: now };
}
