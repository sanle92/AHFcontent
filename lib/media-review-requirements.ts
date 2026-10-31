import type { MediaRow, Profile } from './types';

export function mediaReviewRequirements(media: Partial<MediaRow>): string[] {
  const missing: string[] = [];
  if ((media.alt_text || '').trim().length < 3)
    missing.push('Add a description of at least three characters.');
  if (!media.rights_confirmed) missing.push('Confirm the right to publish this file.');
  if (media.shows_children) {
    if (!media.guardian_consent) missing.push('Confirm guardian consent for public use.');
    if ((media.consent_reference || '').trim().length < 3)
      missing.push('Add a guardian-consent reference of at least three characters.');
  }
  return missing;
}

export function canPrepareMedia(media: MediaRow, profile: Profile | null, editable: boolean) {
  return (
    !!profile &&
    editable &&
    (media.created_by === profile.id || profile.roles.includes('administrator'))
  );
}
