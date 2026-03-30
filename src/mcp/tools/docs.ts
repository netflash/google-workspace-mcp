import { docs } from '@googleapis/docs';
import { GoogleAuth } from 'google-auth-library';

export async function docsRead(auth: GoogleAuth, document_id: string) {
    const docsClient = docs({ version: 'v1', auth: auth as any });
    const res = await docsClient.documents.get({ documentId: document_id });
    let text = '';
    for (const element of res.data.body?.content ?? []) {
        if (element.paragraph) {
            for (const el of element.paragraph.elements ?? []) {
                text += el.textRun?.content ?? '';
            }
        }
    }
    return {
        title: res.data.title,
        documentId: res.data.documentId,
        text,
        revisionId: res.data.revisionId,
    };
}
