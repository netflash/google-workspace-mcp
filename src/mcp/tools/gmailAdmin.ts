import { gmail } from '@googleapis/gmail';
import { GoogleAuth } from 'google-auth-library';

const GMAIL_ADMIN_ACTIONS = [
    'create_draft', 'update_draft', 'delete_draft',
    'add_label', 'remove_label', 'create_label', 'delete_label',
    'trash', 'untrash', 'mark_read', 'mark_unread',
] as const;

export type GmailAdminAction = typeof GMAIL_ADMIN_ACTIONS[number];
export { GMAIL_ADMIN_ACTIONS };

const DESTRUCTIVE_ACTIONS: GmailAdminAction[] = ['delete_draft', 'delete_label', 'trash'];

export async function gmailAdminDispatch(
    auth: GoogleAuth,
    action: GmailAdminAction,
    params: Record<string, unknown>
): Promise<unknown> {
    if (DESTRUCTIVE_ACTIONS.includes(action) && params.confirm !== true) {
        return {
            warning: `DESTRUCTIVE ACTION: ${action}`,
            target: String(params.message_id ?? params.label_id ?? params.draft_id ?? 'unknown'),
            message: 'This cannot be undone. Call again with confirm: true to proceed.',
            confirm_required: true,
        };
    }

    const gmailClient = gmail({ version: 'v1', auth: auth as any });

    switch (action) {
        case 'create_draft': {
            const headers = [
                `To: ${params.to}`,
                `Subject: ${params.subject}`,
                'Content-Type: text/plain; charset=utf-8',
                'MIME-Version: 1.0',
            ];
            const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + (params.body ?? ''))
                .toString('base64url');
            const res = await gmailClient.users.drafts.create({
                userId: 'me',
                requestBody: { message: { raw } },
            });
            return { id: res.data.id, message: res.data.message };
        }

        case 'update_draft': {
            const headers = [
                `To: ${params.to}`,
                `Subject: ${params.subject}`,
                'Content-Type: text/plain; charset=utf-8',
                'MIME-Version: 1.0',
            ];
            const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + (params.body ?? ''))
                .toString('base64url');
            const res = await gmailClient.users.drafts.update({
                userId: 'me',
                id: params.draft_id as string,
                requestBody: { message: { raw } },
            });
            return { id: res.data.id, message: res.data.message };
        }

        case 'delete_draft': {
            await gmailClient.users.drafts.delete({ userId: 'me', id: params.draft_id as string });
            return { deleted: true, draft_id: params.draft_id };
        }

        case 'add_label': {
            const res = await gmailClient.users.messages.modify({
                userId: 'me',
                id: params.message_id as string,
                requestBody: { addLabelIds: [params.label_id as string] },
            });
            return { id: res.data.id, labelIds: res.data.labelIds };
        }

        case 'remove_label': {
            const res = await gmailClient.users.messages.modify({
                userId: 'me',
                id: params.message_id as string,
                requestBody: { removeLabelIds: [params.label_id as string] },
            });
            return { id: res.data.id, labelIds: res.data.labelIds };
        }

        case 'create_label': {
            const res = await gmailClient.users.labels.create({
                userId: 'me',
                requestBody: {
                    name: params.name as string,
                    labelListVisibility: 'labelShow',
                    messageListVisibility: 'show',
                },
            });
            return { id: res.data.id, name: res.data.name };
        }

        case 'delete_label': {
            await gmailClient.users.labels.delete({ userId: 'me', id: params.label_id as string });
            return { deleted: true, label_id: params.label_id };
        }

        case 'trash': {
            const res = await gmailClient.users.messages.trash({ userId: 'me', id: params.message_id as string });
            return { id: res.data.id, labelIds: res.data.labelIds };
        }

        case 'untrash': {
            const res = await gmailClient.users.messages.untrash({ userId: 'me', id: params.message_id as string });
            return { id: res.data.id, labelIds: res.data.labelIds };
        }

        case 'mark_read': {
            const res = await gmailClient.users.messages.modify({
                userId: 'me',
                id: params.message_id as string,
                requestBody: { removeLabelIds: ['UNREAD'] },
            });
            return { id: res.data.id, labelIds: res.data.labelIds };
        }

        case 'mark_unread': {
            const res = await gmailClient.users.messages.modify({
                userId: 'me',
                id: params.message_id as string,
                requestBody: { addLabelIds: ['UNREAD'] },
            });
            return { id: res.data.id, labelIds: res.data.labelIds };
        }

        default: {
            const _exhaustive: never = action;
            throw new Error(`Unknown gmail admin action: ${_exhaustive}`);
        }
    }
}
