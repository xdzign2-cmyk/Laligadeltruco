const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config({ path: 'C:/Users/FSOS/.gemini/antigravity/scratch/dashboard-operativo/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: No se encontraron las credenciales de Supabase en el archivo .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreFrancis() {
    console.log("🚀 Iniciando restauración de Francis...");

    // 1. Eliminar cualquier rastro de Dasos si existe bajo el mismo username
    const { error: deleteDir } = await supabase
        .from('usuarios_sistema')
        .delete()
        .eq('username', 'francis');

    if (deleteDir) console.log("Info: Limpieza previa realizada.");

    // 2. Insertar a Francis con sus credenciales exactas
    const { data, error } = await supabase
        .from('usuarios_sistema')
        .upsert({
            username: 'francis',
            password_text: 'Francis.2026',
            nombre: 'Francis',
            role: 'fijo_barco', // Asumido Barco por el contexto previo
            estado: 'aprobado'
        }, { onConflict: 'username' });

    if (error) {
        console.error("❌ Error al insertar a Francis:", error.message);
    } else {
        console.log("✅ Francis ha sido agregada exitosamente.");
        console.log("   Usuario: francis");
        console.log("   Contraseña: Francis.2026");
    }

    // 3. Eliminar a Dasos si tiene otro username
    const { error: deleteDasos } = await supabase
        .from('usuarios_sistema')
        .delete()
        .eq('username', 'dasos.545'); // Username visto en ACCESOS_SISTEMA.txt

    if (!deleteDasos) console.log("✅ Dasos (dasos.545) eliminado de la base de datos.");
}

restoreFrancis();
