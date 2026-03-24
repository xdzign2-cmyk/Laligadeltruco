
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
