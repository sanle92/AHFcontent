'use client';
import { useEffect, useState, useCallback } from 'react';
import type { StaffApi, MediaRow } from '@/lib/types';
export function useContentReadiness(
  api: StaffApi,
  id: string | undefined,
  version: number | undefined,
  enabled: boolean,
) {
  const [retry, setRetry] = useState(0);
  const key = id + '/' + version + '/' + retry;
  const [result, setResult] = useState<{
    key: string;
    blockers: string[];
    error: string;
    canSubmit: boolean;
    media: MediaRow[];
  }>({ key: '', blockers: [], error: '', canSubmit: false, media: [] });
  const refresh = useCallback(() => setRetry((v) => v + 1), []);
  useEffect(() => {
    if (!enabled || !id) return;
    let active = true,
      inFlight = false;
    const load = async () => {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const value = await api<{
          version: number;
          blockers: string[];
          canSubmit: boolean;
          media: MediaRow[];
        }>('content-readiness?id=' + id);
        if (active)
          setResult({
            key,
            blockers:
              value.version === version
                ? value.blockers
                : ['This record changed. Reopen it after saving any unsaved text.'],
            canSubmit: value.canSubmit,
            media: value.media,
            error: '',
          });
      } catch (e) {
        if (active)
          setResult({
            key,
            blockers: [],
            canSubmit: false,
            media: [],
            error: (e as Error).message,
          });
      } finally {
        inFlight = false;
      }
    };
    const timer = setTimeout(() => void load(), 0),
      poll = setInterval(() => void load(), 30000);
    const focus = () => void load();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [api, id, version, key, enabled, retry]);
  return {
    ...result,
    media: result.key === key ? result.media : [],
    checking: enabled && !!id && result.key !== key,
    refresh,
  };
}
