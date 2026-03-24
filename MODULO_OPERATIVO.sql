
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
