
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function recover() {
    console.log("Buscando versiones anteriores del respaldo...");
    // Intentar ver si hay más registros en app_backups o si podemos ver el historial (si hubiera)
    const { data, error } = await supabase.from('app_backups').select('*').order('updated_at', { ascending: false });

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    console.log(`Se encontraron ${data.length} registros en app_backups.`);
    data.forEach(row => {
        const shifts = row.content.shifts || {};
        const hoursCount = Object.values(shifts).reduce((acc, emp) => acc + Object.keys(emp).length, 0);
        console.log(`ID: ${row.id} | Actualizado: ${row.updated_at} | Horas cargadas: ${hoursCount}`);
    });
}

recover();
