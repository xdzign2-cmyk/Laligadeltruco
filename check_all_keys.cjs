
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { data, error } = await supabase.from('app_backups').select('content').eq('id', 1).single();
    if (error) {
        console.error("Error:", error.message);
        return;
    }
    console.log("ALL KEYS:", Object.keys(data.content).join(", "));
    console.log("SHIFTS:", JSON.stringify(data.content.shifts));
}

checkData();
