import { gmail } from '@googleapis/gmail';
import { GoogleAuth } from 'google-auth-library';

export async function gmailList(auth: GoogleAuth, params: {
    max_results?: number;
    label_ids?: string[];
    query?: string;
}) {
    const gmailClient = gmail({ version: 'v1', auth: auth as any });
    const res = await gmailClient.users.messages.list({
        userId: 'me',
        maxResults: params.max_results ?? 20,
        labelIds: params.label_ids,
        q: params.query,
    });
    if (!res.data.messages?.length) return { messages: [], resultSizeEstimate: 0 };

    const messages = await Promise.all(
        res.data.messages.slice(0, params.max_results ?? 20).map(async (m: any) => {
            const detail = await gmailClient.users.messages.get({
                userId: 'me',
                id: m.id!,
                format: 'metadata',
                metadataHeaders: ['From', 'To', 'Subject', 'Date'],
            });
            const headers = detail.data.payload?.headers ?? [];
            return {
                id: m.id,
                threadId: m.threadId,
                snippet: detail.data.snippet,
                from: headers.find((h: any) => h.name === 'From')?.value,
                to: headers.find((h: any) => h.name === 'To')?.value,
                subject: headers.find((h: any) => h.name === 'Subject')?.value,
                date: headers.find((h: any) => h.name === 'Date')?.value,
                labelIds: detail.data.labelIds,
            };
        })
    );
    return { messages, resultSizeEstimate: res.data.resultSizeEstimate };
}

export async function gmailRead(auth: GoogleAuth, message_id: string) {
    const gmailClient = gmail({ version: 'v1', auth: auth as any });
    const res = await gmailClient.users.messages.get({
        userId: 'me',
        id: message_id,
        format: 'full',
    });
    const parts = res.data.payload?.parts ?? [];
    let body = '';
    const textPart = parts.find((p: any) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
    } else if (res.data.payload?.body?.data) {
        body = Buffer.from(res.data.payload.body.data, 'base64url').toString('utf-8');
    }
    const headers = res.data.payload?.headers ?? [];
    return {
        id: res.data.id,
        threadId: res.data.threadId,
        from: headers.find((h: any) => h.name === 'From')?.value,
        to: headers.find((h: any) => h.name === 'To')?.value,
        subject: headers.find((h: any) => h.name === 'Subject')?.value,
        date: headers.find((h: any) => h.name === 'Date')?.value,
        body,
        labelIds: res.data.labelIds,
        attachments: parts.filter((p: any) => p.filename).map((p: any) => ({
            filename: p.filename,
            mimeType: p.mimeType,
            size: p.body?.size,
        })),
    };
}

export async function gmailSend(auth: GoogleAuth, params: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
}) {
    const gmailClient = gmail({ version: 'v1', auth: auth as any });
    const headers = [
        `To: ${params.to}`,
        `Subject: ${params.subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
    ];
    if (params.cc) headers.push(`Cc: ${params.cc}`);
    if (params.bcc) headers.push(`Bcc: ${params.bcc}`);
    const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + params.body)
        .toString('base64url');
    const res = await gmailClient.users.messages.send({
        userId: 'me',
        requestBody: { raw },
    });
    return { id: res.data.id, threadId: res.data.threadId, labelIds: res.data.labelIds };
}
