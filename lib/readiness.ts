import type { Content } from './content';
import type { MediaRow, Profile } from './types';
import { ids } from './editorial';
import { db } from './backend';
import { RequestError } from './http';
export function canEditContent(item: Content | null, profile: Profile | null) {
  return (
    !!profile &&
    profile.roles.some((r) => ['editor', 'administrator'].includes(r)) &&
    (!item || item.created_by === profile.id || profile.roles.includes('administrator'))
  );
}
export function referencedMedia(item: Content) {
  return [
    ...new Set(
      [item.cover_id, item.details.video_id, ...ids(item.details.gallery)].filter(
        (v): v is string => !!v,
      ),
    ),
  ];
}
export async function contentReadiness(id: string, token: string, profile: Profile) {
  const item = (await db<Content[]>('/rest/v1/content_items?id=eq.' + id + '&select=*', token))[0];
  if (!item) throw new RequestError('Record unavailable.', 404);
  const references = referencedMedia(item);
  const media = references.length
    ? await db<MediaRow[]>(
        '/rest/v1/website_media?select=*&id=in.(' + references.join(',') + ')',
        token,
      )
    : [];
  const blockers: string[] = [];
  for (const id of references) {
    const m = media.find((v) => v.id === id);
    if (!m) blockers.push('Selected media ' + id + ' could not be found. Choose another file.');
    else if (m.status !== 'Approved')
      blockers.push(m.filename + ' is ' + m.status + '; it needs independent media approval.');
    else if (
      !m.rights_confirmed ||
      (m.shows_children && (!m.guardian_consent || (m.consent_reference || '').trim().length < 3))
    )
      blockers.push(
        m.filename + ' needs confirmed publication rights and required guardian consent.',
      );
  }
  if (item.details.campaign_id) {
    const campaign = await db<Content[]>(
      '/rest/v1/published_content?kind=eq.campaign&id=eq.' + item.details.campaign_id,
      token,
    );
    if (!campaign.length)
      blockers.push('Publish the related giving campaign before submitting this content.');
  }
  return {
    id: item.id,
    version: item.version,
    canSubmit: canEditContent(item, profile),
    blockers,
    media,
  };
}
