const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data, error } = await supabase.from('app_backups').select('content').eq('id', 1).single();
    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('--- EMPLOYEES ---');
    console.log(JSON.stringify(data.content.employees, null, 2));

    console.log('--- SHIFTS ---');
    // Just look at the first employee's shifts to see structure
    const firstEmpId = Object.keys(data.content.shifts)[0];
    console.log(`Shifts for Emp ID ${firstEmpId}:`);
    console.log(JSON.stringify(data.content.shifts[firstEmpId], null, 2));
}

inspect();
