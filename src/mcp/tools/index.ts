import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GoogleAuth } from 'google-auth-library';
import { gmailList, gmailRead, gmailSend } from './gmail';
import { gmailAdminDispatch, GMAIL_ADMIN_ACTIONS } from './gmailAdmin';
import { calendarListEvents, calendarGetEvent } from './calendar';
import { calendarAdminDispatch, CALENDAR_ADMIN_ACTIONS } from './calendarAdmin';
import { driveList, driveSearch } from './drive';
import { driveAdminDispatch, DRIVE_ADMIN_ACTIONS } from './driveAdmin';
import { docsRead } from './docs';
import { docsAdminDispatch, DOCS_ADMIN_ACTIONS } from './docsAdmin';
import { sheetsRead } from './sheets';
import { sheetsAdminDispatch, SHEETS_ADMIN_ACTIONS } from './sheetsAdmin';

function sanitizeToolError(err: unknown): string {
    if (!(err instanceof Error)) return 'An unexpected error occurred.';
    const msg = err.message;
    if (msg.includes('UNAUTHENTICATED') || msg.includes('Could not load the default credentials')) {
        return 'Authentication failed. Please re-run the Google Workspace MCP setup wizard.';
    }
    if (msg.includes('PERMISSION_DENIED') || msg.includes('insufficient')) {
        return 'Permission denied. Ensure your Google account has the required API access and scopes.';
    }
    if (msg.includes('NOT_FOUND') || msg.includes('notFound')) {
        return 'Resource not found. Check that the ID is correct and accessible.';
    }
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('rateLimitExceeded')) {
        return 'API quota exceeded. Please wait a moment and try again.';
    }
    if (msg.includes('INVALID_ARGUMENT') || msg.includes('invalidArgument')) {
        return 'Invalid request parameters. Check the values and try again.';
    }
    return msg
        .replace(/projects\/[^\s/]+/g, 'projects/***')
        .replace(/\/home\/[^\s/]+/g, '/home/***')
        .replace(/\/Users\/[^\s/]+/g, '/Users/***')
        .replace(/at\s+.+\(.+:\d+:\d+\)/g, '')
        .trim() || 'An unexpected error occurred.';
}

function safeTool<T>(handler: (params: T) => Promise<{ content: { type: 'text'; text: string }[] }>):
    (params: T) => Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
    return async (params: T) => {
        try {
            return await handler(params);
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: sanitizeToolError(err) }],
                isError: true,
            };
        }
    };
}

export function registerAllTools(
    server: McpServer,
    readAuth: GoogleAuth,
    writeAuth: GoogleAuth
): void {
    // ── Health ─────────────────────────────────────────────────────
    server.tool('ping', 'Checks server connectivity and auth status', {}, async () => ({
        content: [{ type: 'text', text: 'pong' }]
    }));

    // ── Gmail reads ───────────────────────────────────────────────
    server.tool('gmail_list', 'Lists recent emails from Gmail inbox with metadata (from, to, subject, date, snippet).', {
        max_results: z.number().optional().describe('Max messages to return (default 20)'),
        query: z.string().optional().describe('Gmail search query (e.g. "is:unread", "from:user@example.com")'),
        label_ids: z.array(z.string()).optional().describe('Filter by label IDs (e.g. ["INBOX", "UNREAD"])'),
    }, safeTool(async (params) => {
        const result = await gmailList(readAuth, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }));

    server.tool('gmail_read', 'Reads a full email message by ID — returns headers, body text, and attachment list.', {
        message_id: z.string().describe('Gmail message ID'),
    }, safeTool(async ({ message_id }) => {
        const result = await gmailRead(readAuth, message_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }));

    server.tool('gmail_search', 'Searches Gmail using query syntax — returns matching messages with metadata.', {
        query: z.string().describe('Gmail search query (same syntax as Gmail search bar)'),
        max_results: z.number().optional().describe('Max results (default 20)'),
    }, safeTool(async ({ query, max_results }) => {
        const result = await gmailList(readAuth, { query, max_results });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }));

    server.tool('gmail_send', 'Sends an email from your Gmail account.', {
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject line'),
        body: z.string().describe('Plain text email body'),
        cc: z.string().optional().describe('CC recipients'),
        bcc: z.string().optional().describe('BCC recipients'),
    }, safeTool(async (params) => {
        const result = await gmailSend(writeAuth, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }));

    // ── Calendar reads ────────────────────────────────────────────
    server.tool('calendar_list_events', 'Lists upcoming calendar events with attendees, location, and times.', {
        calendar_id: z.string().optional().describe('Calendar ID (default: primary)'),
        time_min: z.string().optional().describe('Start time in ISO 8601 (default: now)'),
        time_max: z.string().optional().describe('End time in ISO 8601'),
        max_results: z.number().optional().describe('Max events (default 25)'),
        query: z.string().optional().describe('Free-text search query'),
    }, safeTool(async (params) => {
        const result = await calendarListEvents(readAuth, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }));

    server.tool('calendar_get_event', 'Gets full details of a single calendar event by ID.', {
        event_id: z.string().describe('Calendar event ID'),
        calendar_id: z.string().optional().describe('Calendar ID (default: primary)'),
    }, safeTool(async ({ event_id, calendar_id }) => {
        const result = await calendarGetEvent(readAuth, event_id, calendar_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }));

    // ── Drive reads ───────────────────────────────────────────────
    server.tool('drive_list', 'Lists files in Google Drive, optionally filtered by folder.', {
        folder_id: z.string().optional().describe('Folder ID to list (default: root)'),
        max_results: z.number().optional().describe('Max files (default 25)'),
        page_token: z.string().optional().describe('Pagination token'),
    }, safeTool(async (params) => {
        const result = await driveList(readAuth, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }));

    server.tool('drive_search', 'Searches Google Drive files by content or name.', {
        query: z.string().describe('Search query (searches file content and names)'),
        max_results: z.number().optional().describe('Max results (default 25)'),
    }, safeTool(async ({ query, max_results }) => {
        const result = await driveSearch(readAuth, query, max_results);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }));

    // ── Docs read ─────────────────────────────────────────────────
    server.tool('docs_read', 'Reads the full text content of a Google Doc by document ID.', {
        document_id: z.string().describe('Google Docs document ID'),
    }, safeTool(async ({ document_id }) => {
        const result = await docsRead(readAuth, document_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }));

    // ── Sheets read ───────────────────────────────────────────────
    server.tool('sheets_read', 'Reads data from a Google Sheet — returns cell values for a range, or sheet metadata if no range specified.', {
        spreadsheet_id: z.string().describe('Google Sheets spreadsheet ID'),
        range: z.string().optional().describe('A1 notation range (e.g. "Sheet1!A1:D10"). Omit for sheet metadata.'),
    }, safeTool(async (params) => {
        const result = await sheetsRead(readAuth, params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }));

    // ── Gmail Admin mega-tool ─────────────────────────────────────
    server.tool('gmail_admin',
        'Gmail administration. ' +
        'Actions: create_draft(to, subject, body), update_draft(draft_id, to, subject, body), ' +
        'add_label(message_id, label_id), remove_label(message_id, label_id), ' +
        'create_label(name), mark_read(message_id), mark_unread(message_id), untrash(message_id). ' +
        'Destructive (confirm:true): delete_draft(draft_id), delete_label(label_id), trash(message_id).',
        {
            action: z.enum(GMAIL_ADMIN_ACTIONS as unknown as [string, ...string[]]).describe('Admin action'),
            params: z.record(z.unknown()).optional().describe('Action parameters'),
        },
        safeTool(async ({ action, params }) => {
            const result = await gmailAdminDispatch(writeAuth, action as any, params ?? {});
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    // ── Calendar Admin mega-tool ──────────────────────────────────
    server.tool('calendar_admin',
        'Google Calendar administration. ' +
        'Actions: create_event(summary, start_time, end_time, description?, location?, attendees?, calendar_id?, time_zone?), ' +
        'update_event(event_id, summary?, start_time?, end_time?, description?, location?, calendar_id?), ' +
        'list_calendars(), create_calendar(summary, description?, time_zone?). ' +
        'Destructive (confirm:true): delete_event(event_id, calendar_id?).',
        {
            action: z.enum(CALENDAR_ADMIN_ACTIONS as unknown as [string, ...string[]]).describe('Admin action'),
            params: z.record(z.unknown()).optional().describe('Action parameters'),
        },
        safeTool(async ({ action, params }) => {
            const result = await calendarAdminDispatch(writeAuth, action as any, params ?? {});
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    // ── Drive Admin mega-tool ─────────────────────────────────────
    server.tool('drive_admin',
        'Google Drive administration. ' +
        'Actions: create_folder(name, parent_id?), move(file_id, destination_folder_id), ' +
        'copy(file_id, new_name?, destination_folder_id?), rename(file_id, new_name), ' +
        'share(file_id, email, role?, type?, notify?), unshare(file_id, permission_id), get_permissions(file_id). ' +
        'Destructive (confirm:true): delete(file_id).',
        {
            action: z.enum(DRIVE_ADMIN_ACTIONS as unknown as [string, ...string[]]).describe('Admin action'),
            params: z.record(z.unknown()).optional().describe('Action parameters'),
        },
        safeTool(async ({ action, params }) => {
            const result = await driveAdminDispatch(writeAuth, action as any, params ?? {});
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    // ── Docs Admin mega-tool ──────────────────────────────────────
    server.tool('docs_admin',
        'Google Docs administration. ' +
        'Actions: create(title), append_text(document_id, text), ' +
        'insert_text(document_id, text, index?), replace_text(document_id, find, replace, match_case?). ' +
        'Destructive (confirm:true): delete_content(document_id, start_index, end_index).',
        {
            action: z.enum(DOCS_ADMIN_ACTIONS as unknown as [string, ...string[]]).describe('Admin action'),
            params: z.record(z.unknown()).optional().describe('Action parameters'),
        },
        safeTool(async ({ action, params }) => {
            const result = await docsAdminDispatch(writeAuth, action as any, params ?? {});
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    // ── Sheets Admin mega-tool ────────────────────────────────────
    server.tool('sheets_admin',
        'Google Sheets administration. ' +
        'Actions: create(title), append_rows(spreadsheet_id, range, values, value_input_option?), ' +
        'update_cells(spreadsheet_id, range, values, value_input_option?), ' +
        'add_sheet(spreadsheet_id, title). ' +
        'Destructive (confirm:true): delete_sheet(spreadsheet_id, sheet_id), clear_range(spreadsheet_id, range).',
        {
            action: z.enum(SHEETS_ADMIN_ACTIONS as unknown as [string, ...string[]]).describe('Admin action'),
            params: z.record(z.unknown()).optional().describe('Action parameters'),
        },
        safeTool(async ({ action, params }) => {
            const result = await sheetsAdminDispatch(writeAuth, action as any, params ?? {});
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );
}
