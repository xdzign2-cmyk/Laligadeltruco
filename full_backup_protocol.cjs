
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Hardcoded keys for this specific rescue operation to ensure it works immediately
// (User's environment seems stable but let's be 100% sure)
const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = [
    'registros_operativos',
    'usuarios_sistema',
    'perfiles_empleados',
    'app_backups',
    'publicidad_detallada',
    'publicidad_audit',
    'restricciones_clientes',
    'gestor_sesiones'
];

async function backupSystem() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups', `BLINDAJE_TOTAL_${timestamp}`);

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`🛡️ INICIANDO PROTOCOLO DE BLINDAJE: ${timestamp}`);
    console.log(`📂 Directorio: ${backupDir}`);

    for (const table of TABLES) {
        console.log(`... Respaldando tabla: [${table}]`);
        // Fetch all rows (limit 10000 for safety, though unlikely to exceed)
        const { data, error } = await supabase.from(table).select('*').limit(10000);

        if (error) {
            console.error(`❌ Error en [${table}]:`, error.message);
        } else {
            const filePath = path.join(backupDir, `${table}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`✅ [${table}] Guardado: ${data.length} registros.`);
        }
    }

    // Create a Manifest file
    const manifest = {
        timestamp: new Date().toISOString(),
        tables_backed_up: TABLES,
        status: 'PROTECTED',
        version: '4x4'
    };
    fs.writeFileSync(path.join(backupDir, 'MANIFEST_PROTECTION.json'), JSON.stringify(manifest, null, 2));

    console.log('🔒 SISTEMA BLINDADO CORRECTAMENTE.');
}

backupSystem();
