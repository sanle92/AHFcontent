'use client';
import { useEffect } from 'react';
export default function Engagement({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || navigator.doNotTrack === '1') return;
    const track = (event: MouseEvent) => {
      const link = (event.target as HTMLElement)?.closest('a[data-engagement]');
      const action = link?.getAttribute('data-engagement');
      if (action)
        void fetch('/api/engagement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
          keepalive: true,
        }).catch(() => {});
    };
    document.addEventListener('click', track);
    return () => document.removeEventListener('click', track);
  }, [enabled]);
  return null;
}
