import AppImage from './app-image';
import AppLink from './app-link';
import type { Content } from '@/lib/content';
import { vision } from '@/lib/content';
import { ApprovedVideo } from './portfolio';
export const personalHelp = (s: Content) =>
  s.kind === 'story' &&
  (s.details.category === 'Personal help' ||
    !!s.details.campaign_id ||
    !!s.details.pillar_url ||
    !!s.details.spotfund_url ||
    !!s.details.gofundme_url);
export function AppealCards({ items, prefix }: { items: Content[]; prefix: string }) {
  return (
    <div className="appeal-grid">
      {items.map((i) => (
        <article className="appeal-card" key={i.id}>
          {i.details.video_id ? (
            <ApprovedVideo id={i.details.video_id} />
          ) : i.cover_id || i.details.image ? (
            <AppImage
              src={i.cover_id ? '/media/' + i.cover_id : i.details.image}
              alt={i.details.caption || i.title}
              loading="lazy"
            />
          ) : (
            <div className="appeal-symbol">
              ✦<span>Faith. Compassion. Hope.</span>
            </div>
          )}
          <div>
            <p className="eyebrow">{i.details.campaign_status || 'A CHANCE TO HELP'}</p>
            <h3>{i.title}</h3>
            <p>{i.summary}</p>
            <AppLink className="btn green" href={prefix + i.slug}>
              {i.details.button_label || 'Read the story & help'} ↗
            </AppLink>
          </div>
        </article>
      ))}
    </div>
  );
}
export default function HomeSections({
  content,
  campaignPage = 0,
  campaignsMore = false,
}: {
  content: Content[];
  campaignPage?: number;
  campaignsMore?: boolean;
}) {
  const campaigns = content.filter((i) => i.kind === 'campaign'),
    stories = content.filter(personalHelp),
    home = content.find((i) => i.kind === 'page' && i.slug === 'home'),
    faith = content.find((i) => i.kind === 'page' && i.slug === 'faith'),
    about = content.find((i) => i.kind === 'page' && i.slug === 'about'),
    kids = content.find((i) => i.kind === 'programme' && i.slug === 'aminia-kids');
  return (
    <>
      <section className="wrap section-space" id="campaigns">
        <p className="eyebrow">GIVE HOPE, ONE NEED AT A TIME</p>
        <div className="section-head">
          <h2>
            Find a cause.
            <br />
            <em>Make a difference.</em>
          </h2>
          <AppLink className="text-link" href="/donate">
            Explore ways to give ↗
          </AppLink>
        </div>
        {campaigns.length ? (
          <AppealCards items={campaigns} prefix="/campaigns/" />
        ) : (
          <div className="notice">
            <h3>Making room for hope.</h3>
            <p>
              Approved giving campaigns will appear here with the purpose, updates and verified
              giving links.
            </p>
            <AppLink href="/contact?interest=support" className="text-link">
              Discuss supporting AHF ↗
            </AppLink>
          </div>
        )}
        {(campaignPage > 0 || campaignsMore) && (
          <nav className="cms-actions" aria-label="Giving campaign pages">
            {campaignPage > 0 && (
              <AppLink href={'/?campaignPage=' + (campaignPage - 1) + '#campaigns'}>
                Previous campaigns
              </AppLink>
            )}
            <span>Campaign page {campaignPage + 1}</span>
            {campaignsMore && (
              <AppLink href={'/?campaignPage=' + (campaignPage + 1) + '#campaigns'}>
                More campaigns →
              </AppLink>
            )}
          </nav>
        )}
      </section>
      <section className="faith-section">
        <div className="wrap">
          <p className="eyebrow">SHARING THE GOSPEL. LIVING CHRIST’S LOVE.</p>
          <h2>
            {faith?.title || (
              <>
                Our hope is in <em>Jesus Christ.</em>
              </>
            )}
          </h2>
          {faith?.body ? (
            faith.body.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <>
              {' '}
              <p>
                We are believers in Jesus Christ. We share the gospel through evangelism and seek to
                express His love through compassion, service and practical care for children,
                families and communities.
              </p>
              <p>
                Our faith calls us to walk alongside people with humility and dignity. We offer
                support without requiring anyone to share our beliefs or participate in religious
                activities.
              </p>
            </>
          )}
          <AppLink href="/about" className="text-link">
            Our faith and our story ↗
          </AppLink>
        </div>
      </section>
      <section className="wrap section-space">
        <div className="section-head">
          <div>
            <p className="eyebrow">A STORY. A PERSON. A WAY TO HELP.</p>
            <h2>
              Compassion becomes
              <br />
              <em>personal.</em>
            </h2>
          </div>
          <AppLink className="text-link" href="/stories">
            Meet the people you can help ↗
          </AppLink>
        </div>
        {stories.length ? (
          <AppealCards items={stories} prefix="/stories/" />
        ) : (
          <div className="notice">
            <h3>Every story deserves care.</h3>
            <p>
              Reviewed personal appeals will appear here with a photograph or video, the support
              needed and a way to give. We share only details approved for public use.
            </p>
          </div>
        )}
      </section>
      <section className="wrap section-space">
        <div className="kids-panel">
          <div className="kids-art">
            {kids?.cover_id ? (
              <AppImage
                src={'/media/' + kids.cover_id}
                alt={kids.details.caption || 'Aminia Kids creative activities'}
                loading="lazy"
              />
            ) : (
              <>
                <span className="art-sun">✦</span>
                <span className="art-word">
                  Aminia
                  <br />
                  <em>Kids.</em>
                </span>
                <span className="art-notes">♫</span>
              </>
            )}
          </div>
          <div className="kids-copy">
            <p className="eyebrow">ROOM TO CREATE. CONFIDENCE TO GROW.</p>
            <h2>
              Little voices.
              <br />
              <em>God-given possibility.</em>
            </h2>
            <p>{kids?.summary}</p>
            {kids?.body && kids.body !== kids.summary ? (
              <p>{kids.body}</p>
            ) : (
              <>
                {' '}
                <p>
                  Every child has gifts waiting to be encouraged. A song, a dance or a moment on
                  stage can be a beginning: a chance to express an idea, practise with others and
                  discover the courage to try again.
                </p>
                <p>
                  Through Aminia Kids, we want children to feel valued, supported and hopeful about
                  what they can become.
                </p>
              </>
            )}
            <AppLink href="/aminia-kids" className="text-link">
              Discover Aminia Kids ↗
            </AppLink>
          </div>
        </div>
      </section>
      <section className="vision-band">
        <div className="wrap">
          <p className="eyebrow">OUR VISION</p>
          <h2>“{home?.details.vision || about?.details.vision || vision}”</h2>
          <span>Faith expressed through love and practical service.</span>
          {home?.details.mission && (
            <>
              <p className="eyebrow">OUR MISSION</p>
              <p>{home.details.mission}</p>
            </>
          )}
        </div>
      </section>
      <section className="focus-section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">HOPE, PUT INTO PRACTICE</p>
              <h2>
                Love expressed
                <br />
                <em>through action.</em>
              </h2>
            </div>
            <AppLink href="/programmes" className="text-link">
              Explore our work ↗
            </AppLink>
          </div>
          <div className="focus-grid">
            {content
              .filter((i) => i.kind === 'programme' && i.slug !== 'aminia-kids')
              .slice(0, 4)
              .map((i) => (
                <AppLink href={'/programmes/' + i.slug} className="focus-card" key={i.id}>
                  {(i.cover_id || i.details.image) && (
                    <AppImage
                      className="programme-cover"
                      src={i.cover_id ? '/media/' + i.cover_id : i.details.image}
                      alt={i.details.caption || i.title}
                    />
                  )}
                  <p className="eyebrow">{i.details.programme_status || 'PROGRAMME AREA'}</p>
                  <h3>{i.title}</h3>
                  <p>{i.summary}</p>
                  <span>Learn more ↗</span>
                </AppLink>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
