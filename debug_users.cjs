const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://ybhqhfcbyurxyunthnfy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaHFoZmNieXVyeHl1bnRobmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjEzMDcsImV4cCI6MjA4MzYzNzMwN30.sgSUwctNVn7-2aQbTtffXK-nfFOEZmJFiu_7aBgZi7c');
s.from('usuarios_sistema').select('*').then(r => {
    r.data.forEach(u => {
        if (u.nombre.toLowerCase().includes('francis') || u.nombre.toLowerCase().includes('clemente')) {
            console.log(JSON.stringify(u, null, 2));
        }
    });
});
