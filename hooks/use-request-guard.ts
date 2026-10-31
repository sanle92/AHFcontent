'use client';
import { useMemo, useRef } from 'react';
export function useRequestGuard() {
  const epoch = useRef(0);
  return useMemo(
    () => ({
      capture: () => epoch.current,
      isCurrent: (value: number) => value === epoch.current,
      invalidate: () => {
        epoch.current++;
      },
    }),
    [],
  );
}
