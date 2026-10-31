# Website analytics troubleshooting

Analytics records only visitors who actively allow visit statistics. Respecting a decline, Do Not
Track, blocked local/session storage, failed requests and the 30-day retention window means this is
not a count of everyone who opened the site. Historical visits that were never recorded or have
been deleted cannot be reconstructed from this database. Live is an approximate count of consented
sessions seen within two minutes, not a live video or a list of identified people.

In the deployed website Worker environment, configure `AHF_ANALYTICS_ENABLED=true` and the
correct `AHF_CONTENT_SUPABASE_URL`, `AHF_CONTENT_SUPABASE_ANON_KEY`, and server-only
`AHF_CONTENT_SERVICE_KEY` for the website-content project. Never put the service key in browser code,
source control, screenshots, chat messages, or the private-management project. Production and
preview environments can have different settings; changes need the normal Worker deployment.

Back up the website-content database. Check which SQL migrations are installed. Apply missing
migrations in order; do not rerun old non-idempotent migrations. This code includes 023 and 024
from the unfinished donation work and 025 for analytics. Apply and test 025 on an isolated staging
copy with its prerequisites installed, then refresh PostgREST's schema cache. No live migration or
deployment was run as part of this change.

Sign in to `/holyghost` as an administrator with MFA and open Analytics. The setup panel reports
whether collection is enabled, a service key is present, the dashboard database query works and the
service-only analytics health RPC can be called. These checks are diagnostic, not proof of an
end-to-end event; they do not reveal credentials. Missing migration 025 or an invalid service key
can make the ingestion-connection check fail.

For an end-to-end staging test, open the public site in a separate fresh browser session, choose
**Allow visit statistics**, and leave the page visible. On the admin device select a date range
including today in Kampala, clear the country filter, and allow up to a minute for collection and
the dashboard refresh. Navigate to another public page, then check Live now, Page views and
History. Return to the public browser after hiding its tab and check the next heartbeat. Test
Decline / delete separately; it must not create a new recorded visit. Do not expect traffic before
consent or beyond retention to appear. Browser privacy controls, ad blockers and network failures
can prevent collection. Geo location is approximate and may be Unknown.
