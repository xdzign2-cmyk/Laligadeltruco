
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
    console.log("Keys in backup content:", Object.keys(data.content));
    if (data.content.shipments) {
        console.log("Shipments count:", data.content.shipments.length);
    } else {
        console.log("Shipments is MISSING from backup content");
    }
    if (data.content.employees) {
        console.log("Employees count:", data.content.employees.length);
    }
    if (data.content.shifts) {
        console.log("Shifts matrix exists");
    }
}

checkData();
