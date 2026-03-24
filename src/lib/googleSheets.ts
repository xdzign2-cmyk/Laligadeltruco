// Google Sheets backup via Supabase Edge Function
const EDGE_FUNCTION_URL = 'https://ybhqhfcbyurxyunthnfy.supabase.co/functions/v1/backup-to-sheets';

// Track last backup date to prevent constant backups
let lastBackupDate: string | null = null;

export async function backupToGoogleSheets(data: any[], force: boolean = false) {
    try {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        // Check if we already backed up today
        if (lastBackupDate === today && !force) {
            if (import.meta.env.DEV) console.log('📊 Already backed up today, skipping...');
            return { success: true, skipped: true, message: 'Already backed up today' };
        }

        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ data }),
        });

        const result = await response.json();

        if (result.success) {
            lastBackupDate = today; // Mark today as backed up
            if (import.meta.env.DEV) console.log(`✅ Backed up ${result.rowCount} rows to sheet: ${result.sheetName}`);
            return { success: true, rowCount: result.rowCount, sheetName: result.sheetName };
        } else {
            console.error('❌ Google Sheets backup failed:', result.error);
            return { success: false, error: result.error };
        }
    } catch (error: any) {
        console.error('❌ Failed to call backup function:', error);
        return { success: false, error: error.message };
    }
}

export async function readFromGoogleSheets() {
    // Not implemented - backup only for now
    return { success: true, data: [] };
}
