import { calendar } from '@googleapis/calendar';
import { GoogleAuth } from 'google-auth-library';

const CALENDAR_ADMIN_ACTIONS = [
    'create_event', 'update_event', 'delete_event',
    'list_calendars', 'create_calendar',
] as const;

export type CalendarAdminAction = typeof CALENDAR_ADMIN_ACTIONS[number];
export { CALENDAR_ADMIN_ACTIONS };

const DESTRUCTIVE_ACTIONS: CalendarAdminAction[] = ['delete_event'];

export async function calendarAdminDispatch(
    auth: GoogleAuth,
    action: CalendarAdminAction,
    params: Record<string, unknown>
): Promise<unknown> {
    if (DESTRUCTIVE_ACTIONS.includes(action) && params.confirm !== true) {
        return {
            warning: `DESTRUCTIVE ACTION: ${action}`,
            target: String(params.event_id ?? 'unknown'),
            message: 'This cannot be undone. Call again with confirm: true to proceed.',
            confirm_required: true,
        };
    }

    const cal = calendar({ version: 'v3', auth: auth as any });

    switch (action) {
        case 'create_event': {
            const res = await cal.events.insert({
                calendarId: (params.calendar_id as string) ?? 'primary',
                requestBody: {
                    summary: params.summary as string,
                    description: params.description as string | undefined,
                    location: params.location as string | undefined,
                    start: { dateTime: params.start_time as string, timeZone: params.time_zone as string | undefined },
                    end: { dateTime: params.end_time as string, timeZone: params.time_zone as string | undefined },
                    attendees: params.attendees
                        ? (params.attendees as string[]).map(email => ({ email }))
                        : undefined,
                },
            });
            return { id: res.data.id, htmlLink: res.data.htmlLink, summary: res.data.summary };
        }

        case 'update_event': {
            const updates: Record<string, unknown> = {};
            if (params.summary) updates.summary = params.summary;
            if (params.description) updates.description = params.description;
            if (params.location) updates.location = params.location;
            if (params.start_time) updates.start = { dateTime: params.start_time, timeZone: params.time_zone };
            if (params.end_time) updates.end = { dateTime: params.end_time, timeZone: params.time_zone };

            const res = await cal.events.patch({
                calendarId: (params.calendar_id as string) ?? 'primary',
                eventId: params.event_id as string,
                requestBody: updates,
            });
            return { id: res.data.id, htmlLink: res.data.htmlLink, summary: res.data.summary };
        }

        case 'delete_event': {
            await cal.events.delete({
                calendarId: (params.calendar_id as string) ?? 'primary',
                eventId: params.event_id as string,
            });
            return { deleted: true, event_id: params.event_id };
        }

        case 'list_calendars': {
            const res = await cal.calendarList.list();
            return (res.data.items ?? []).map(c => ({
                id: c.id,
                summary: c.summary,
                primary: c.primary,
                timeZone: c.timeZone,
                accessRole: c.accessRole,
            }));
        }

        case 'create_calendar': {
            const res = await cal.calendars.insert({
                requestBody: {
                    summary: params.summary as string,
                    description: params.description as string | undefined,
                    timeZone: params.time_zone as string | undefined,
                },
            });
            return { id: res.data.id, summary: res.data.summary };
        }

        default: {
            const _exhaustive: never = action;
            throw new Error(`Unknown calendar admin action: ${_exhaustive}`);
        }
    }
}
