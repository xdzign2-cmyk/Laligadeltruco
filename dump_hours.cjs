
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpShifts() {
    const { data, error } = await supabase.from('app_backups').select('content').eq('id', 1).single();
    if (error) {
        console.error("Error:", error.message);
        return;
    }

    const shifts = data.content.shifts;
    const employees = data.content.employees || [];

    console.log("--- REPORTE DE HORAS EN LA NUBE ---");
    if (!shifts || Object.keys(shifts).length === 0) {
        console.log("La matriz de turnos está VACÍA en este backup.");
    } else {
        employees.forEach(emp => {
            const empShifts = shifts[emp.id];
            if (empShifts) {
                const filledDays = Object.entries(empShifts).filter(([day, val]) => val && val !== '');
                if (filledDays.length > 0) {
                    console.log(`Empleado: ${emp.name} (ID: ${emp.id})`);
                    filledDays.forEach(([day, val]) => {
                        console.log(`  Día ${day}: ${val}`);
                    });
                }
            }
        });
    }
    console.log("--- FIN DEL REPORTE ---");
}

dumpShifts();
