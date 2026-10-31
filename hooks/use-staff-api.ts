'use client';
import { currentSessionToken } from '@/lib/session-current';
import { decodeApiResponse, readApiResponse } from '@/lib/api-response';
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { AuthSession } from '@/lib/auth-client';
export function useStaffApi(
  session: AuthSession | null,
  setMessage: Dispatch<SetStateAction<string>>,
) {
  return useCallback(
    async <T = unknown>(path: string, init: RequestInit = {}): Promise<T> => {
      if (!session) throw Error('Sign in required.');
      const current = () =>
        currentSessionToken(session.access_token, sessionStorage.getItem('ahf-website-session'));
      const requestToken = current();
      if (init.body instanceof FormData)
        return new Promise<T>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(init.method || 'POST', '/api/' + path);
          xhr.timeout = 180000;
          xhr.setRequestHeader('Authorization', 'Bearer ' + requestToken);
          xhr.upload.onprogress = (e) => {
            try {
              current();
            } catch {
              xhr.abort();
              return;
            }
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setMessage(
                'Upload ' + percent + '%' + (percent === 100 ? ' — processing securely…' : ''),
              );
              window.dispatchEvent(new CustomEvent('ahf-upload-progress', { detail: percent }));
            }
          };
          xhr.onload = () => {
            try {
              current();
              resolve(
                decodeApiResponse<T>(
                  xhr.status,
                  xhr.responseText,
                  xhr.getResponseHeader('Content-Type') || '',
                ),
              );
            } catch (error) {
              reject(error);
            }
          };
          xhr.onerror = () => reject(Error('Upload interrupted. Check your connection and retry.'));
          xhr.ontimeout = () =>
            reject(Error('Upload timed out. Try a smaller file or a video link.'));
          xhr.onabort = () => reject(Error('Upload cancelled.'));
          xhr.send(init.body as FormData);
        });
      const r = await fetch('/api/' + path, {
        ...init,
        signal: init.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(25000)])
          : AbortSignal.timeout(25000),
        headers: {
          Authorization: 'Bearer ' + requestToken,
          ...(!(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        cache: 'no-store',
      });
      const value = await readApiResponse<T>(r);
      current();
      return value;
    },
    [session, setMessage],
  );
}
