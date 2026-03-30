import { sheets } from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';

const SHEETS_ADMIN_ACTIONS = [
    'create', 'append_rows', 'update_cells', 'add_sheet', 'delete_sheet', 'clear_range',
] as const;

export type SheetsAdminAction = typeof SHEETS_ADMIN_ACTIONS[number];
export { SHEETS_ADMIN_ACTIONS };

const DESTRUCTIVE_ACTIONS: SheetsAdminAction[] = ['delete_sheet', 'clear_range'];

export async function sheetsAdminDispatch(
    auth: GoogleAuth,
    action: SheetsAdminAction,
    params: Record<string, unknown>
): Promise<unknown> {
    if (DESTRUCTIVE_ACTIONS.includes(action) && params.confirm !== true) {
        return {
            warning: `DESTRUCTIVE ACTION: ${action}`,
            target: String(params.spreadsheet_id ?? params.sheet_id ?? 'unknown'),
            message: 'This cannot be undone. Call again with confirm: true to proceed.',
            confirm_required: true,
        };
    }

    const sheetsClient = sheets({ version: 'v4', auth: auth as any });

    switch (action) {
        case 'create': {
            const res = await sheetsClient.spreadsheets.create({
                requestBody: {
                    properties: { title: params.title as string },
                },
                fields: 'spreadsheetId,spreadsheetUrl,properties.title',
            });
            return {
                spreadsheetId: res.data.spreadsheetId,
                spreadsheetUrl: res.data.spreadsheetUrl,
                title: res.data.properties?.title,
            };
        }

        case 'append_rows': {
            const res = await sheetsClient.spreadsheets.values.append({
                spreadsheetId: params.spreadsheet_id as string,
                range: params.range as string,
                valueInputOption: (params.value_input_option as string) ?? 'USER_ENTERED',
                requestBody: { values: params.values as any[][] },
            });
            return {
                updatedRange: res.data.updates?.updatedRange,
                updatedRows: res.data.updates?.updatedRows,
                updatedCells: res.data.updates?.updatedCells,
            };
        }

        case 'update_cells': {
            const res = await sheetsClient.spreadsheets.values.update({
                spreadsheetId: params.spreadsheet_id as string,
                range: params.range as string,
                valueInputOption: (params.value_input_option as string) ?? 'USER_ENTERED',
                requestBody: { values: params.values as any[][] },
            });
            return {
                updatedRange: res.data.updatedRange,
                updatedRows: res.data.updatedRows,
                updatedCells: res.data.updatedCells,
            };
        }

        case 'add_sheet': {
            const res = await sheetsClient.spreadsheets.batchUpdate({
                spreadsheetId: params.spreadsheet_id as string,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: { title: params.title as string },
                        },
                    }],
                },
            });
            const addedSheet = res.data.replies?.[0]?.addSheet;
            return {
                sheetId: addedSheet?.properties?.sheetId,
                title: addedSheet?.properties?.title,
            };
        }

        case 'delete_sheet': {
            await sheetsClient.spreadsheets.batchUpdate({
                spreadsheetId: params.spreadsheet_id as string,
                requestBody: {
                    requests: [{
                        deleteSheet: { sheetId: params.sheet_id as number },
                    }],
                },
            });
            return { deleted: true, sheet_id: params.sheet_id };
        }

        case 'clear_range': {
            const res = await sheetsClient.spreadsheets.values.clear({
                spreadsheetId: params.spreadsheet_id as string,
                range: params.range as string,
            });
            return { clearedRange: res.data.clearedRange };
        }

        default: {
            const _exhaustive: never = action;
            throw new Error(`Unknown sheets admin action: ${_exhaustive}`);
        }
    }
}
