'use client';
import { useEffect, useState } from 'react';
import AppImage from '../app-image';

export default function MediaThumbnail({
  id,
  name,
  preview,
}: {
  id: string;
  name: string;
  preview: (id: string) => Promise<string>;
}) {
  const [result, setResult] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    let active = true;
    void preview(id).then(
      (url) => {
        if (active) setResult({ id, url });
      },
      () => {
        if (active) setResult({ id, url: '' });
      },
    );
    return () => {
      active = false;
    };
  }, [id, preview]);
  if (!result || result.id !== id) return <span>Loading preview…</span>;
  if (!result.url) return <span>Preview unavailable</span>;
  return <AppImage src={result.url} alt={name} />;
}
