
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDay13() {
    const { data, error } = await supabase
        .from('registros_operativos')
        .select('*')
        .eq('fecha_operacion', '2026-01-13');

    if (error) {
        console.error('Error fetching:', error);
    } else {
        console.log('Records for 2026-01-13:', data.length);
        console.table(data);
    }
}

checkDay13();
