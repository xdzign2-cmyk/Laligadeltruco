-- COPIA Y PEGA ESTO EN EL SQL EDITOR DE SUPABASE PARA ARREGLAR EL GUARDADO

-- 1. Crear la tabla de respaldos si no existe
create table if not exists app_backups (
  id bigint primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  content jsonb not null
);

-- 2. Habilitar seguridad (RLS) pero permitir acceso público por ahora para facilitar las cosas
alter table app_backups enable row level security;

-- 3. Crear política para permitir TODO (lectura y escritura) a cualquiera (anon)
-- Nota: En producción idealmente restringirías esto, pero para que funcione ya:
create policy "Acceso total a backups"
on app_backups
for all
using (true)
with check (true);

-- 4. Insertar fila inicial vacía para evitar error 404 al inicio (opcional)
insert into app_backups (id, content) 
values (1, '{}'::jsonb)
on conflict (id) do nothing;
