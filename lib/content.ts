import { extraKeys, fundraisingUrl, uuidPattern } from './editorial.ts';
export type Kind =
  | 'page'
  | 'programme'
  | 'story'
  | 'event'
  | 'report'
  | 'campaign'
  | 'product'
  | 'album';
export const kinds: Kind[] = [
  'page',
  'programme',
  'story',
  'event',
  'report',
  'campaign',
  'product',
  'album',
];
export type Content = {
  id: string;
  kind: Kind;
  slug: string;
  title: string;
  summary: string;
  body: string;
  cover_id?: string | null;
  details: Record<string, string>;
  status?: string;
  effective_status?: string;
  live_since?: string;
  version?: number;
  created_by?: string;
  scheduled_at?: string;
  updated_at?: string;
};
export const vision =
  'Rooted in our faith in Jesus Christ, to break the cycle of poverty and transform lives through hope: hope for every family, a brighter future for every child, and restored hope and dignity for the elderly and the vulnerable.';
export const mission =
  'To share the gospel of Jesus Christ through evangelism and express His love through practical, community-based programmes supporting children, families and communities, serving with dignity and without discrimination.';
const programmes = [
  [
    'education',
    'Education & child development',
    'Opening doors to learning and a brighter future for every child.',
  ],
  [
    'protection',
    'Child protection & well-being',
    'Supporting the safety, dignity and well-being of children.',
  ],
  ['families', 'Family support', 'Strengthening the families at the heart of our communities.'],
  [
    'community',
    'Community development',
    'Listening, learning and working together for lasting change.',
  ],
  [
    'health',
    'Health, hygiene & basic needs',
    'Supporting healthier lives and access to everyday essentials.',
  ],
  [
    'skills',
    'Empowerment & skills',
    'Building skills, confidence and opportunities for economic empowerment.',
  ],
  [
    'partnerships',
    'Partnership & fundraising',
    'Bringing people and resources together to support community-based work.',
  ],
  [
    'accountability',
    'Monitoring & accountability',
    'Learning from our work and reporting openly to communities and partners.',
  ],
  [
    'aminia-kids',
    'Aminia Kids',
    'Dance, theatre and singing. Nurturing creativity, confidence and hope.',
  ],
];
export const seed: Content[] = [
  {
    id: 'home',
    kind: 'page',
    slug: 'home',
    title: 'Hope begins with believing.',
    summary: 'In every child. In every family. In the possibility of a brighter tomorrow.',
    body: 'Founded in October 2025, Aminia Hope Foundation is a community-based organization in Entebbe. We work alongside children, families and communities to break the cycle of poverty through practical action.',
    details: {},
  },
  {
    id: 'about',
    kind: 'page',
    slug: 'about',
    title: 'Believing in people. Building hope.',
    summary: 'Rooted in Jesus Christ. Serving our communities with love.',
    body: 'Aminia Hope Foundation is a community-based organization founded in October 2025 and based in Entebbe, Wakiso District, Uganda. We work in Katabi and Busabaga to empower communities and our country.\n\nWe are believers in Jesus Christ. Our faith inspires us to share the gospel through evangelism and express Christ’s love through compassionate, practical service. Support is offered without requiring religious participation or agreement with our beliefs.\n\n“Aminia” is a Swahili verb meaning to believe, to trust and to have confidence. It is the idea behind everything we do: when people believe in children, families and communities, poverty can be overcome.\n\nWe are committed to integrity, accountability and open reporting to the communities and partners we serve.',
    details: { vision, mission },
  },
  ...programmes.map(([slug, title, summary]) => ({
    id: slug,
    kind: 'programme' as const,
    slug,
    title,
    summary,
    body: summary,
    details: {},
  })),
  {
    id: 'ahf-tshirt',
    kind: 'product',
    slug: 'ahf-tshirt',
    title: 'The AHF T-shirt',
    summary: 'Wear the belief. A foundation-branded T-shirt concept for merchandise fundraising.',
    body: 'AHF-branded T-shirts are part of our merchandise fundraising plans. Enquire about designs, sizes and confirmed availability before placing an order.',
    details: {
      currency: 'UGX',
      availability: 'Enquire',
      variants: 'Sizes and colours to be confirmed',
      fulfilment: 'Collection, delivery and pricing will be confirmed by the foundation.',
      proceeds:
        'Merchandise fundraising is intended to support the foundation’s community-based work. The contribution from sales will be confirmed with the product details.',
    },
  },
  {
    id: 'ahf-mug',
    kind: 'product',
    slug: 'ahf-mug',
    title: 'A mug full of hope',
    summary: 'An everyday reminder of shared hope. Explore the AHF-branded mug concept.',
    body: 'AHF-branded mugs are being developed for merchandise fundraising. Contact us to discuss confirmed designs and order arrangements.',
    details: {
      currency: 'UGX',
      availability: 'Enquire',
      fulfilment:
        'Price, stock and collection or delivery arrangements will be confirmed before an order.',
      proceeds:
        'This planned fundraising product supports Aminia Hope Foundation. Confirmed fundraising information will be shared before sale.',
    },
  },
  {
    id: 'community-story',
    kind: 'story',
    slug: 'listening-learning-working-together',
    title: 'Listening, learning, working together',
    summary: 'Hope grows through relationships, shared ideas and community collaboration.',
    body: 'Our approach begins with listening. Aminia Hope Foundation brings people together around practical, community-based programmes for children, families and communities.\n\nWe believe in working alongside the people and partners who share our commitment to dignity and opportunity.',
    details: {
      image: '/images/team-collaboration.jpeg',
      caption: 'Team collaboration — photograph supplied by Aminia Hope Foundation.',
    },
  },
];
export const team = [
  ['Daniel Yeronimo', 'Chairperson'],
  ['Florence Esamu', 'Vice-Chairperson'],
  ['Sanle Esaie', 'Administrator'],
  ['Aziko Paula', 'Treasurer & Secretary'],
];
export function validateContent(v: unknown) {
  if (!v || typeof v !== 'object') throw Error('Content is required.');
  const x = v as Record<string, unknown>;
  if (!kinds.includes(x.kind as Kind)) throw Error('Choose a content type.');
  const string = (k: string, max: number) => {
    if (typeof x[k] !== 'string' || String(x[k]).length > max) throw Error('Invalid ' + k);
    return String(x[k]).trim();
  };
  const title = string('title', 180),
    slug = string('slug', 100);
  if (title.length < 3 || !/^([a-z0-9]+-)*[a-z0-9]+$/.test(slug))
    throw Error('Add a title and a lowercase URL slug.');
  const details = (x.details as Record<string, unknown>) || {};
  const clean: Record<string, string> = {};
  for (const k of [
    'vision',
    'mission',
    'date',
    'location',
    'link',
    'price',
    'currency',
    'caption',
    ...extraKeys,
  ])
    if (details[k] !== undefined) {
      if (
        typeof details[k] !== 'string' ||
        String(details[k]).length > (k === 'updates' ? 6000 : 3000)
      )
        throw Error('Invalid detail.');
      clean[k] = String(details[k]);
    }
  if (
    typeof details.image === 'string' &&
    ['/images/team-collaboration.jpeg', '/images/working-together.jpeg'].includes(details.image)
  )
    clean.image = details.image;
  if (clean.link && !/^https:\/\//.test(clean.link)) throw Error('Links must use HTTPS.');
  for (const [key, host] of Object.entries({
    pillar_url: 'pillar.io',
    spotfund_url: 'spotfund.com',
    gofundme_url: 'gofundme.com',
  }))
    if (clean[key] && !fundraisingUrl(clean[key], host))
      throw Error('Use a valid ' + host + ' campaign link.');
  for (const k of ['registration_url', 'facebook_url', 'instagram_url', 'linkedin_url'])
    if (clean[k] && !/^https:\/\//.test(clean[k])) throw Error('Links must use HTTPS.');
  for (const k of ['video_id', 'programme_id', 'campaign_id'])
    if (clean[k] && !uuidPattern.test(clean[k])) throw Error('Choose a valid related record.');
  if (clean.gallery) {
    let g;
    try {
      g = JSON.parse(clean.gallery);
    } catch {
      throw Error('Invalid gallery.');
    }
    if (
      !Array.isArray(g) ||
      g.length > 40 ||
      g.some((v) => typeof v !== 'string' || !uuidPattern.test(v))
    )
      throw Error('Choose up to 40 approved images.');
  }
  if (clean.updates) {
    let u;
    try {
      u = JSON.parse(clean.updates);
    } catch {
      throw Error('Invalid updates.');
    }
    if (
      !Array.isArray(u) ||
      u.length > 12 ||
      u.some(
        (v) =>
          !v ||
          typeof v.date !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(v.date) ||
          typeof v.text !== 'string' ||
          v.text.length > 1500,
      )
    )
      throw Error('Add dated progress updates.');
  }
  for (const k of ['date', 'end_date', 'figures_date'])
    if (clean[k] && isNaN(Date.parse(clean[k]))) throw Error('Enter valid dates.');
  if (clean.date && clean.end_date && Date.parse(clean.end_date) <= Date.parse(clean.date))
    throw Error('End time must follow start time.');
  for (const k of ['price', 'target', 'raised', 'capacity'])
    if (clean[k] && (!/^\d+(\.\d{1,2})?$/.test(clean[k]) || Number(clean[k]) > 1e12))
      throw Error('Enter a valid positive amount or capacity.');
  if (x.cover_id && !/^[0-9a-f-]{36}$/i.test(String(x.cover_id)))
    throw Error('Choose valid media.');
  return {
    kind: x.kind,
    title,
    slug,
    summary: string('summary', 1000),
    body: string('body', 30000),
    cover_id: x.cover_id || null,
    details: clean,
  };
}
export function csv(rows: unknown[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((v) => {
            const s = String(v ?? '');
            return '"' + (/^[\s]*[=+@-]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"';
          })
          .join(','),
      )
      .join('\r\n')
  );
}
