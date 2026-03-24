-- ACTUALIZACIÓN DE TABLA PUBLICIDAD PARA SOPORTE DE GRUPOS
ALTER TABLE publicidad_detallada ADD COLUMN IF NOT EXISTS grupo TEXT DEFAULT 'Barco';
ALTER TABLE publicidad_audit ADD COLUMN IF NOT EXISTS grupo TEXT;

-- Indexar por grupo para velocidad
CREATE INDEX IF NOT EXISTS idx_publicidad_grupo ON publicidad_detallada(grupo);
