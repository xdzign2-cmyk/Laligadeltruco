
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function showProof() {
    console.log("--- COMPROBACIÓN DE DATOS ---");

    const { data: regs } = await supabase.from('registros_operativos').select('monto_apuesta, bando, fecha_operacion').limit(5);
    console.log("Últimos registros de apuestas:", regs);

    const { data: backup } = await supabase.from('app_backups').select('content').eq('id', 1).single();
    if (backup && backup.content) {
        const totalEnviado = (backup.content.shipments || []).reduce((acc, s) => acc + s.monto, 0);
        console.log("Total Dinero Enviado (Nube):", totalEnviado);
        console.log("Empleados en Nómina:", (backup.content.employees || []).map(e => e.name).join(", "));
    }

    console.log("--- FIN DE COMPROBACIÓN ---");
}

showProof();
