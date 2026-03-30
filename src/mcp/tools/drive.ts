import { drive } from '@googleapis/drive';
import { GoogleAuth } from 'google-auth-library';

export async function driveList(auth: GoogleAuth, params: {
    folder_id?: string;
    max_results?: number;
    page_token?: string;
}) {
    const driveClient = drive({ version: 'v3', auth: auth as any });
    const query = params.folder_id
        ? `'${params.folder_id}' in parents and trashed = false`
        : 'trashed = false';
    const res = await driveClient.files.list({
        q: query,
        pageSize: params.max_results ?? 25,
        pageToken: params.page_token,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents, webViewLink)',
        orderBy: 'modifiedTime desc',
    });
    return { files: res.data.files ?? [], nextPageToken: res.data.nextPageToken };
}

export async function driveSearch(auth: GoogleAuth, query: string, max_results?: number) {
    const driveClient = drive({ version: 'v3', auth: auth as any });
    const res = await driveClient.files.list({
        q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
        pageSize: max_results ?? 25,
        fields: 'files(id, name, mimeType, size, modifiedTime, parents, webViewLink)',
        orderBy: 'modifiedTime desc',
    });
    return { files: res.data.files ?? [] };
}
