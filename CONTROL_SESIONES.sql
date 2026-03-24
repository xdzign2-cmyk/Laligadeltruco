
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
