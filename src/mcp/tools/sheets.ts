import { sheets } from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';

export async function sheetsRead(auth: GoogleAuth, params: {
    spreadsheet_id: string;
    range?: string;
}) {
    const sheetsClient = sheets({ version: 'v4', auth: auth as any });
    if (params.range) {
        const res = await sheetsClient.spreadsheets.values.get({
            spreadsheetId: params.spreadsheet_id,
            range: params.range,
        });
        return { range: res.data.range, values: res.data.values ?? [] };
    }
    const res = await sheetsClient.spreadsheets.get({
        spreadsheetId: params.spreadsheet_id,
        fields: 'spreadsheetId,properties.title,sheets.properties',
    });
    return {
        spreadsheetId: res.data.spreadsheetId,
        title: res.data.properties?.title,
        sheets: res.data.sheets?.map((s: any) => ({
            sheetId: s.properties?.sheetId,
            title: s.properties?.title,
            rowCount: s.properties?.gridProperties?.rowCount,
            columnCount: s.properties?.gridProperties?.columnCount,
        })),
    };
}
