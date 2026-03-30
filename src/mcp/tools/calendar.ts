import { calendar } from '@googleapis/calendar';
import { GoogleAuth } from 'google-auth-library';

export async function calendarListEvents(auth: GoogleAuth, params: {
    calendar_id?: string;
    time_min?: string;
    time_max?: string;
    max_results?: number;
    query?: string;
}) {
    const cal = calendar({ version: 'v3', auth: auth as any });
    const res = await cal.events.list({
        calendarId: params.calendar_id ?? 'primary',
        timeMin: params.time_min ?? new Date().toISOString(),
        timeMax: params.time_max,
        maxResults: params.max_results ?? 25,
        singleEvents: true,
        orderBy: 'startTime',
        q: params.query,
    });
    return {
        events: (res.data.items ?? []).map(e => ({
            id: e.id,
            summary: e.summary,
            description: e.description,
            location: e.location,
            start: e.start,
            end: e.end,
            attendees: e.attendees?.map(a => ({ email: a.email, responseStatus: a.responseStatus })),
            htmlLink: e.htmlLink,
            status: e.status,
        })),
        nextPageToken: res.data.nextPageToken,
    };
}

export async function calendarGetEvent(auth: GoogleAuth, event_id: string, calendar_id?: string) {
    const cal = calendar({ version: 'v3', auth: auth as any });
    const res = await cal.events.get({
        calendarId: calendar_id ?? 'primary',
        eventId: event_id,
    });
    return res.data;
}
