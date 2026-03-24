
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ybhqhfcbyurxyunthnfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { count: regCount, error: regError } = await supabase.from('registros_operativos').select('*', { count: 'exact', head: true });
    const { count: backCount, error: backError } = await supabase.from('app_backups').select('*', { count: 'exact', head: true });
    const { count: userCount, error: userError } = await supabase.from('usuarios_sistema').select('*', { count: 'exact', head: true });

    console.log("Registros Operativos:", regCount, regError ? regError.message : "OK");
    console.log("App Backups:", backCount, backError ? backError.message : "OK");
    console.log("Usuarios Sistema:", userCount, userError ? userError.message : "OK");
}

checkData();
