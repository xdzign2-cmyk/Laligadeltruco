
-- ==========================================
-- SISTEMA DE RESTRICCIONES Y LISTA NEGRA
-- ==========================================

-- 1. Tabla Principal de Clientes Restringidos
CREATE TABLE IF NOT EXISTS clientes_restricciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    whatsapp TEXT UNIQUE NOT NULL,
    advertencias INTEGER DEFAULT 0 CHECK (advertencias >= 0 AND advertencias <= 3),
    estado TEXT DEFAULT 'observacion', -- 'observacion', 'suspendido', 'baneado'
    motivo TEXT,
    bloqueo_hasta TIMESTAMPTZ,
    creado_por TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Auditoría (Historial de todo lo que pasa)
CREATE TABLE IF NOT EXISTS clientes_restricciones_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restriccion_id UUID REFERENCES clientes_restricciones(id) ON DELETE SET NULL,
    accion TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'APPROVAL'
    usuario TEXT NOT NULL,
    detalles JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de Solicitudes (Para cambios que requieren permiso de Admin)
CREATE TABLE IF NOT EXISTS restricciones_solicitudes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo TEXT NOT NULL, -- 'DELETE', 'REDUCE_WARNINGS', 'REMOVE_BAN', 'EDIT'
    cliente_id UUID REFERENCES clientes_restricciones(id) ON DELETE CASCADE,
    usuario TEXT NOT NULL,
    detalles JSONB NOT NULL,
    estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'aprobado', 'rechazado'
    created_at TIMESTAMPTZ DEFAULT now(),
    procesado_por TEXT,
    procesado_at TIMESTAMPTZ
);

-- ==========================================
-- CONFIGURACIÓN DE REALTIME Y SEGURIDAD (RLS)
-- ==========================================

-- Habilitar Realtime para todas las tablas
ALTER TABLE clientes_restricciones REPLICA IDENTITY FULL;
ALTER TABLE clientes_restricciones_audit REPLICA IDENTITY FULL;
ALTER TABLE restricciones_solicitudes REPLICA IDENTITY FULL;

-- Habilitar RLS
ALTER TABLE clientes_restricciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_restricciones_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE restricciones_solicitudes ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso (Total para este entorno simplificado)
CREATE POLICY "Acceso clientes" ON clientes_restricciones FOR ALL USING (true);
CREATE POLICY "Acceso auditoria" ON clientes_restricciones_audit FOR ALL USING (true);
CREATE POLICY "Acceso solicitudes" ON restricciones_solicitudes FOR ALL USING (true);

-- ==========================================
-- TRIGGERS PARA UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_update_clientes_restricciones ON clientes_restricciones;
CREATE TRIGGER tr_update_clientes_restricciones
    BEFORE UPDATE ON clientes_restricciones
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
