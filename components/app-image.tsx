'use client';
import { useState } from 'react';
import Image, { type ImageProps } from 'next/image';
export default function AppImage({
  src,
  alt,
  width = 1200,
  height = 800,
  loading = 'lazy',
  onError,
  ...props
}: Omit<ImageProps, 'src' | 'width' | 'height'> & {
  src?: ImageProps['src'];
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState<ImageProps['src'] | null>(null);
  if (!src) return null;
  if (failed === src)
    return (
      <span className={'media-unavailable ' + (props.className || '')} role="img" aria-label={alt}>
        Image currently unavailable
      </span>
    );
  return (
    <Image
      alt={alt}
      src={src}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      onError={(event) => {
        setFailed(src);
        onError?.(event);
      }}
      unoptimized
      {...props}
    />
  );
}
