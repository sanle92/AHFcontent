import { config, published, json } from '@/lib/backend';
import { calendarEvent } from '@/lib/calendar';
export async function GET(r: Request) {
  try {
    const slug = new URL(r.url).searchParams.get('slug'),
      item = (await published()).find((i) => i.kind === 'event' && i.slug === slug);
    if (!item) return json({ error: 'Event not found' }, 404);
    return new Response(calendarEvent(item, config().origin || new URL(r.url).origin), {
      headers: {
        'Content-Type': 'text/calendar;charset=utf-8',
        'Content-Disposition': 'attachment; filename="AHF-event.ics"',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return json({ error: 'Confirmed event details are not available.' }, 400);
  }
}
