
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchUsers() {
    console.log("Fetching users...");
    const { data: users, error } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .order('role', { ascending: true });

    if (error) {
        console.error("Error fetching users:", error);
        return;
    }

    if (!users || users.length === 0) {
        console.log("No users found.");
        return;
    }

    let output = "================================================================\n";
    output += "          LISTA MAESTRA DE ACCESOS - SISTEMA 4X4\n";
    output += "================================================================\n";
    output += `FECHA DE REPORTE: ${new Date().toLocaleString()}\n`;
    output += "NOTA: La contraseña genérica del sistema es '123456'\n\n";

    output += "USUARIO (Login)       | CONTRASEÑA           | ROL (Nivel de Acceso)       | ESTADO\n";
    output += "--------------------- | -------------------- | --------------------------- | ---------\n";

    users.forEach(user => {
        const username = (user.username || 'N/A').padEnd(21, ' ');
        // Show password or default
        const password = (user.password_text || '123456').padEnd(20, ' ');
        // Clean up role if it has formatting
        const rawRole = (user.role || 'N/A');
        const role = rawRole.padEnd(27, ' ');
        const status = (user.estado || 'pendiente').toUpperCase();

        output += `${username} | ${password} | ${role} | ${status}\n`;
    });

    output += "\n================================================================\n";
    output += " FIN DEL REPORTE\n";
    output += "================================================================\n";

    fs.writeFileSync('ACCESOS_SISTEMA.txt', output);
    console.log("Report generated: ACCESOS_SISTEMA.txt");
}

fetchUsers();
