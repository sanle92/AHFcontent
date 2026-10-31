'use client';
import { readApiResponse } from '../lib/api-response';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { AuthSession } from '@/lib/auth-client';
import type { Profile, TokenResponse } from '@/lib/types';
import type { useRequestGuard } from './use-request-guard';
interface Options {
  session: AuthSession | null;
  config: { configured: boolean; url: string; key: string } | null;
  guard: ReturnType<typeof useRequestGuard>;
  setSession: Dispatch<SetStateAction<AuthSession | null>>;
  setProfile: Dispatch<SetStateAction<Profile | null>>;
  setError: Dispatch<SetStateAction<string>>;
}
// Cancel refresh results when session changes or the workspace unmounts.
export function useAdminSession({
  session,
  config,
  guard,
  setSession,
  setProfile,
  setError,
}: Options) {
  useEffect(() => {
    if (!session || !config?.configured) return;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        try {
          const r = await fetch(config.url + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            headers: { apikey: config.key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
          });
          if (!r.ok) throw Error('Session expired. Sign in again.');
          const v = await readApiResponse<TokenResponse>(r);
          if (cancelled) return;
          const next = {
            access_token: v.access_token,
            refresh_token: v.refresh_token,
            expires_at: Date.now() / 1000 + v.expires_in,
          };
          sessionStorage.setItem('ahf-website-session', JSON.stringify(next));
          setSession(next);
        } catch (e) {
          if (cancelled) return;
          guard.invalidate();
          setSession(null);
          setProfile(null);
          sessionStorage.removeItem('ahf-website-session');
          setError((e as Error).message);
        }
      },
      Math.max(1000, session.expires_at * 1000 - Date.now() - 60000),
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, config, guard, setSession, setProfile, setError]);
}
