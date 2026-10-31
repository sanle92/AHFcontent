// Browser transports share this decoder so gateway HTML/empty bodies never become parser errors.
export function decodeApiResponse<T>(status: number, body: string, contentType: string): T {
  if (status === 204) return undefined as T;
  const fallback = `The request could not be completed (HTTP ${status}). Refresh and try again.`;
  if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(contentType) || !body.trim())
    throw new Error(fallback);
  let value: T & { error?: unknown };
  try {
    value = JSON.parse(body);
  } catch {
    throw new Error(fallback);
  }
  if (status < 200 || status >= 300)
    throw new Error(typeof value?.error === 'string' ? value.error : fallback);
  return value;
}
export async function readApiResponse<T>(response: Response): Promise<T> {
  return decodeApiResponse<T>(
    response.status,
    await response.text(),
    response.headers.get('Content-Type') || '',
  );
}
