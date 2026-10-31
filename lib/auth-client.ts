import { readApiResponse } from './api-response.ts';
export type AuthSession = { access_token: string; refresh_token: string; expires_at: number };
export type Factor = { id: string; factor_type: string; status: string; friendly_name?: string };
export type Enrollment = { id: string; totp: { qr_code: string; secret: string; uri: string } };
type AuthConfig = { url: string; key: string };
export async function authRequest<T>(
  config: AuthConfig,
  token: string,
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const response = await fetcher(config.url + '/auth/v1' + path, {
    ...init,
    signal: init.signal || AbortSignal.timeout(12000),
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? 'Too many attempts. Please wait before trying again.'
        : 'Authentication step failed. Check your code and try again.',
    );
  if (response.status === 204) return undefined as T;
  const data = await readApiResponse<T>(response);
  return data;
}
export async function verifyTotp(
  config: AuthConfig,
  token: string,
  factorId: string,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<AuthSession> {
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code from your authenticator.');
  const challenge = await authRequest<{ id: string }>(
    config,
    token,
    `/factors/${encodeURIComponent(factorId)}/challenge`,
    { method: 'POST', body: '{}' },
    fetcher,
  );
  const verified = await authRequest<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>(
    config,
    token,
    `/factors/${encodeURIComponent(factorId)}/verify`,
    { method: 'POST', body: JSON.stringify({ challenge_id: challenge.id, code }) },
    fetcher,
  );
  if (!verified.access_token || !verified.refresh_token || !verified.expires_in)
    throw new Error('Verification did not return a complete session.');
  return { ...verified, expires_at: Math.floor(Date.now() / 1000) + verified.expires_in };
}
