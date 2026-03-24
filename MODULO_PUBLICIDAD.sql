
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
