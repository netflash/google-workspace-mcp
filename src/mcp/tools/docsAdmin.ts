import { docs } from '@googleapis/docs';
import { GoogleAuth } from 'google-auth-library';

const DOCS_ADMIN_ACTIONS = [
    'create', 'append_text', 'insert_text', 'replace_text', 'delete_content',
] as const;

export type DocsAdminAction = typeof DOCS_ADMIN_ACTIONS[number];
export { DOCS_ADMIN_ACTIONS };

const DESTRUCTIVE_ACTIONS: DocsAdminAction[] = ['delete_content'];

export async function docsAdminDispatch(
    auth: GoogleAuth,
    action: DocsAdminAction,
    params: Record<string, unknown>
): Promise<unknown> {
    if (DESTRUCTIVE_ACTIONS.includes(action) && params.confirm !== true) {
        return {
            warning: `DESTRUCTIVE ACTION: ${action}`,
            target: String(params.document_id ?? 'unknown'),
            message: 'This cannot be undone. Call again with confirm: true to proceed.',
            confirm_required: true,
        };
    }

    const docsClient = docs({ version: 'v1', auth: auth as any });

    switch (action) {
        case 'create': {
            const res = await docsClient.documents.create({
                requestBody: { title: params.title as string },
            });
            return { documentId: res.data.documentId, title: res.data.title };
        }

        case 'append_text': {
            // Get current document length
            const doc = await docsClient.documents.get({ documentId: params.document_id as string });
            const endIndex = doc.data.body?.content?.at(-1)?.endIndex ?? 1;

            const res = await docsClient.documents.batchUpdate({
                documentId: params.document_id as string,
                requestBody: {
                    requests: [{
                        insertText: {
                            location: { index: endIndex - 1 },
                            text: params.text as string,
                        },
                    }],
                },
            });
            return { documentId: res.data.documentId, replies: res.data.replies };
        }

        case 'insert_text': {
            const res = await docsClient.documents.batchUpdate({
                documentId: params.document_id as string,
                requestBody: {
                    requests: [{
                        insertText: {
                            location: { index: (params.index as number) ?? 1 },
                            text: params.text as string,
                        },
                    }],
                },
            });
            return { documentId: res.data.documentId, replies: res.data.replies };
        }

        case 'replace_text': {
            const res = await docsClient.documents.batchUpdate({
                documentId: params.document_id as string,
                requestBody: {
                    requests: [{
                        replaceAllText: {
                            containsText: {
                                text: params.find as string,
                                matchCase: (params.match_case as boolean) ?? true,
                            },
                            replaceText: params.replace as string,
                        },
                    }],
                },
            });
            return { documentId: res.data.documentId, replies: res.data.replies };
        }

        case 'delete_content': {
            const res = await docsClient.documents.batchUpdate({
                documentId: params.document_id as string,
                requestBody: {
                    requests: [{
                        deleteContentRange: {
                            range: {
                                startIndex: (params.start_index as number) ?? 1,
                                endIndex: params.end_index as number,
                            },
                        },
                    }],
                },
            });
            return { documentId: res.data.documentId, replies: res.data.replies };
        }

        default: {
            const _exhaustive: never = action;
            throw new Error(`Unknown docs admin action: ${_exhaustive}`);
        }
    }
}
