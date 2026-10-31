import { createDpoRequest, parseDpoToken, dpoCheckoutUrl } from './dpo-checkout.ts';
import { verifyDpoResponse } from './dpo-verification.ts';
import { uuidPattern } from './editorial.ts';

const endpoint = 'https://secure.3gdirectpay.com/API/v6/';
type Transport = (url: string, init: RequestInit) => Promise<Response>;
async function request(xml: string, transport: Transport): Promise<string> {
  let response: Response;
  try {
    response = await transport(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8', Accept: 'application/xml' },
      body: xml,
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
  } catch {
    throw Error('Payment provider is unavailable. Check the transaction before retrying.');
  }
  if (!response.ok || !response.body)
    throw Error('Payment provider is unavailable. Check the transaction before retrying.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0,
    text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64000) {
        await reader.cancel();
        throw Error('Payment provider response is invalid.');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch {
    throw Error('Payment provider response is invalid.');
  } finally {
    reader.releaseLock();
  }
}
export async function createDpoCheckout(
  input: Parameters<typeof createDpoRequest>[0],
  transport: Transport = fetch,
) {
  const response = await request(createDpoRequest(input), transport);
  const token = parseDpoToken(response);
  return { token, checkoutUrl: dpoCheckoutUrl(token) };
}
export async function verifyDpoPayment(
  input: { companyToken: string; token: string; amountMinor: number; currency: 'UGX' | 'USD' },
  transport: Transport = fetch,
) {
  return verify(input, false, transport);
}

/** Call only after the verified payment has been durably recorded. */
export async function acknowledgeDpoPayment(
  input: { companyToken: string; token: string; amountMinor: number; currency: 'UGX' | 'USD' },
  transport: Transport = fetch,
) {
  return verify(input, true, transport);
}

async function verify(
  input: { companyToken: string; token: string; amountMinor: number; currency: 'UGX' | 'USD' },
  acknowledge: boolean,
  transport: Transport,
) {
  if (!uuidPattern.test(input.companyToken) || !uuidPattern.test(input.token))
    throw Error('Invalid payment configuration.');
  const xml = `<?xml version="1.0" encoding="utf-8"?><API3G><CompanyToken>${input.companyToken}</CompanyToken><Request>verifyToken</Request><TransactionToken>${input.token}</TransactionToken><VerifyTransaction>${acknowledge ? '1' : '0'}</VerifyTransaction></API3G>`;
  const response = await request(xml, transport);
  return verifyDpoResponse(response, { amountMinor: input.amountMinor, currency: input.currency });
}
