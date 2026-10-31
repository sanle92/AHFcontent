// UI race guard only. Server token verification, MFA and RLS remain the authorization boundary.
function identity(token: string) {
  try {
    const part = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!part) return null;
    const value = JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4))) as {
      sub?: unknown;
      session_id?: unknown;
      aal?: unknown;
    };
    return typeof value.sub === 'string' &&
      typeof value.session_id === 'string' &&
      value.aal === 'aal2'
      ? { sub: value.sub, session: value.session_id }
      : null;
  } catch {
    return null;
  }
}
export function assertCurrentSession(token: string, stored: string | null) {
  let current: { access_token?: string } | null = null;
  try {
    current = JSON.parse(stored || 'null');
  } catch {}
  if (current?.access_token === token) return;
  // A normal refresh rotates the JWT, not its verified user's login-session identity.
  const before = identity(token),
    after = current?.access_token ? identity(current.access_token) : null;
  if (before && after && before.sub === after.sub && before.session === after.session) return;
  throw new DOMException('Session changed.', 'AbortError');
}
export function currentSessionToken(token: string, stored: string | null): string {
  assertCurrentSession(token, stored);
  return (JSON.parse(stored || 'null') as { access_token: string }).access_token;
}
