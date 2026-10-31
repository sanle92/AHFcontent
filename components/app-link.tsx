import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';
export default function AppLink(props: ComponentPropsWithoutRef<'a'>) {
  const { href, ...rest } = props;
  if (
    href?.startsWith('/') &&
    !href.startsWith('//') &&
    !href.startsWith('/media/') &&
    !href.startsWith('/api/') &&
    !props.download
  )
    return <Link href={href} {...rest} />;
  return <a href={href} {...rest} />;
}
