export function publicPath(value: unknown) {
  if (typeof value !== 'string') return null;
  const p = value.split(/[?#]/)[0];
  if (p.length > 180 || !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?)?$/.test(p))
    return null;
  const parts = p.split('/').filter(Boolean);
  if (['holyghost', 'admin', 'api', 'media', 'images', 'icons', 'site-settings'].includes(parts[0]))
    return null;
  if (
    parts.length > 1 &&
    !['programmes', 'stories', 'events', 'reports', 'campaigns', 'shop', 'albums'].includes(
      parts[0],
    )
  )
    return null;
  return p;
}

export function visitorDevice(ua: string) {
  return {
    device: /ipad|tablet/i.test(ua)
      ? 'Tablet'
      : /mobile|iphone|android/i.test(ua)
        ? 'Phone'
        : 'Computer',
    browser: /edg/i.test(ua)
      ? 'Edge'
      : /firefox/i.test(ua)
        ? 'Firefox'
        : /chrome|crios/i.test(ua)
          ? 'Chrome'
          : /safari/i.test(ua)
            ? 'Safari'
            : 'Other',
  };
}
export async function privateHash(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export function pushEndpoint(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      (u.hostname === 'fcm.googleapis.com' ||
        u.hostname === 'updates.push.services.mozilla.com' ||
        /^[a-z0-9.-]+\.push\.apple\.com$/.test(u.hostname) ||
        /^[a-z0-9.-]+\.notify\.windows\.com$/.test(u.hostname))
    );
  } catch {
    return false;
  }
}
