import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore: Standard TS cannot resolve Deno HTTPS imports
import { google } from "https://esm.sh/googleapis@144.0.0?no-check";

const SPREADSHEET_ID = '1QsD9nzEXdgkRYOFj59xsBhCTiqoqPy-CaWYS0s3dtr4';

// @ts-ignore: Deno is built-in to the Supabase Edge Function environment
Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            },
        });
    }

    try {
        // Get Google credentials from environment
        // @ts-ignore: Deno is built-in to the Supabase Edge Function environment
        const credentialsJson = Deno.env.get('GOOGLE_CREDENTIALS');
        if (!credentialsJson) {
            throw new Error('GOOGLE_CREDENTIALS not configured');
        }

        const credentials = JSON.parse(credentialsJson);

        // Parse request body
        const { data } = await req.json();
        if (!data || !Array.isArray(data)) {
            throw new Error('Invalid data format');
        }

        // Initialize Google Sheets API
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Create sheet name with current date (YYYY-MM-DD format)
        const now = new Date();
        const sheetName = `Backup ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Check if sheet already exists
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const existingSheet = spreadsheet.data.sheets?.find(
            (sheet: any) => sheet.properties?.title === sheetName
        );

        // If sheet doesn't exist, create it
        if (!existingSheet) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetName,
                                },
                            },
                        },
                    ],
                },
            });
            console.log(`✅ Created new sheet: ${sheetName}`);
        } else {
            console.log(`📋 Sheet already exists: ${sheetName} - updating data`);
        }

        // Prepare data for Google Sheets
        const headers = ['Fecha', 'Barco', 'Cueva', 'Mesas Barco', 'Mesas Cueva', 'Utilidad', 'Gastos', 'Drop'];
        const rows = data.map((row: any) => [
            row.fullDate || row.dia || '',
            row.barco || 0,
            row.cueva || 0,
            row.mesasBarco || 0,
            row.mesasCueva || 0,
            row.utilidad || 0,
            row.gastos || 0,
            row.drop || 0,
        ]);

        const values = [headers, ...rows];

        // Clear existing data in the sheet
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:H`,
        });

        // Write new data to the sheet
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: { values },
        });

        console.log(`✅ Backed up ${data.length} rows to sheet: ${sheetName}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: `Backed up ${data.length} rows to ${sheetName}`,
                rowCount: data.length,
                sheetName: sheetName,
                alreadyExisted: !!existingSheet
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    } catch (error: any) {
        console.error('Error backing up to Google Sheets:', error);

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Unknown error'
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    }
});
