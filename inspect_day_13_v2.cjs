
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDay13() {
    console.log("Checking DB for 2026-01-13...");
    const { data, error } = await supabase
        .from('registros_operativos')
        .select('*')
        .eq('fecha_operacion', '2026-01-13');

    if (error) {
        console.error('Error fetching:', error);
    } else {
        console.log('Records count:', data.length);
        if (data.length > 0) {
            console.log('First record sample:', data[0]);
            const total = data.reduce((sum, r) => sum + r.monto_apuesta, 0);
            console.log('Total Apuesta:', total);
        } else {
            console.log('No records found for that date.');
        }
    }
}

checkDay13();
