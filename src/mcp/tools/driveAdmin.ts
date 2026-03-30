import { drive } from '@googleapis/drive';
import { GoogleAuth } from 'google-auth-library';

const DRIVE_ADMIN_ACTIONS = [
    'create_folder', 'move', 'copy', 'rename', 'delete',
    'share', 'unshare', 'get_permissions',
] as const;

export type DriveAdminAction = typeof DRIVE_ADMIN_ACTIONS[number];
export { DRIVE_ADMIN_ACTIONS };

const DESTRUCTIVE_ACTIONS: DriveAdminAction[] = ['delete'];

export async function driveAdminDispatch(
    auth: GoogleAuth,
    action: DriveAdminAction,
    params: Record<string, unknown>
): Promise<unknown> {
    if (DESTRUCTIVE_ACTIONS.includes(action) && params.confirm !== true) {
        return {
            warning: `DESTRUCTIVE ACTION: ${action}`,
            target: String(params.file_id ?? 'unknown'),
            message: 'This cannot be undone. Call again with confirm: true to proceed.',
            confirm_required: true,
        };
    }

    const driveClient = drive({ version: 'v3', auth: auth as any });

    switch (action) {
        case 'create_folder': {
            const res = await driveClient.files.create({
                requestBody: {
                    name: params.name as string,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: params.parent_id ? [params.parent_id as string] : undefined,
                },
                fields: 'id, name, webViewLink',
            });
            return res.data;
        }

        case 'move': {
            const file = await driveClient.files.get({ fileId: params.file_id as string, fields: 'parents' });
            const previousParents = (file.data.parents ?? []).join(',');
            const res = await driveClient.files.update({
                fileId: params.file_id as string,
                addParents: params.destination_folder_id as string,
                removeParents: previousParents,
                fields: 'id, name, parents',
            });
            return res.data;
        }

        case 'copy': {
            const res = await driveClient.files.copy({
                fileId: params.file_id as string,
                requestBody: {
                    name: params.new_name as string | undefined,
                    parents: params.destination_folder_id ? [params.destination_folder_id as string] : undefined,
                },
                fields: 'id, name, webViewLink',
            });
            return res.data;
        }

        case 'rename': {
            const res = await driveClient.files.update({
                fileId: params.file_id as string,
                requestBody: { name: params.new_name as string },
                fields: 'id, name',
            });
            return res.data;
        }

        case 'delete': {
            await driveClient.files.delete({ fileId: params.file_id as string });
            return { deleted: true, file_id: params.file_id };
        }

        case 'share': {
            const res = await driveClient.permissions.create({
                fileId: params.file_id as string,
                requestBody: {
                    type: (params.type as string) ?? 'user',
                    role: (params.role as string) ?? 'reader',
                    emailAddress: params.email as string,
                },
                sendNotificationEmail: (params.notify as boolean) ?? true,
            });
            return { permissionId: res.data.id, role: res.data.role };
        }

        case 'unshare': {
            await driveClient.permissions.delete({
                fileId: params.file_id as string,
                permissionId: params.permission_id as string,
            });
            return { removed: true, permission_id: params.permission_id };
        }

        case 'get_permissions': {
            const res = await driveClient.permissions.list({
                fileId: params.file_id as string,
                fields: 'permissions(id, type, role, emailAddress, displayName)',
            });
            return res.data.permissions ?? [];
        }

        default: {
            const _exhaustive: never = action;
            throw new Error(`Unknown drive admin action: ${_exhaustive}`);
        }
    }
}
