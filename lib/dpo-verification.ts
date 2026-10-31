/** Strictly inspect the small set of fields needed to reconcile a DPO v6 verification response.
 * Reject XML features and duplicate tags; never treat a browser return value as proof of payment. */
export function verifyDpoResponse(
  xml: string,
  expected: { amountMinor: number; currency: 'UGX' | 'USD' },
) {
  if (xml.length > 64_000 || /<!|<\?|&/i.test(xml.replace(/^\s*<\?xml[^?]*\?>/i, '')))
    return { confirmed: false };
  const field = (key: string) => {
    const matches = [...xml.matchAll(new RegExp('<' + key + '>([^<]*)</' + key + '>', 'g'))];
    return matches.length === 1 ? matches[0][1].trim() : null;
  };
  if (!/^\s*(?:<\?xml[^?]*\?>\s*)?<API3G>[\s\S]*<\/API3G>\s*$/.test(xml))
    return { confirmed: false };
  const result = field('Result'),
    currency = field('TransactionCurrency'),
    amount = field('TransactionAmount');
  if (
    result !== '000' ||
    currency !== expected.currency ||
    !amount ||
    !/^\d+(?:\.\d{1,2})?$/.test(amount)
  )
    return { confirmed: false };
  const [whole, fraction = ''] = amount.split('.');
  const minor = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
  return {
    confirmed: Number.isSafeInteger(expected.amountMinor) && minor === BigInt(expected.amountMinor),
  };
}
