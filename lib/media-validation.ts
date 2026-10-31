export function detectMedia(bytes: Uint8Array) {
  const ascii = (a: number, b: number) => new TextDecoder().decode(bytes.slice(a, b));
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { mime: 'image/jpeg', extension: 'jpg', limit: 10 * 1024 * 1024 };
  if (bytes[0] === 137 && ascii(1, 4) === 'PNG')
    return { mime: 'image/png', extension: 'png', limit: 10 * 1024 * 1024 };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
    return { mime: 'image/webp', extension: 'webp', limit: 10 * 1024 * 1024 };
  if (ascii(0, 5) === '%PDF-')
    return { mime: 'application/pdf', extension: 'pdf', limit: 10 * 1024 * 1024 };
  if (
    ascii(4, 8) === 'ftyp' &&
    ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '].includes(ascii(8, 12))
  )
    return { mime: 'video/mp4', extension: 'mp4', limit: 20 * 1024 * 1024 };
  throw Error(
    'Unsupported file. Choose JPG, PNG, WebP, PDF or MP4. For iPhone HEIC/MOV, export as JPEG/MP4 first.',
  );
}
export function canonicalVideo(value: string) {
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    throw Error('Paste a complete YouTube or Vimeo URL.');
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port)
    throw Error('Use an HTTPS video link.');
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  const id =
    host === 'youtu.be'
      ? u.pathname.slice(1)
      : host === 'youtube.com'
        ? u.pathname.startsWith('/shorts/')
          ? u.pathname.split('/')[2]
          : u.searchParams.get('v')
        : null;
  if (id && /^[\w-]{11}$/.test(id)) return 'https://www.youtube.com/watch?v=' + id;
  if (host === 'vimeo.com' && /^\/\d{5,12}\/?$/.test(u.pathname))
    return 'https://vimeo.com/' + u.pathname.split('/')[1];
  throw Error('Use a YouTube watch/shorts link or a public Vimeo video URL.');
}
