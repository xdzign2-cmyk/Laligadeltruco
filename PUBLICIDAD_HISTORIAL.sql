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
