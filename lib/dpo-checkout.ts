import { uuidPattern } from './editorial.ts';

/** Build a DPO createToken request. This helper does not send it or activate checkout. */
export function createDpoRequest(input: {
  companyToken: string;
  serviceType: string;
  reference: string;
  amountMinor: number;
  currency: 'UGX' | 'USD';
  origin: string;
  now: Date;
}) {
  if (
    !uuidPattern.test(input.companyToken) ||
    !uuidPattern.test(input.reference) ||
    !/^\d{1,12}$/.test(input.serviceType)
  )
    throw Error('Invalid payment configuration.');
  if (
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor < 1 ||
    input.amountMinor > 100000000000 ||
    !['UGX', 'USD'].includes(input.currency)
  )
    throw Error('Invalid donation amount.');
  let origin: URL;
  try {
    origin = new URL(input.origin);
  } catch {
    throw Error('Invalid website origin.');
  }
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw Error('Invalid website origin.');
  if (!Number.isFinite(input.now.getTime())) throw Error('Invalid payment time.');
  const date = input.now.toISOString().slice(0, 16).replace(/-/g, '/').replace('T', ' ');
  const amount = `${Math.floor(input.amountMinor / 100)}.${String(input.amountMinor % 100).padStart(2, '0')}`;
  const returnUrl = `${origin.origin}/donate?payment=return`;
  return `<?xml version="1.0" encoding="utf-8"?><API3G><CompanyToken>${input.companyToken}</CompanyToken><Request>createToken</Request><Transaction><PaymentAmount>${amount}</PaymentAmount><PaymentCurrency>${input.currency}</PaymentCurrency><CompanyRef>${input.reference}</CompanyRef><CompanyRefUnique>1</CompanyRefUnique><RedirectURL>${returnUrl}</RedirectURL><BackURL>${returnUrl}</BackURL></Transaction><Services><Service><ServiceType>${input.serviceType}</ServiceType><ServiceDescription>Donation to Aminia Hope Foundation</ServiceDescription><ServiceDate>${date}</ServiceDate></Service></Services></API3G>`;
}

/** Only accept a single UUID token from a successful bounded provider response. */
export function parseDpoToken(xml: string): string {
  if (xml.length > 64000 || /<!|&/.test(xml)) throw Error('Invalid payment response.');
  if (!/^\s*(?:<\?xml[^?]*\?>\s*)?<API3G>[\s\S]*<\/API3G>\s*$/.test(xml))
    throw Error('Invalid payment response.');
  const field = (key: string) =>
    [...xml.matchAll(new RegExp('<' + key + '>([^<]*)</' + key + '>', 'g'))].map((m) =>
      m[1].trim(),
    );
  const result = field('Result'),
    token = field('TransToken');
  if (
    result.length !== 1 ||
    result[0] !== '000' ||
    token.length !== 1 ||
    !uuidPattern.test(token[0])
  )
    throw Error('Payment provider did not create a transaction.');
  return token[0];
}
export function dpoCheckoutUrl(token: string): string {
  if (!uuidPattern.test(token)) throw Error('Invalid payment token.');
  return 'https://secure.3gdirectpay.com/payv3.php?ID=' + encodeURIComponent(token);
}
