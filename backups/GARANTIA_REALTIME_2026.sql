-- ==========================================
-- GARANTÍA DE SINCRONIZACIÓN REALTIME FMX 2026
-- ==========================================

-- 1. Asegurar la publicación 'supabase_realtime'
-- NOTA: Si la publicación no existe, se crea. Si existe, se añaden las tablas.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Añadir tablas a la publicación (esto permite que Supabase envíe los cambios de inmediato)
-- Ejecutar estas líneas una por una o todas juntas si tu entorno lo permite:
ALTER PUBLICATION supabase_realtime ADD TABLE app_backups;
ALTER PUBLICATION supabase_realtime ADD TABLE registros_operativos;
ALTER PUBLICATION supabase_realtime ADD TABLE shifts_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE clientes_restricciones;
ALTER PUBLICATION supabase_realtime ADD TABLE restricciones_solicitudes;
ALTER PUBLICATION supabase_realtime ADD TABLE clientes_restricciones_audit;

-- 3. Asegurar Identidad de Réplica (necesaria para UPDATE y DELETE en tiempo real)
ALTER TABLE app_backups REPLICA IDENTITY FULL;
ALTER TABLE registros_operativos REPLICA IDENTITY FULL;
ALTER TABLE shifts_entries REPLICA IDENTITY FULL;
ALTER TABLE clientes_restricciones REPLICA IDENTITY FULL;
ALTER TABLE restricciones_solicitudes REPLICA IDENTITY FULL;
ALTER TABLE clientes_restricciones_audit REPLICA IDENTITY FULL;

-- ==========================================
-- EL SISTEMA AHORA ES 100% REACTIVO
-- ==========================================
