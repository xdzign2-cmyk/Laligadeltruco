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

-- TABLA PARA CONTROL DE DISPOSITIVOS (SESIONES ACTIVAS)
CREATE TABLE IF NOT EXISTS gestor_sesiones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    device_id TEXT NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_email, device_id)
);

-- Habilitar RLS
ALTER TABLE gestor_sesiones ENABLE ROW LEVEL SECURITY;

-- Política de acceso total (simplificada para el sistema actual)
CREATE POLICY "Acceso total sesiones" ON gestor_sesiones FOR ALL USING (true) WITH CHECK (true);

-- 1. Tabla para los registros diarios de los empleados
CREATE TABLE IF NOT EXISTS registros_operativos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_email TEXT NOT NULL,
    user_role TEXT NOT NULL, -- 'fijo_barco', 'fijo_cueva', 'franquero'
    bando TEXT NOT NULL,     -- 'Barco' o 'Cueva'
    mesa TEXT NOT NULL,
    hora_registro TIME DEFAULT CURRENT_TIME,
    monto_apuesta NUMERIC NOT NULL,
    ganancia_calculada NUMERIC NOT NULL, -- (Monto * 2) * 0.08
    fecha_operacion DATE DEFAULT CURRENT_DATE
);

-- 2. Tabla para los perfiles (Comprobantes de pago)
CREATE TABLE IF NOT EXISTS perfiles_empleados (
    user_email TEXT PRIMARY KEY,
    comprobante_url TEXT, -- Link al archivo subido por el admin
    ultimo_pago_update TIMESTAMPTZ
);

-- 3. Habilitar RLS (Seguridad)
ALTER TABLE registros_operativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_empleados ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acceso (Permitir todo a la app por ahora para simplicidad del prototipo, 
-- pero la lógica de filtrado se hará estricta en el Frontend según tu pedido)
CREATE POLICY "Acceso total registros" ON registros_operativos FOR ALL USING (true);
CREATE POLICY "Acceso total perfiles" ON perfiles_empleados FOR ALL USING (true);

-- 5. Bucket para subir archivos (Comprobantes)
-- Nota: Debes crear un bucket llamado 'comprobantes' en el menú Storage de Supabase y hacerlo público.

-- TABLA PARA EL CONTROL DE PUBLICIDAD SINCRONIZADA
CREATE TABLE IF NOT EXISTS modulo_publicidad (
    fecha DATE PRIMARY KEY,
    is_active BOOLEAN DEFAULT false,
    costo_ars NUMERIC DEFAULT 27000,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE modulo_publicidad ENABLE ROW LEVEL SECURITY;

-- Política de acceso total (simplificada para el sistema actual)
CREATE POLICY "Acceso total publicidad" ON modulo_publicidad FOR ALL USING (true) WITH CHECK (true);

-- TABLA PARA REGISTROS DETALLADOS DE PUBLICIDAD (POR HORA Y MONTO VARIABLE)
CREATE TABLE IF NOT EXISTS publicidad_detallada (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha DATE NOT NULL,
    hora INT CHECK (hora >= 0 AND hora <= 23),
    monto NUMERIC NOT NULL,
    nota TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT -- Username del que cargó
);

-- Habilitar RLS
ALTER TABLE publicidad_detallada ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso total publicidad detallada" ON publicidad_detallada FOR ALL USING (true) WITH CHECK (true);

-- Indexar por fecha para velocidad de reportes
CREATE INDEX IF NOT EXISTS idx_publicidad_fecha ON publicidad_detallada(fecha);
-- TABLA PARA EL HISTORIAL DE CAMBIOS EN PUBLICIDAD
CREATE TABLE IF NOT EXISTS publicidad_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_registro DATE NOT NULL,
    accion TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    monto_anterior NUMERIC,
    monto_nuevo NUMERIC,
    usuario TEXT,
    detalles JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE publicidad_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso total historial" ON publicidad_audit FOR ALL USING (true) WITH CHECK (true);
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

-- RE-ESTRUCTURACIÓN COMPLETA DE USUARIOS (BORRA E INSERTA DE NUEVO PARA LIMPIEZA)
DROP TABLE IF EXISTS usuarios_sistema;

CREATE TABLE usuarios_sistema (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_text TEXT NOT NULL,
    nombre TEXT NOT NULL,
    role TEXT NOT NULL, -- 'admin', 'vicepresident', 'guest', 'fijo_barco', 'fijo_cueva', 'franquero'
    estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'aprobado', 'denegado'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE usuarios_sistema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso total usuarios" ON usuarios_sistema FOR ALL USING (true);

-- INSERTAR TODOS LOS USUARIOS (ADMINS, VICE, GUESTS Y EMPLEADOS)
INSERT INTO usuarios_sistema (username, password_text, nombre, role, estado)
VALUES 
-- MANDO
('admin', 'FelipeMaster.2026', 'Administrador', 'admin', 'aprobado'),
('larryadmin', 'LarryVice.2026', 'Larry (Vicepresidente)', 'vicepresident', 'aprobado'),

-- INVITADOS (ESTADO PENDIENTE PARA QUE PRUEBES EL BOTÓN)
('invitado', 'Visita.2026', 'Invitado Principal', 'guest', 'aprobado'),
('invitado2', 'Visita2.2026', 'Invitado Demo 2', 'guest', 'pendiente'),
('invitado3', 'Visita3.2026', 'Invitado Demo 3', 'guest', 'pendiente'),

-- EMPLEADOS BARCO
('romero', 'Romero.2026', 'Romero', 'fijo_barco', 'aprobado'),
('alfredo', 'Alfredo.2026', 'Alfredo', 'fijo_barco', 'aprobado'),

-- EMPLEADOS CUEVA
('francel', 'Francel.2026', 'Francel', 'fijo_cueva', 'aprobado'),
('willy', 'Willy.2026', 'Willy', 'fijo_cueva', 'aprobado'),

-- FRANQUEROS
('francis', 'Francis.2026', 'Francis', 'franquero', 'aprobado'),
('clemente', 'Clemente.2026', 'Clemente', 'franquero', 'aprobado')
ON CONFLICT (username) DO NOTHING;
-- 6. Usuario Shaipubli para control de publicidad
INSERT INTO usuarios_sistema (username, password_text, role, nombre, estado)
VALUES ('shaipubli', 'shaipubli2026', 'shaipubli', 'Shaipubli Control', 'aprobado')
ON CONFLICT (username) DO NOTHING;
