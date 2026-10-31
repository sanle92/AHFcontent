'use client';
import { useEffect, useState } from 'react';
import type { StaffApi, ContentItem, MediaRow, EnquiryRow } from '@/lib/types';
export type WorkspaceRow = ContentItem | MediaRow | EnquiryRow;
export function useWorkspace(api: StaffApi, query: string | null, refresh: number) {
  const [result, setResult] = useState<{
    key: string;
    rows: WorkspaceRow[];
    total: number;
    error: string;
  }>({ key: '', rows: [], total: 0, error: '' });
  useEffect(() => {
    if (!query) return;
    let active = true;
    const timer = setTimeout(() => {
      void api<{ rows: WorkspaceRow[]; total: number }>('workspace?' + query)
        .then((v) => {
          if (active) setResult({ key: query, ...v, error: '' });
        })
        .catch((e) => {
          if (active && (e as Error).name !== 'AbortError')
            setResult({ key: query, rows: [], total: 0, error: (e as Error).message });
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, query, refresh]);
  return result.key === query ? result : { rows: [], total: 0, error: '' };
}
