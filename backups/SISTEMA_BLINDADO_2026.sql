-- ==========================================
-- SISTEMA BLINDADO FMX 2026 - RESPALDO TOTAL (v2 Idempotente)
-- ==========================================

-- 1. TABLA DE RESPALDOS
CREATE TABLE IF NOT EXISTS app_backups (
    id BIGINT PRIMARY KEY,
    updated_at TIMESTAMPTZ DEFAULT now(),
    content JSONB NOT NULL
);
ALTER TABLE app_backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total backups" ON app_backups;
CREATE POLICY "Acceso total backups" ON app_backups FOR ALL USING (true) WITH CHECK (true);

-- 2. TABLA DE CONTROL DE SESIONES
CREATE TABLE IF NOT EXISTS gestor_sesiones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    device_id TEXT NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_email, device_id)
);
ALTER TABLE gestor_sesiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total sesiones" ON gestor_sesiones;
CREATE POLICY "Acceso total sesiones" ON gestor_sesiones FOR ALL USING (true) WITH CHECK (true);

-- 3. TABLA DE REGISTROS DIARIOS
CREATE TABLE IF NOT EXISTS registros_operativos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_email TEXT NOT NULL,
    user_role TEXT NOT NULL,
    bando TEXT NOT NULL,
    mesa TEXT NOT NULL,
    monto_apuesta NUMERIC NOT NULL,
    ganancia_calculada NUMERIC NOT NULL,
    fecha_operacion DATE DEFAULT CURRENT_DATE,
    hora_registro TIME DEFAULT CURRENT_TIME
);
ALTER TABLE registros_operativos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total registros" ON registros_operativos;
CREATE POLICY "Acceso total registros" ON registros_operativos FOR ALL USING (true) WITH CHECK (true);

-- 4. TABLA DE HORAS DE NÓMINA
CREATE TABLE IF NOT EXISTS shifts_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    emp_id INTEGER NOT NULL,
    day INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    view_mode TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(emp_id, day, month, year, view_mode)
);
ALTER TABLE shifts_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso publico shift_entries" ON shifts_entries;
CREATE POLICY "Acceso publico shift_entries" ON shifts_entries FOR ALL USING (true) WITH CHECK (true);

-- 5. USUARIOS DEL SISTEMA
CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_text TEXT NOT NULL,
    nombre TEXT NOT NULL,
    role TEXT NOT NULL,
    estado TEXT DEFAULT 'pendiente',
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE usuarios_sistema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total usuarios" ON usuarios_sistema;
CREATE POLICY "Acceso total usuarios" ON usuarios_sistema FOR ALL USING (true) WITH CHECK (true);

-- 6. MODULO DE RESTRICCIONES
CREATE TABLE IF NOT EXISTS clientes_restricciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    whatsapp TEXT UNIQUE NOT NULL,
    advertencias INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'observacion',
    motivo TEXT,
    bloqueo_hasta TIMESTAMPTZ,
    creado_por TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clientes_restricciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total restricciones" ON clientes_restricciones;
CREATE POLICY "Acceso total restricciones" ON clientes_restricciones FOR ALL USING (true) WITH CHECK (true);

-- 7. SOLICITUDES DE AUTORIZACIÓN
CREATE TABLE IF NOT EXISTS restricciones_solicitudes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo TEXT NOT NULL,
    cliente_id UUID REFERENCES clientes_restricciones(id) ON DELETE CASCADE,
    usuario TEXT NOT NULL,
    detalles JSONB NOT NULL,
    estado TEXT DEFAULT 'pendiente',
    created_at TIMESTAMPTZ DEFAULT now(),
    procesado_por TEXT,
    procesado_at TIMESTAMPTZ
);
ALTER TABLE restricciones_solicitudes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso solicitudes" ON restricciones_solicitudes;
CREATE POLICY "Acceso solicitudes" ON restricciones_solicitudes FOR ALL USING (true);

-- 8. AUDIT LOGS
CREATE TABLE IF NOT EXISTS clientes_restricciones_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restriccion_id UUID,
    accion TEXT NOT NULL,
    usuario TEXT NOT NULL,
    detalles JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clientes_restricciones_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso auditoria" ON clientes_restricciones_audit;
CREATE POLICY "Acceso auditoria" ON clientes_restricciones_audit FOR ALL USING (true);

-- ACTIVAR REALTIME GLOBAL
ALTER TABLE app_backups REPLICA IDENTITY FULL;
ALTER TABLE registros_operativos REPLICA IDENTITY FULL;
ALTER TABLE shifts_entries REPLICA IDENTITY FULL;
ALTER TABLE clientes_restricciones REPLICA IDENTITY FULL;
ALTER TABLE restricciones_solicitudes REPLICA IDENTITY FULL;
