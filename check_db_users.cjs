const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'C:/Users/FSOS/.gemini/antigravity/scratch/dashboard-operativo/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    const { data, error } = await supabase
        .from('usuarios_sistema')
        .select('username, nombre, role, estado');

    if (error) {
        console.error(error);
    } else {
        console.table(data);
    }
}

checkUsers();
