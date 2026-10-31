export function confirmationEmail(kind: string, reference: string, custom = '') {
  const topic: Record<string, string> = {
    volunteer: 'volunteering',
    partner: 'a partnership',
    support: 'supporting our work',
    'aminia-kids': 'Aminia Kids',
    merchandise: 'AHF merchandise',
    event: 'an AHF event',
    contact: 'the foundation',
  };
  return {
    subject: 'Aminia Hope Foundation — enquiry received',
    text:
      'Thank you for contacting Aminia Hope Foundation about ' +
      (topic[kind] || 'the foundation') +
      '.\n\nWe have received your enquiry. Our team will review it and contact you about the next steps.\n\nReference: ' +
      reference +
      '\n\n' +
      (custom ? custom + '\n\n' : '') +
      (kind === 'aminia-kids'
        ? 'This acknowledges your enquiry and does not confirm a child’s enrolment.\n\n'
        : kind === 'merchandise'
          ? 'This acknowledges your request and does not confirm stock, an order or payment.\n\n'
          : '') +
      'Please keep sensitive beneficiary or child information out of general email replies.\n\nAminia Hope Foundation\nEntebbe, Uganda',
  };
}
