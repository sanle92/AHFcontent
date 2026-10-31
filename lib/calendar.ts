export function calendarEvent(
  item: {
    id: string;
    title: string;
    summary: string;
    slug?: string;
    details: Record<string, string>;
  },
  origin: string,
) {
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const date = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  if (!item.details.date || isNaN(Date.parse(item.details.date)))
    throw Error('No confirmed event time.');
  const start = item.details.date,
    end = item.details.end_date || new Date(Date.parse(start) + 3600000).toISOString();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aminia Hope Foundation//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:' + item.id + '@aminiahope',
    'DTSTAMP:' + date(new Date().toISOString()),
    'DTSTART:' + date(start),
    'DTEND:' + date(end),
    'SUMMARY:' + escape(item.title),
    'DESCRIPTION:' +
      escape(
        item.summary +
          (item.details.end_date ? '' : '\nEnd time not confirmed; one-hour calendar placeholder.'),
      ),
    'LOCATION:' + escape(item.details.location || 'To be confirmed'),
    'URL:' + origin + '/events/' + encodeURIComponent(item.slug || ''),
    'STATUS:' + (item.details.event_status === 'Cancelled' ? 'CANCELLED' : 'CONFIRMED'),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return (
    lines
      .map((line) => {
        const result: string[] = [];
        let chunk = '';
        for (const char of line) {
          if (new TextEncoder().encode(chunk + char).length > 73) {
            result.push(chunk);
            chunk = ' ' + char;
          } else chunk += char;
        }
        result.push(chunk);
        return result.join('\r\n');
      })
      .join('\r\n') + '\r\n'
  );
}
