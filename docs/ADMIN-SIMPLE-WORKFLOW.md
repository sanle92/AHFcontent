# Simple website admin workflow

This update uses the existing website-content database and requires no new migration. Apply any
missing migrations through 022 in staging first; do not apply them to the private NGO database.

1. Open a programme, story, campaign or event. Add a title, description and cover.
2. Open **Add gallery photos or a video** to upload photos, an MP4 or register a YouTube/Vimeo
   link. Registered media is private and must not be treated as approved.
3. Save the draft. In the review checklist, open each file, provide rights and, if it shows
   children, guardian consent. Submit the media for independent review.
4. A different authorized publisher reviews the media. The author refreshes approval status,
   submits the content, and a different publisher approves the content before publication.
5. The bell shows recent notifications. **Open related item** resolves supported notification
   types using the user's existing access rights. Older or administrative notices without an
   identifiable target show a message instead. A push notification still opens the admin itself.

Image files are limited to 10 MB and MP4 files to 20 MB. The editor accepts only the supported
YouTube/Vimeo link formats enforced by the server. No real payment or fundraiser totals are inferred.

Local unit, type, lint and build checks do not establish live readiness. Run the supplied isolated
staging two-account browser tests, check real media/consent flows and notification delivery on actual
phone/tablet/desktop devices, and verify provider configuration before production. Do not use live
personal data in test fixtures. The local preview in the development environment could not start
because `uv_interface_addresses` is unavailable; no browser or real-device success is claimed.
