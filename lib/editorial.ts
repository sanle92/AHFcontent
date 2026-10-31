export const detailFields = {
  scope: 'Workspace',
  activity: 'Activity',
  programme_id: 'Related programme',
  campaign_id: 'Related giving campaign',
  programme_status: 'Programme stage',
  objectives: 'Objectives',
  activities: 'Activities',
  participation: 'Participation information',
  video_id: 'Approved featured video',
  gallery: 'Approved gallery media',
  campaign_status: 'Campaign status',
  button_label: 'Giving button label',
  pillar_url: 'Pillar.io campaign URL',
  spotfund_url: 'Spotfund campaign URL',
  gofundme_url: 'GoFundMe campaign URL',
  target: 'Fundraising target',
  raised: 'Amount raised (manually updated)',
  figures_date: 'Figures last checked',
  updates: 'Progress updates',
  end_date: 'End date/time (Kampala)',
  event_status: 'Event status',
  capacity: 'Capacity',
  registration_url: 'Registration URL',
  category: 'Category',
  reporting_period: 'Reporting period',
  document_version: 'Document version',
  variants: 'Sizes / colours / options',
  availability: 'Availability',
  fulfilment: 'Collection / delivery',
  proceeds: 'How sales support AHF',
  seo_title: 'Search title',
  seo_description: 'Search description',
  contact_email: 'Official public email',
  contact_phone: 'Official public telephone',
  contact_address: 'Official public address',
  facebook_url: 'Facebook URL',
  instagram_url: 'Instagram URL',
  linkedin_url: 'LinkedIn URL',
  confirmation_message: 'Enquiry confirmation message',
  donate_intro: 'Donate page introduction',
  donate_bank_name: 'Bank name',
  donate_bank_account_name: 'Bank account name',
  donate_bank_account_number: 'Bank account number',
  donate_bank_branch: 'Bank branch',
  donate_bank_swift: 'Bank SWIFT/BIC',
  donate_bank_currency: 'Bank account currency',
  donate_bank_instructions: 'Bank transfer instructions',
  donate_mtn_name: 'MTN merchant name',
  donate_mtn_code: 'MTN merchant code',
  donate_mtn_instructions: 'MTN payment instructions',
  donate_airtel_name: 'Airtel merchant name',
  donate_airtel_code: 'Airtel merchant code',
  donate_airtel_instructions: 'Airtel payment instructions',
} as const;
export const extraKeys = Object.keys(detailFields);
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function ids(value?: string): string[] {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === 'string' && uuidPattern.test(v)).slice(0, 40)
      : [];
  } catch {
    return [];
  }
}
export function updates(value?: string): { date: string; text: string }[] {
  try {
    const p = JSON.parse(value || '[]');
    return Array.isArray(p)
      ? p.filter((v) => typeof v.date === 'string' && typeof v.text === 'string').slice(0, 12)
      : [];
  } catch {
    return [];
  }
}
export function fundraisingUrl(value: string, platform: string) {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      (host === platform || host.endsWith('.' + platform))
    );
  } catch {
    return false;
  }
}
export function videoEmbed(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    let id = '';
    if (h === 'youtu.be') id = u.pathname.slice(1);
    if (h === 'youtube.com')
      id = u.pathname.startsWith('/shorts/')
        ? u.pathname.split('/')[2]
        : u.searchParams.get('v') || '';
    if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return 'https://www.youtube-nocookie.com/embed/' + id;
    if (h === 'vimeo.com' && /^\/\d{5,12}$/.test(u.pathname))
      return 'https://player.vimeo.com/video/' + u.pathname.slice(1);
    return null;
  } catch {
    return null;
  }
}
export const scopes = ['foundation', 'aminia-kids'];
