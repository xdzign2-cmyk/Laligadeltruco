-- REPARAR PERMISOS DE SINCRONIZACIÓN
-- Copia y pega todo esto en el SQL Editor de Supabase y dale a RUN

-- 1. Asegurar que la tabla existe
create table if not exists registros_operativos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_email text,
  user_role text,
  bando text, -- 'Barco' o 'Cueva'
  mesa text,
  monto_apuesta numeric,
  ganancia_calculada numeric,
  fecha_operacion text, -- Importante: YYYY-MM-DD
  hora_registro text
);

-- 2. Habilitar Seguridad (RLS)
alter table registros_operativos enable row level security;

-- 3. ELIMINAR POLITICAS ANTIGUAS (Para evitar conflictos)
drop policy if exists "Acceso Total Registros" on registros_operativos;
drop policy if exists "Enable read access for all users" on registros_operativos;
drop policy if exists "Enable insert for all users" on registros_operativos;

-- 4. CREAR POLÍTICA PERMISIVA (SOLUCIÓN)
-- Esto permite que el Dashboard (Admin) pueda VER lo que escriben los Operativos (Móvil)
create policy "Acceso Total Registros"
on registros_operativos
for all
using (true)
with check (true);

-- (Opcional) Asegurar permisos también para perfiles
alter table perfiles_empleados enable row level security;
create policy "Acceso Perfiles" on perfiles_empleados for all using (true) with check (true);
