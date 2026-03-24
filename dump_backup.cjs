const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpBackup() {
    const { data: backup, error } = await supabase.from('app_backups').select('content').eq('id', 1).single();
    if (error) {
        console.error("Error fetching backup:", error);
        return;
    }
    fs.writeFileSync(path.join(__dirname, 'backup_dump.json'), JSON.stringify(backup.content, null, 2));
    console.log("Backup dumped to backup_dump.json");
}

dumpBackup();
