import AppLink from './app-link';
import AppImage from './app-image';
import {
  ArrowUpRight,
  ArrowRight,
  Heart,
  Music,
  Shirt,
  Coffee,
  Leaf,
  BookOpen,
  HandHeart,
  Users,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import { mission, vision, team, type Content } from '@/lib/content';
import HomeSections, { AppealCards, personalHelp } from './home-sections';
import KidsShowcase from './kids-showcase';
import ContentExtras from './content-extras';
import { ApprovedVideo, type Asset } from './portfolio';
import Engagement from './visitor-consent';
import { env } from 'cloudflare:workers';
import { db, config } from '@/lib/backend';
import { approvedAssets } from '@/lib/public-assets';
import { ids } from '@/lib/editorial';
import EnquiryForm from './enquiry-form';
import DonationMethods from './donation-methods';
const nav = [
  ['About us', '/about'],
  ['Our work', '/programmes'],
  ['Aminia Kids', '/aminia-kids'],
  ['Stories', '/stories'],
  ['Get involved', '/get-involved'],
];
const icons = [BookOpen, ShieldCheck, Heart, Users, HandHeart, Sprout, Users, ShieldCheck, Music];
const para = (s: string) =>
  s
    .split(/\n\n+/)
    .filter(Boolean)
    .map((p, i) => <p key={i}>{p}</p>);
function Photo({
  item,
  fallback,
  className = '',
  eager = false,
  assets,
}: {
  item?: Content;
  fallback?: string;
  className?: string;
  eager?: boolean;
  assets?: Asset[];
}) {
  const approved = assets?.find((a) => a.id === item?.cover_id);
  const src = item?.cover_id
    ? !assets || approved
      ? '/media/' + item.cover_id
      : undefined
    : item?.details.image || fallback;
  return src ? (
    <AppImage
      className={className}
      src={src}
      alt={
        approved?.alt_text ||
        item?.details.caption ||
        'Aminia Hope Foundation team working together'
      }
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
    />
  ) : item?.kind === 'product' ? (
    <div className={'product-art ' + className}>
      {item.slug.includes('mug') ? (
        <Coffee size={80} strokeWidth={1} />
      ) : (
        <Shirt size={80} strokeWidth={1} />
      )}
      <strong>Aminia Hope</strong>
      <span>FOUNDATION · MERCHANDISE CONCEPT</span>
    </div>
  ) : (
    <div className={'abstract-photo ' + className}>
      <Sprout size={64} />
      <span>Growing hope, together.</span>
    </div>
  );
}
function PageHero({
  label,
  title,
  text,
  page,
  assets,
  content = [],
}: {
  label: string;
  title: string;
  text?: string;
  page?: Content | null;
  assets?: Asset[];
  content?: Content[];
}) {
  return (
    <section className="page-hero wrap">
      <p className="eyebrow">{label}</p>
      <h1>{page?.title || title}</h1>
      {(page?.summary || text) && <p className="lead">{page?.summary || text}</p>}
      {page?.cover_id && <Photo item={page} assets={assets} />}
      {page?.body && <div className="prose">{para(page.body)}</div>}
      {page && <ContentExtras item={page} content={content} assets={assets || []} />}
    </section>
  );
}
function KidsPanel({
  compact = false,
  item,
  assets,
}: {
  compact?: boolean;
  item?: Content;
  assets?: Asset[];
}) {
  return (
    <section className={'kids-panel ' + (compact ? 'compact' : '')}>
      <div className="kids-art" aria-label="Aminia Kids arts and creativity">
        {item?.cover_id ? (
          <Photo item={item} assets={assets} />
        ) : (
          <>
            <span className="art-sun">✦</span>
            <span className="art-word">
              Aminia
              <br />
              <em>Kids.</em>
            </span>
            <span className="art-notes">♫</span>
            <span className="art-line">EVERY CHILD DESERVES HOPE</span>
          </>
        )}
      </div>
      <div className="kids-copy">
        <p className="eyebrow">ROOM TO CREATE. CONFIDENCE TO GROW.</p>
        <h2>
          Little voices.
          <br />
          <em>Brighter futures.</em>
        </h2>
        <p>
          {item?.summary ||
            'Aminia Kids brings dance, theatre and singing into the foundation’s work with children. A space for creativity, expression and hope.'}
        </p>
        <div className="pills">
          <span>Dance</span>
          <span>Theatre</span>
          <span>Singing</span>
        </div>
        <AppLink
          className="text-link"
          href={compact ? '/aminia-kids' : '/contact?interest=aminia-kids'}
        >
          {compact ? 'Meet Aminia Kids' : 'Enquire as a parent or guardian'}
          <ArrowUpRight size={19} />
        </AppLink>
      </div>
    </section>
  );
}
export default async function Website({
  path = '/',
  content,
  campaignPage = 0,
  campaignsMore = false,
}: {
  campaignPage?: number;
  campaignsMore?: boolean;
  path?: string;
  content: Content[];
}) {
  const assetIds = content.flatMap((i) => [
    ...(path === '/' ? [] : ids(i.details.gallery)),
    ...(i.cover_id ? [i.cover_id] : []),
  ]);
  const assets: Asset[] = config().url
    ? await approvedAssets<Asset>(assetIds, (batch) =>
        db<Asset[]>('/rest/v1/rpc/website_public_assets', undefined, {
          method: 'POST',
          body: JSON.stringify({ media_ids: batch }),
        }),
      )
    : [];
  const settings =
    content.find((i) => i.kind === 'page' && i.slug === 'site-settings')?.details || {};
  const teamPage = content.find((c) => c.kind === 'page' && c.slug === 'team');
  const approvedTeam = teamPage?.body
    .split('\n')
    .map((line) => line.split('|').map((s) => s.trim()))
    .filter((row) => row.length === 2 && row.every(Boolean));
  const foundingTeam = approvedTeam?.length ? approvedTeam : team;
  const home = content.find((c) => c.kind === 'page' && c.slug === 'home');
  const about = content.find((c) => c.kind === 'page' && c.slug === 'about'),
    programmes = content.filter((c) => c.kind === 'programme'),
    stories = content.filter((c) => c.kind === 'story');
  const bits = path.split('/').filter(Boolean),
    kind = bits[0];
  const item =
    bits.length === 2
      ? content.find(
          (c) =>
            c.slug === bits[1] &&
            (
              {
                programmes: 'programme',
                stories: 'story',
                events: 'event',
                reports: 'report',
                campaigns: 'campaign',
                shop: 'product',
                albums: 'album',
              } as Record<string, string>
            )[kind] === c.kind,
        )
      : null;
  const custom =
    bits.length === 1
      ? content.find(
          (c) =>
            c.kind === 'page' &&
            c.slug === bits[0] &&
            c.slug !== 'about' &&
            c.slug !== 'site-settings',
        )
      : null;
  const templatePages = [
    'programmes',
    'aminia-kids',
    'stories',
    'events',
    'transparency',
    'impact',
    'get-involved',
    'donate',
    'contact',
    'shop',
  ];
  return (
    <>
      <Engagement
        enabled={(env as unknown as Record<string, string>).AHF_ANALYTICS_ENABLED === 'true'}
      />
      <AppLink className="skip-link" href="#main">
        Skip to content
      </AppLink>
      <div className="topline">
        <span>ROOTED IN COMMUNITY. INSPIRED BY HOPE.</span>
        <span>Entebbe, Uganda ✦</span>
      </div>
      <header className="site-header">
        <div className="header-content wrap">
          <AppLink href="/" className="brand">
            <AppImage src="/images/brand-991c0b4ae252.webp" alt="Aminia Hope Foundation" />
          </AppLink>
          <nav aria-label="Main navigation">
            {nav.map(([name, href]) => (
              <AppLink key={href} href={href} aria-current={path === href ? 'page' : undefined}>
                {name}
              </AppLink>
            ))}
          </nav>
          <AppLink href="/donate" className="btn green small">
            Give hope <Heart size={15} />
          </AppLink>
          <details className="mobile-menu">
            <summary>Menu</summary>
            <nav>
              {nav.map(([name, href]) => (
                <AppLink key={href} href={href}>
                  {name}
                </AppLink>
              ))}
              <AppLink href="/contact">Contact</AppLink>
              <AppLink href="/transparency">Transparency</AppLink>
              <AppLink href="/donate">Give hope</AppLink>
            </nav>
          </details>
        </div>
      </header>
      <main id="main">
        {path === '/' && (
          <>
            <section className="hero wrap">
              <div className="hero-copy">
                <p className="eyebrow">
                  <span className="dash" />
                  BELIEVE IN WHAT WE CAN BECOME
                </p>
                <h1>
                  {!home || home.title === 'Hope begins with believing.' ? (
                    <>
                      Hope begins
                      <br />
                      with <em>believing.</em>
                    </>
                  ) : (
                    home.title
                  )}
                </h1>
                <p style={{ whiteSpace: 'pre-line' }}>
                  {home?.summary ||
                    'In every child. In every family. In the possibility of a brighter tomorrow.'}
                </p>
                {home?.body && <div className="hero-body">{para(home.body)}</div>}
                <div className="hero-actions">
                  <AppLink className="btn green" href="/programmes">
                    Discover our work <ArrowUpRight size={18} />
                  </AppLink>
                  <AppLink href="/get-involved" className="text-link">
                    Be part of the change <ArrowRight size={17} />
                  </AppLink>
                </div>
                <div className="hero-location">
                  <span>◉</span>
                  <span>
                    Community-based. People-centred.
                    <small>Katabi & Busabaga · Wakiso District, Uganda</small>
                  </span>
                </div>
              </div>
              <div className="hero-visual">
                <div className="photo-outline" />
                {home?.details.video_id ? (
                  <ApprovedVideo id={home.details.video_id} />
                ) : (
                  <Photo
                    assets={assets}
                    item={home}
                    fallback="/images/working-together.jpeg"
                    eager
                  />
                )}
                <span className="hero-seal">
                  A LITTLE BELIEF
                  <br />
                  <b>✦</b>
                  <br />A LASTING DIFFERENCE
                </span>
                <div className="image-caption">
                  <span>01 / TOGETHER, WE BEGIN</span>
                  <span>Listening. Learning. Working together.</span>
                </div>
              </div>
            </section>
            <div className="values-strip">
              <span>Empowering people</span>
              <i>✦</i>
              <span>Strengthening communities</span>
              <i>✦</i>
              <span>Building a brighter future</span>
            </div>
            <HomeSections
              content={content}
              campaignPage={campaignPage}
              campaignsMore={campaignsMore}
            />
          </>
        )}

        {path === '/about' && (
          <>
            <PageHero
              page={custom}
              content={content}
              assets={assets}
              label="OUR STORY"
              title={about?.title || 'Believing in people. Building hope.'}
              text={about?.summary}
            />
            <section className="split-content wrap">
              <Photo assets={assets} item={about} fallback="/images/team-collaboration.jpeg" />
              <div className="prose">
                {para(about?.body || '')}
                <p className="eyebrow">OUR MISSION</p>
                <h3>{about?.details.mission || mission}</h3>
                <p className="eyebrow">OUR VISION</p>
                <p>{about?.details.vision || vision}</p>
              </div>
            </section>
            <section className="wrap section-space">
              <div className="section-head">
                <div>
                  <p className="eyebrow">SHARED IDEAS. DEFINED RESPONSIBILITIES.</p>
                  <h2>
                    Our founding <em>team.</em>
                  </h2>
                </div>
                <p>All four are co-founders, each with an assigned responsibility.</p>
              </div>
              <div className="team-grid">
                {foundingTeam.map(([name, role], i) => (
                  <article key={name}>
                    <span>0{i + 1}</span>
                    <h3>{name}</h3>
                    <p>{role}</p>
                    <small>Co-founder</small>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
        {path === '/programmes' && (
          <>
            <PageHero
              page={custom}
              content={content}
              assets={assets}
              label="OUR WORK"
              title="Practical action. Shared hope."
              text="Children, families and communities. Practical support, rooted in listening and working together."
            />
            <section className="wrap work-intro">
              <div>
                <p className="eyebrow">WHERE HOPE MEETS ACTION</p>
                <h2>
                  Entebbe roots.
                  <br />
                  <em>Community purpose.</em>
                </h2>
                <p>
                  We work in Katabi and Busabaga, Wakiso District. Our objectives also include
                  environmental protection and humanitarian partnerships.
                </p>
              </div>
              <div className="notice">
                <h3>Our commitments, clearly presented.</h3>
                <p>
                  Programme areas describe our focus. Planned activities and active programmes are
                  labelled separately as details are confirmed.
                </p>
                <AppLink className="text-link" href="/impact">
                  Explore impact & learning ↗
                </AppLink>
              </div>
            </section>
            <section className="wrap programme-grid">
              {programmes.map((p, i) => {
                const Icon = icons[i % icons.length];
                return (
                  <AppLink
                    className="programme-card"
                    href={p.slug === 'aminia-kids' ? '/aminia-kids' : '/programmes/' + p.slug}
                    key={p.id}
                  >
                    {(p.cover_id || p.details.image) && (
                      <Photo item={p} assets={assets} className="programme-cover" />
                    )}
                    <Icon size={30} strokeWidth={1.4} />
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <h2>{p.title}</h2>
                    <p>{p.summary}</p>
                    <small className="pill">{p.details.programme_status || 'Programme area'}</small>
                    <ArrowUpRight size={24} />
                  </AppLink>
                );
              })}
            </section>
            <section className="wrap section-space">
              <h2>Our shared objectives</h2>
              <p className="lead">
                Education and child development. Health and hygiene. Community empowerment. Skills
                and economic opportunity. Environmental protection. Partnerships and humanitarian
                assistance.
              </p>
            </section>
          </>
        )}
        {path === '/aminia-kids' && (
          <>
            <PageHero
              page={custom}
              content={content}
              assets={assets}
              label="AMINIA KIDS"
              title="Every child deserves hope."
              text="Dance, theatre, singing and creative expression — part of the Aminia Hope Foundation family."
            />
            <div className="wrap">
              <KidsPanel assets={assets} item={programmes.find((p) => p.slug === 'aminia-kids')} />
            </div>
            <section className="wrap section-space">
              <div className="section-head">
                <h2>
                  Space to express.
                  <br />
                  <em>Reasons to believe.</em>
                </h2>
                <p>
                  Aminia Kids is the foundation’s arts and creativity programme. Parents, guardians,
                  creative instructors and partners can enquire about taking part.
                </p>
              </div>
              <div className="three-columns">
                {[
                  ['Dance', 'Movement, rhythm and expression.'],
                  ['Theatre', 'Stories, imagination and working together.'],
                  ['Singing', 'Finding a voice and sharing it with others.'],
                ].map(([a, b]) => (
                  <article key={a}>
                    <Music size={28} />
                    <h3>{a}</h3>
                    <p>{b}</p>
                  </article>
                ))}
              </div>
            </section>
            {!custom &&
              programmes.find((p) => p.slug === 'aminia-kids')?.body &&
              programmes.find((p) => p.slug === 'aminia-kids')?.body !==
                programmes.find((p) => p.slug === 'aminia-kids')?.summary && (
                <section className="wrap prose section-space">
                  {para(programmes.find((p) => p.slug === 'aminia-kids')!.body)}
                </section>
              )}
            {programmes.find((p) => p.slug === 'aminia-kids') && (
              <section className="wrap prose section-space">
                <ContentExtras
                  item={programmes.find((p) => p.slug === 'aminia-kids')!}
                  content={content}
                  assets={assets}
                  portfolio={false}
                />
              </section>
            )}
            <KidsShowcase content={content} assets={assets} />
            <section className="soft-band">
              <div className="wrap">
                <h2>Interested in Aminia Kids?</h2>
                <p>Confirmed session and event details will be announced by the foundation.</p>
                <AppLink href="/contact?interest=aminia-kids" className="btn green">
                  Make a parent / guardian enquiry <ArrowUpRight size={17} />
                </AppLink>
              </div>
            </section>
          </>
        )}
        {['/stories', '/events', '/transparency', '/shop'].includes(path) && (
          <>
            <PageHero
              page={custom}
              content={content}
              assets={assets}
              label={path === '/transparency' ? 'ACCOUNTABILITY' : path.slice(1).toUpperCase()}
              title={
                path === '/stories'
                  ? 'A person. A family. A way to help.'
                  : path === '/events'
                    ? 'Coming together for hope.'
                    : path === '/shop'
                      ? 'Shop for Hope.'
                      : 'Trust grows through openness.'
              }
              text={
                path === '/transparency'
                  ? 'We are committed to integrity, accountability and open reporting to the communities and partners we serve.'
                  : path === '/shop'
                    ? 'AHF T-shirts, mugs and future collections: everyday items with a shared purpose. Confirmed products and order arrangements appear below.'
                    : undefined
              }
            />
            {path === '/stories' && (
              <section className="wrap section-space">
                <AppealCards items={stories.filter(personalHelp)} prefix="/stories/" />
                {!stories.some(personalHelp) && (
                  <div className="notice">
                    <h3>Personal appeals will appear here.</h3>
                    <p>
                      Reviewed stories will explain the support needed and confirmed ways to help.
                    </p>
                  </div>
                )}
              </section>
            )}
            <section className="wrap listing">
              {content
                .filter(
                  (c) =>
                    path !== '/stories' &&
                    c.kind ===
                      (
                        {
                          '/stories': 'story',
                          '/events': 'event',
                          '/transparency': 'report',
                          '/shop': 'product',
                        } as Record<string, string>
                      )[path],
                )
                .map((c) => (
                  <AppLink
                    href={(path === '/transparency' ? '/reports' : path) + '/' + c.slug}
                    className="listing-item"
                    key={c.id}
                  >
                    {c.kind === 'product' && <Photo item={c} assets={assets} />}
                    <div>
                      <p className="eyebrow">
                        {c.details.date || c.details.availability || c.kind}
                      </p>
                      <h2>{c.title}</h2>
                      <p>{c.summary}</p>
                    </div>
                    <ArrowUpRight size={24} />
                  </AppLink>
                ))}
              {!content.some(
                (c) =>
                  c.kind ===
                  (
                    {
                      '/stories': 'story',
                      '/events': 'event',
                      '/transparency': 'report',
                      '/shop': 'product',
                    } as Record<string, string>
                  )[path],
              ) && (
                <div className="notice">
                  <h3>
                    {path === '/events'
                      ? 'Announcements will appear here.'
                      : path === '/transparency'
                        ? 'Public documents are being prepared.'
                        : 'Merchandise details are coming soon.'}
                  </h3>
                  <p>
                    {path === '/transparency'
                      ? 'Registration documents are being prepared. Approved reports, policies and registration updates will be published as they become available.'
                      : path === '/shop'
                        ? 'Product availability, prices and order arrangements will be published once confirmed.'
                        : 'Visit again for confirmed dates and ways to participate.'}
                  </p>
                </div>
              )}
            </section>
          </>
        )}
        {path === '/transparency' && (
          <section className="wrap trust-grid section-space">
            <article>
              <h3>Our founding team</h3>
              <p>
                Four co-founders with defined responsibilities and a shared commitment to
                accountability.
              </p>
              <AppLink href="/about">Meet the team ↗</AppLink>
            </article>
            <article>
              <h3>Registration in progress</h3>
              <p>
                Registration documents are being prepared. Confirmed updates will be published here.
              </p>
            </article>
            <article>
              <h3>People before publicity</h3>
              <p>Reviewed stories, appropriate consent and restricted access to private records.</p>
              <AppLink href="/safeguarding">Safeguarding ↗</AppLink>
            </article>
          </section>
        )}
        {path === '/get-involved' && (
          <>
            <PageHero
              page={custom}
              content={content}
              assets={assets}
              label="YOUR PART IN THE STORY"
              title="Bring what you can. Build hope."
              text="Time, skills, ideas, partnerships and practical support all have a place."
            />
            <section className="wrap three-columns involved">
              {[
                ['Volunteer', 'Share your time or skills with the foundation.', 'volunteer'],
                [
                  'Partner with us',
                  'Explore collaboration around shared community priorities.',
                  'partner',
                ],
                [
                  'Support our work',
                  'Discuss a contribution, in-kind support or fundraising.',
                  'support',
                ],
              ].map(([a, b, c]) => (
                <article key={a}>
                  <HandHeart size={30} />
                  <h2>{a}</h2>
                  <p>{b}</p>
                  <AppLink
                    href={'/contact?interest=' + c}
                    data-engagement={c}
                    className="text-link"
                  >
                    Start a conversation <ArrowUpRight size={18} />
                  </AppLink>
                </article>
              ))}
            </section>
            <section className="wrap ways-grid">
              <AppLink href="/donate">
                <Heart />
                <h3>Give to a campaign</h3>
                <p>Support an approved need through its giving link.</p>
              </AppLink>
              <AppLink href="/aminia-kids" data-engagement="kids">
                <Music />
                <h3>Support creativity</h3>
                <p>Help Aminia Kids learn, express and grow.</p>
              </AppLink>
              <AppLink href="/shop">
                <Leaf />
                <h3>Shop for Hope</h3>
                <p>Explore merchandise supporting the foundation.</p>
              </AppLink>
            </section>
            <div className="wrap section-space">
              <AppLink href="/shop" className="listing-item">
                <h3>Shop for Hope · merchandise fundraising</h3>
                <span>Visit Shop for Hope ↗</span>
              </AppLink>
            </div>
          </>
        )}
        {path === '/donate' && (
          <>
            <PageHero
              page={custom}
              content={content}
              assets={assets}
              label="A GIFT OF POSSIBILITY"
              title="Help hope take root."
              text="Support practical, community-based work with children, families and communities."
            />
            <section className="split-content wrap">
              <div className="donation-panel">
                <Heart size={42} strokeWidth={1.2} />
                <h2>
                  Give with <em>confidence.</em>
                </h2>
                <p>
                  {settings.donate_intro ||
                    'Choose how you would like to support children, families and communities.'}
                </p>
                <DonationMethods settings={settings} />
                <h3>Support an approved campaign</h3>
                {content
                  .filter((c) => c.kind === 'campaign')
                  .map((c) => (
                    <AppLink className="listing-item" key={c.id} href={'/campaigns/' + c.slug}>
                      <span>{c.title}</span>
                      <ArrowUpRight size={18} />
                    </AppLink>
                  ))}
              </div>
              <div className="prose">
                <p className="eyebrow">FAITH IN ACTION</p>
                <h2>Generosity can bring hope.</h2>
                <p>
                  Your gift supports practical, community-based work with children, families and
                  communities. Together, we can help create opportunities and share hope with
                  dignity.
                </p>
                <blockquote>
                  “Let all that you do be done in love.” <cite>1 Corinthians 16:14</cite>
                </blockquote>
                <p>We are committed to accountability and sharing updates as our work grows.</p>
                <AppLink className="text-link" href="/transparency">
                  Our commitment to accountability ↗
                </AppLink>
              </div>
            </section>
          </>
        )}
        {path === '/impact' && (
          <>
            <PageHero
              page={custom}
              content={content}
              assets={assets}
              label="IMPACT & LEARNING"
              title="Meaningful change. Honest reporting."
              text="We are committed to learning from our work and sharing reviewed results with the communities and partners we serve."
            />
            <section className="wrap prose narrow">
              <h2>Accountability begins with care.</h2>
              <p>
                Our programme areas include monitoring and accountability. Verified public results
                and approved reports will be published as they become available.
              </p>
              <p>
                We do not present programme goals as achieved results or publish private beneficiary
                records to demonstrate impact.
              </p>
              <AppLink className="text-link" href="/transparency">
                Explore public reports ↗
              </AppLink>
            </section>
          </>
        )}
        {path === '/contact' && (
          <>
            <PageHero
              page={custom}
              content={content}
              assets={assets}
              label="LET’S BEGIN WITH A CONVERSATION"
              title="Hope is something we build together."
            />
            <section className="contact-layout wrap">
              <div>
                <p className="eyebrow">WHERE WE WORK</p>
                <h2>
                  Entebbe.
                  <br />
                  Katabi. Busabaga.
                </h2>
                <p>Wakiso District, Uganda.</p>
                <p>
                  {settings.contact_email || settings.contact_phone || settings.contact_address ? (
                    <>
                      {settings.contact_email && (
                        <AppLink href={'mailto:' + settings.contact_email}>
                          {settings.contact_email}
                        </AppLink>
                      )}
                      <br />
                      {settings.contact_phone}
                      <br />
                      {settings.contact_address}
                    </>
                  ) : (
                    'Official telephone, email and office address will be published once confirmed.'
                  )}
                </p>
                <p className="fine">
                  Please do not include sensitive beneficiary information in a general website
                  enquiry.
                </p>
              </div>
              <EnquiryForm />
            </section>
          </>
        )}
        {path === '/privacy' && !custom && (
          <>
            <PageHero
              page={custom}
              content={content}
              assets={assets}
              label="PRIVACY"
              title="Respect for people includes their information."
            />
            <section className="wrap prose narrow">
              <p>
                When you submit an enquiry, Aminia Hope Foundation uses your name, contact details
                and message to respond and manage that enquiry. Access is restricted to authorized
                staff. Submitting an enquiry does not subscribe you to marketing.
              </p>
              <p>
                Please do not submit children’s names, identity documents, medical information or
                sensitive case details through the public website. Parent or guardian enquiries
                about Aminia Kids should use the adult’s contact details.
              </p>
              <p>
                Enquiry confirmation emails are sent through our configured email provider. Optional
                visitor analytics runs only after you allow it. It records a pseudonymous browser
                identifier, session/page history, timestamps, device/browser category, referrer
                hostname and approximate country, region and city for up to 30 days. It does not
                record names, raw IP addresses, GPS coordinates, query strings or enquiry contents.
                You may decline without losing access to any service, or use Privacy preferences to
                withdraw permission and delete this browser’s recorded history. A private keyed
                deletion marker is retained for up to 30 days to stop queued requests recreating
                deleted history; it contains no page history. Locations can be inaccurate; visitors
                who decline or use Do Not Track are not represented. A short-lived daily hashed
                security tag limits abuse. The enquiry service uses Cloudflare Turnstile for abuse
                prevention. Security checks may process technical information such as an IP address.
                The foundation’s contact details, retention schedule and full privacy policy will be
                confirmed before operational launch.
              </p>
            </section>
          </>
        )}
        {path === '/safeguarding' && !custom && (
          <>
            <PageHero
              page={custom}
              content={content}
              assets={assets}
              label="DIGNITY & WELL-BEING"
              title="Children and communities come first."
            />
            <section className="wrap prose narrow">
              <p>
                Child protection and well-being are among the foundation’s programme areas.
                Children’s photographs and stories must be reviewed for appropriate consent before
                publication.
              </p>
              <p>
                Public galleries do not provide participant lists, children’s contact details or
                individual schedules. Safeguarding procedures and a confirmed private reporting
                channel are being prepared and will be published once approved.
              </p>
            </section>
          </>
        )}
        {(item || (custom && !templatePages.includes(bits[0]))) && (
          <>
            <PageHero
              label={item?.kind || 'FOUNDATION'}
              title={(item || custom)!.title}
              text={(item || custom)!.summary}
            />
            <article className="wrap article prose">
              {(item || custom)?.kind !== 'report' &&
              ((item || custom)?.cover_id ||
                (item || custom)?.details.image ||
                item?.kind === 'product') ? (
                <Photo item={(item || custom)!} assets={assets} />
              ) : null}
              {(item || custom)?.details.date && (
                <p className="eyebrow">
                  {new Date((item || custom)!.details.date).toLocaleString('en-GB', {
                    timeZone: 'Africa/Kampala',
                  })}{' '}
                  · {(item || custom)!.details.location}
                </p>
              )}
              {para((item || custom)!.body)}
              <ContentExtras item={(item || custom)!} content={content} assets={assets} />
              {item?.kind === 'report' && item.cover_id && (
                <AppLink
                  className="btn green"
                  href={'/media/' + item.cover_id}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the approved report ↗
                </AppLink>
              )}
              {(item || custom)!.details.link && (
                <AppLink
                  className="btn green"
                  href={(item || custom)!.details.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open document / details ↗
                </AppLink>
              )}
              {item?.kind === 'programme' && (
                <AppLink href="/get-involved" className="text-link">
                  Get involved ↗
                </AppLink>
              )}
            </article>
          </>
        )}
      </main>
      <section className="closing-band">
        <div className="wrap">
          <div>
            <p className="eyebrow">A LITTLE BELIEF CAN GO A LONG WAY</p>
            <h2>
              A brighter future
              <br />
              starts <em>with us.</em>
            </h2>
          </div>
          <AppLink href="/get-involved" className="btn cream">
            Find your way to help <ArrowUpRight size={20} />
          </AppLink>
        </div>
      </section>
      <footer className="site-footer wrap">
        <div className="footer-top">
          <AppLink href="/" className="brand">
            <AppImage src="/images/brand-991c0b4ae252.webp" alt="" />
          </AppLink>
          <p>
            Empowering people.
            <br />
            Strengthening communities.
            <br />
            Building a brighter future.
          </p>
          <div>
            <h3>Explore</h3>
            <AppLink href="/about">About AHF</AppLink>
            <AppLink href="/programmes">Our programmes</AppLink>
            <AppLink href="/aminia-kids">Aminia Kids</AppLink>
          </div>
          <div>
            <h3>Connect</h3>
            <AppLink href="/contact">Contact</AppLink>
            {[
              ['Facebook', 'facebook_url'],
              ['Instagram', 'instagram_url'],
              ['LinkedIn', 'linkedin_url'],
            ]
              .filter(([, key]) => settings[key])
              .map(([label, key]) => (
                <AppLink key={key} href={settings[key]} target="_blank" rel="noopener noreferrer">
                  {label} ↗
                </AppLink>
              ))}
            <AppLink href="/get-involved">Get involved</AppLink>
            <AppLink href="/transparency">Transparency</AppLink>
            <AppLink href="/impact">Impact & learning</AppLink>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Aminia Hope Foundation · Entebbe, Uganda</span>
          <div>
            <AppLink href="/privacy">Privacy</AppLink>
            <AppLink href="/safeguarding">Safeguarding</AppLink>
            <AppLink href="/holyghost">Staff sign-in</AppLink>
          </div>
        </div>
      </footer>
    </>
  );
}
