
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log("1. Probando conexión a Supabase...");

    // Intentar leer
    const { data, error: readError } = await supabase
        .from('app_backups')
        .select('*')
        .limit(1);

    if (readError) {
        console.error("❌ ERROR DE LECTURA:", readError.message);
        console.error("   Código:", readError.code);
        if (readError.code === '42P01') {
            console.log("\n⚠️ DIAGNÓSTICO: La tabla 'app_backups' NO EXISTE.");
            console.log("   SOLUCIÓN: Debes ejecutar el script SQL que te creé en Supabase.");
        }
        return;
    }

    console.log("✅ Lectura exitosa. Datos encontrados:", data);

    // Intentar escribir un timestamp de prueba
    const { error: writeError } = await supabase
        .from('app_backups')
        .upsert({ id: 1, updated_at: new Date(), content: { test: "Prueba de conexión exitosa desde Antigravity" } });

    if (writeError) {
        console.error("❌ ERROR DE ESCRITURA:", writeError.message);
        if (writeError.code === '42501') {
            console.log("\n⚠️ DIAGNÓSTICO: Permiso denegado (RLS).");
            console.log("   SOLUCIÓN: Debes ejecutar la parte del script SQL que habilita las políticas de acceso.");
        }
    } else {
        console.log("✅ Escritura exitosa. ¡La base de datos funciona perfectamente!");
    }
}

testConnection();
